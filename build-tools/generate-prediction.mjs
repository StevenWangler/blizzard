#!/usr/bin/env node

/**
 * Snow Day Prediction Generator
 * 
 * Node.js script that runs the multi-agent system to generate snow day predictions.
 * Uses the @openai/agents SDK for proper agent orchestration with handoffs and tracing.
 * Designed to be executed by GitHub Actions on a schedule.
 * 
 * Usage:
 *   node build-tools/generate-prediction.mjs          # Production (writes to public/data/)
 *   node build-tools/generate-prediction.mjs --local  # Local development (writes to public/data/local/)
 * 
 * Environment Variables:
 *   - OPENAI_API_KEY: Required for agent system
 *   - VITE_WEATHER_API_KEY: Required for weather data
 *   - VITE_ZIP_CODE: Location for weather forecast (default: 49341)
 */

import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { config as loadEnv } from 'dotenv'
import { Agent, run, tool, setTracingDisabled, webSearchTool, codeInterpreterTool } from '@openai/agents'
import { z } from 'zod'

// Load environment variables from .env file
loadEnv()

// __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ============================================================================
// PROMPT LOADING - Load all prompts from src/services/prompts/ files
// ============================================================================

const PROMPTS_DIR = join(__dirname, '..', 'src', 'services', 'prompts')

function loadPrompt(filename) {
  const filepath = join(PROMPTS_DIR, filename)
  if (!existsSync(filepath)) {
    throw new Error(`Prompt file not found: ${filepath}`)
  }
  return readFileSync(filepath, 'utf-8')
}

// Load all prompts from files
const meteorologistPrompt = loadPrompt('meteorologist.txt')
const historianPrompt = loadPrompt('historian.txt')
const safetyAnalystPrompt = loadPrompt('safety-analyst.txt')
const newsIntelPrompt = loadPrompt('news-intel.txt')
const infrastructureMonitorPrompt = loadPrompt('infrastructure.txt')
const powerGridAnalystPrompt = loadPrompt('power-grid.txt')
const webWeatherVerifierPrompt = loadPrompt('web-weather-verifier.txt')
const coordinatorPrompt = loadPrompt('decision-coordinator.txt')

console.log('📄 Loaded prompts from src/services/prompts/')

// Default timezone for date calculations (keeps runs in sync with the district's local time)
const DEFAULT_TIMEZONE = process.env.VITE_TIMEZONE || process.env.TIMEZONE || 'America/Detroit'

/**
 * Convert a date into the target timezone so weekend/weekday math matches local time.
 */
function getDateInTimeZone(fromDate = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  }).formatToParts(fromDate)

  const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]))
  const year = Number(partMap.year)
  const month = Number(partMap.month)
  const day = Number(partMap.day)

  // Return a date anchored to the start of the day in UTC for the target timezone's calendar date
  return new Date(Date.UTC(year, month - 1, day))
}

// Parse command line arguments
const args = process.argv.slice(2)
const isLocalMode = args.includes('--local') || args.includes('-l')

// Enable SDK tracing for debugging and monitoring (false = tracing ON)
setTracingDisabled(false)

console.log('🚀 Starting Snow Day Prediction Generator (OpenAI Agents SDK)...')
if (isLocalMode) {
  console.log('📦 Running in LOCAL mode - output will be saved to public/data/local/')
}

/**
 * Get the next school day from a given date.
 * Skips weekends (Saturday = 6, Sunday = 0).
 * TODO: Could be extended to skip known holidays.
 */
function getNextSchoolDay(fromDate = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const date = getDateInTimeZone(fromDate, timeZone)
  date.setUTCHours(0, 0, 0, 0)
  
  // Start from tomorrow
  date.setUTCDate(date.getUTCDate() + 1)
  
  // Skip weekends
  const dayOfWeek = date.getUTCDay()
  if (dayOfWeek === 6) {
    // Saturday -> skip to Monday
    date.setUTCDate(date.getUTCDate() + 2)
  } else if (dayOfWeek === 0) {
    // Sunday -> skip to Monday
    date.setUTCDate(date.getUTCDate() + 1)
  }
  
  return date
}

/**
 * Calculate how many days ahead the next school day is.
 */
function getDaysUntilNextSchoolDay(fromDate = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const today = getDateInTimeZone(fromDate, timeZone)
  today.setUTCHours(0, 0, 0, 0)
  const nextSchool = getNextSchoolDay(fromDate, timeZone)
  const diffTime = nextSchool.getTime() - today.getTime()
  return Math.round(diffTime / (1000 * 60 * 60 * 24))
}

// Check required environment variables
const requiredEnvVars = ['OPENAI_API_KEY', 'VITE_WEATHER_API_KEY']
const missingVars = requiredEnvVars.filter(varName => !process.env[varName])

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '))
  console.error('Please set the following environment variables:')
  missingVars.forEach(varName => {
    console.error(`  ${varName}`)
  })
  process.exit(1)
}

const projectRoot = join(__dirname, '..')

// Configuration - use local directory when in local mode
const appConfig = {
  weatherApiKey: process.env.VITE_WEATHER_API_KEY,
  zipCode: process.env.VITE_ZIP_CODE || '49341',
  timeZone: DEFAULT_TIMEZONE,
  outputDir: isLocalMode 
    ? join(projectRoot, 'public', 'data', 'local')
    : join(projectRoot, 'public', 'data'),
  outputFile: 'prediction.json'
}

console.log(`📍 Location: ${appConfig.zipCode}`)
console.log(`📂 Output: ${join(appConfig.outputDir, appConfig.outputFile)}`)
console.log(`⏱️ Timezone for scheduling: ${appConfig.timeZone}`)

// Weather API client for Node.js
class NodeWeatherAPI {
  constructor(apiKey, zipCode) {
    this.apiKey = apiKey
    this.zipCode = zipCode
    this.baseUrl = 'https://api.weatherapi.com/v1'
  }

  async getForecast(daysAhead = 2) {
    const url = new URL(`${this.baseUrl}/forecast.json`)
    url.searchParams.set('key', this.apiKey)
    url.searchParams.set('q', this.zipCode)
    url.searchParams.set('days', String(Math.min(daysAhead + 1, 3))) // +1 for today, max 3 for free tier
    url.searchParams.set('aqi', 'no')
    url.searchParams.set('alerts', 'yes')

    console.log(`🌤️  Fetching weather forecast for ${this.zipCode}...`)

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`Weather API error: ${response.status} - ${errorData.error?.message || response.statusText}`)
    }

    const data = await response.json()
    console.log(`✅ Weather data retrieved for ${data.location.name}, ${data.location.region}`)
    return data
  }
}

// ============================================================================
// STRUCTURED OUTPUT SCHEMAS (Zod)
// ============================================================================

const WeatherAnalysisSchema = z.object({
  temperature_analysis: z.object({
    current_temp_f: z.number(),
    overnight_low_f: z.number(),
    morning_high_f: z.number(),
    freezing_hours: z.number(),
    temperature_trend: z.enum(['rising', 'falling', 'steady']),
    windchill_factor: z.number()
  }),
  precipitation_analysis: z.object({
    snow_probability_overnight: z.number().min(0).max(100),
    snow_probability_morning: z.number().min(0).max(100),
    total_snowfall_inches: z.number(),
    snowfall_rate_peak: z.number(),
    precipitation_type: z.enum(['snow', 'freezing_rain', 'sleet', 'rain', 'mixed'])
  }),
  wind_analysis: z.object({
    max_wind_speed_mph: z.number(),
    wind_direction: z.string(),
    sustained_winds_mph: z.number(),
    wind_chill_impact: z.boolean()
  }),
  visibility_analysis: z.object({
    minimum_visibility_miles: z.number(),
    avg_visibility_miles: z.number(),
    visibility_factors: z.array(z.string())
  }),
  alert_summary: z.array(z.object({
    type: z.string(),
    severity: z.string(),
    description: z.string()
  })),
  overall_conditions_summary: z.string()
})

const HistoricalAnalysisSchema = z.object({
  similar_weather_patterns: z.array(z.object({
    pattern_description: z.string(),
    historical_snow_day_rate: z.number().min(0).max(100),
    confidence_level: z.enum(['high', 'medium', 'low'])
  })),
  seasonal_context: z.object({
    typical_conditions_for_date: z.string(),
    unusual_factors: z.array(z.string()),
    seasonal_probability_adjustment: z.number().min(-20).max(20)
  }),
  location_specific_factors: z.object({
    local_microclimates: z.array(z.string()),
    infrastructure_considerations: z.array(z.string()),
    elevation_impact: z.string()
  }),
  confidence_assessment: z.string()
})

const SafetyAnalysisSchema = z.object({
  road_conditions: z.object({
    primary_roads_score: z.number().min(1).max(10),
    secondary_roads_score: z.number().min(1).max(10),
    parking_lots_score: z.number().min(1).max(10),
    ice_formation_risk: z.enum(['low', 'moderate', 'high', 'severe'])
  }),
  travel_safety: z.object({
    walking_conditions_score: z.number().min(1).max(10),
    driving_conditions_score: z.number().min(1).max(10),
    public_transport_impact: z.enum(['minimal', 'moderate', 'significant', 'severe']),
    emergency_access_concern: z.boolean()
  }),
  timing_analysis: z.object({
    worst_conditions_start_time: z.string(),
    worst_conditions_end_time: z.string(),
    morning_commute_impact: z.enum(['minimal', 'moderate', 'significant', 'severe']),
    afternoon_impact: z.enum(['minimal', 'moderate', 'significant', 'severe'])
  }),
  safety_recommendations: z.array(z.string()),
  risk_level: z.enum(['low', 'moderate', 'high', 'severe'])
})

const NewsAnalysisSchema = z.object({
  local_news: z.array(z.object({
    source: z.string(),
    headline: z.string(),
    summary: z.string(),
    relevance: z.enum(['high', 'medium', 'low']),
    url: z.string().optional()
  })),
  school_district_signals: z.object({
    official_announcements: z.array(z.string()),
    early_dismissal_history: z.boolean(),
    neighboring_district_closures: z.array(z.string())
  }),
  community_intel: z.object({
    social_media_sentiment: z.enum(['expecting_closure', 'uncertain', 'expecting_school', 'no_buzz']),
    reported_road_conditions: z.array(z.string()),
    power_outage_reports: z.boolean(),
    local_event_cancellations: z.array(z.string())
  }),
  key_findings_summary: z.string()
})

// Schema for Infrastructure Monitor Agent
const InfrastructureAnalysisSchema = z.object({
  road_clearing_status: z.object({
    state_highways: z.object({
      status: z.enum(['clear', 'partially_covered', 'snow_covered', 'ice_covered', 'impassable']),
      plow_activity_level: z.enum(['heavy', 'moderate', 'light', 'none']),
      estimated_clear_time: z.string(),
      score: z.number().min(1).max(10)
    }),
    county_roads: z.object({
      status: z.enum(['clear', 'partially_covered', 'snow_covered', 'ice_covered', 'impassable']),
      plow_activity_level: z.enum(['heavy', 'moderate', 'light', 'none']),
      estimated_clear_time: z.string(),
      score: z.number().min(1).max(10)
    }),
    local_streets: z.object({
      status: z.enum(['clear', 'partially_covered', 'snow_covered', 'ice_covered', 'impassable']),
      plow_activity_level: z.enum(['heavy', 'moderate', 'light', 'none']),
      estimated_clear_time: z.string(),
      score: z.number().min(1).max(10)
    }),
    parking_lots: z.object({
      status: z.enum(['clear', 'partially_cleared', 'not_started', 'unknown']),
      estimated_clear_time: z.string(),
      score: z.number().min(1).max(10)
    })
  }),
  resource_levels: z.object({
    salt_sand_supply: z.enum(['adequate', 'moderate', 'low', 'critical']),
    plow_fleet_status: z.enum(['full_deployment', 'partial', 'limited', 'breakdown_issues']),
    driver_availability: z.enum(['full_staffing', 'moderate', 'understaffed'])
  }),
  municipal_response_level: z.enum(['aggressive', 'normal', 'limited', 'overwhelmed']),
  clearing_timeline: z.object({
    snow_end_time: z.string(),
    hours_until_bus_routes: z.number(),
    estimated_road_condition_at_6_30_am: z.string(),
    confidence_in_estimate: z.enum(['high', 'moderate', 'low'])
  }),
  overall_clearing_assessment: z.string(),
  data_confidence: z.enum(['high', 'moderate', 'low', 'very_low']),
  data_sources: z.array(z.string()),
  key_concerns: z.array(z.string())
})

// Schema for Power Grid Analyst Agent
const PowerGridAnalysisSchema = z.object({
  current_outages: z.object({
    total_customers_affected: z.number(),
    outages_in_school_district: z.enum(['none', 'some', 'significant', 'unknown']),
    affected_areas: z.array(z.string()),
    cause: z.enum(['storm_damage', 'equipment_failure', 'high_demand', 'ice_accumulation', 'unknown', 'none'])
  }),
  outage_trend: z.enum(['increasing', 'stable', 'decreasing', 'new_event', 'none']),
  grid_stress_level: z.enum(['normal', 'elevated', 'high', 'critical']),
  heating_demand: z.object({
    demand_level: z.enum(['normal', 'elevated', 'high', 'extreme']),
    overnight_low_f: z.number(),
    wind_chill_impact: z.enum(['minimal', 'moderate', 'significant']),
    extended_cold_concern: z.boolean()
  }),
  school_facility_risk: z.object({
    schools_without_power: z.enum(['none', 'some', 'unknown']),
    schools_in_outage_areas: z.array(z.string()),
    traffic_signals_affected: z.boolean(),
    estimated_restoration_time: z.string(),
    risk_level: z.enum(['low', 'moderate', 'high', 'severe'])
  }),
  restoration_estimate: z.object({
    estimated_hours_to_restore: z.number(),
    factors_affecting_restoration: z.array(z.string()),
    utility_statements: z.string()
  }),
  overall_grid_assessment: z.string(),
  data_confidence: z.enum(['high', 'moderate', 'low', 'very_low']),
  data_sources: z.array(z.string()),
  special_alerts: z.array(z.string())
})

// Schema for Web Weather Verifier Agent
const WebWeatherVerifierSchema = z.object({
  weather_sources: z.array(z.object({
    source_name: z.string(),
    url: z.string(),
    current_temp_f: z.number(),
    feels_like_temp_f: z.number(),
    forecast_feels_like_f: z.number(),
    snowfall_forecast_inches: z.number(),
    wind_speed_mph: z.number(),
    alerts: z.array(z.string()),
    data_timestamp: z.string(),
    reliability: z.enum(['high', 'medium', 'low'])
  })),
  api_comparison: z.object({
    api_feels_like_f: z.number(),
    web_average_feels_like_f: z.number(),
    difference_f: z.number(),
    api_temp_f: z.number(),
    web_average_temp_f: z.number(),
    temp_difference_f: z.number(),
    snowfall_difference_inches: z.number()
  }),
  critical_alerts: z.array(z.object({
    severity: z.enum(['critical', 'warning', 'info']),
    message: z.string(),
    affected_parameter: z.string()
  })),
  discrepancy_analysis: z.object({
    major_discrepancies_found: z.boolean(),
    feels_like_below_minus_20: z.boolean(),
    consensus_level: z.enum(['strong', 'moderate', 'weak', 'conflicting']),
    reliability_score: z.number().min(0).max(100),
    data_freshness: z.enum(['current', 'recent', 'stale', 'unknown'])
  }),
  verification_summary: z.string(),
  recommendation: z.enum(['trust_api', 'trust_web', 'investigate_further', 'use_average'])
})

const FinalPredictionSchema = z.object({
  snow_day_probability: z.number().min(0).max(100),
  confidence_level: z.enum(['very_low', 'low', 'moderate', 'high', 'very_high']),
  primary_factors: z.array(z.string()),
  timeline: z.object({
    conditions_start: z.string(),
    peak_impact_time: z.string(),
    conditions_improve: z.string()
  }),
  decision_rationale: z.string(),
  alternative_scenarios: z.array(z.object({
    scenario: z.string(),
    probability: z.number().min(0).max(100),
    impact: z.string()
  })),
  recommendations: z.object({
    for_schools: z.array(z.string()),
    for_residents: z.array(z.string()),
    for_authorities: z.array(z.string())
  }),
  updates_needed: z.boolean(),
  next_evaluation_time: z.string()
})

// ============================================================================
// WEB VERIFIER GUARDRAILS (deterministic sanity checks)
// ============================================================================

function getHostname(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string' || rawUrl === 'provided_by_user') {
    return ''
  }
  try {
    return new URL(rawUrl).hostname.toLowerCase()
  } catch {
    return ''
  }
}

function getSourceProviderId(source) {
  const host = getHostname(source?.url)
  if (!host) {
    return source?.url === 'provided_by_user' ? 'weatherapi' : 'unknown'
  }

  if (host.endsWith('weather.com') || host.endsWith('wunderground.com')) return 'weather_company'
  if (host.endsWith('weather.gov') || host.endsWith('noaa.gov') || host.includes('forecast.weather.gov')) return 'nws'
  if (host.endsWith('accuweather.com')) return 'accuweather'
  if (host.endsWith('weatherapi.com')) return 'weatherapi'
  if (host.endsWith('weatherbug.com')) return 'weatherbug'
  return host
}

function isLikelyPointWeatherSource(source) {
  const host = getHostname(source?.url)
  const sourceName = String(source?.source_name || '').toLowerCase()

  if (!host) return false
  if (source?.url === 'provided_by_user') return false

  const trustedWeatherHosts = [
    'weather.com',
    'wunderground.com',
    'weather.gov',
    'noaa.gov',
    'accuweather.com',
    'weatherapi.com',
    'weatherbug.com'
  ]

  if (trustedWeatherHosts.some(domain => host.endsWith(domain))) return true
  if (sourceName.includes('weather') && !host.includes('news')) return true
  return false
}

function isLikelyStaleTimestamp(rawTimestamp) {
  const ts = String(rawTimestamp || '').toLowerCase()
  if (!ts) return false
  if (ts.includes('stale') || ts.includes('unknown') || ts.includes('yesterday')) return true

  const dayMatch = ts.match(/(\d+)\s*day/)
  if (dayMatch && Number(dayMatch[1]) >= 1) return true
  return false
}

function normalizeReliabilityScore(score) {
  if (typeof score !== 'number' || Number.isNaN(score)) return 50
  const normalized = score <= 1 ? score * 100 : score
  return Math.max(0, Math.min(100, Math.round(normalized * 10) / 10))
}

function round1(value) {
  return Math.round(value * 10) / 10
}

function sanitizeWebWeatherVerification(rawAnalysis) {
  if (!rawAnalysis || typeof rawAnalysis !== 'object') return rawAnalysis

  const analysis = JSON.parse(JSON.stringify(rawAnalysis))
  const weatherSources = Array.isArray(analysis.weather_sources) ? analysis.weather_sources : []

  const evaluatedSources = weatherSources.map(source => {
    const providerId = getSourceProviderId(source)
    const reliability = String(source?.reliability || '').toLowerCase()
    const forecastFeelsLike = Number(source?.forecast_feels_like_f)
    const isExtreme = Number.isFinite(forecastFeelsLike) && forecastFeelsLike <= -20
    const isStale = isLikelyStaleTimestamp(source?.data_timestamp)
    const isPointWeather = isLikelyPointWeatherSource(source)
    const isConfirmable = isPointWeather && !isStale && reliability !== 'low' && providerId !== 'weatherapi'
    return {
      source,
      providerId,
      forecastFeelsLike,
      isExtreme,
      isConfirmable,
      isPointWeather,
      isStale
    }
  })

  const confirmableExtremeSources = evaluatedSources.filter(entry => entry.isConfirmable && entry.isExtreme)
  const extremeProviders = new Set(confirmableExtremeSources.map(entry => entry.providerId))
  const hasNwsExtreme = confirmableExtremeSources.some(entry => entry.providerId === 'nws')
  const confirmedExtreme = hasNwsExtreme || extremeProviders.size >= 2
  const singleSourceExtreme = !confirmedExtreme && extremeProviders.size === 1

  const usableForAverage = evaluatedSources.filter(entry => entry.isConfirmable && Number.isFinite(entry.forecastFeelsLike))
  const apiFeelsLike = Number(analysis?.api_comparison?.api_feels_like_f)
  if (usableForAverage.length > 0 && Number.isFinite(apiFeelsLike) && analysis.api_comparison) {
    const webAverage = round1(
      usableForAverage.reduce((sum, entry) => sum + entry.forecastFeelsLike, 0) / usableForAverage.length
    )
    analysis.api_comparison.web_average_feels_like_f = webAverage
    analysis.api_comparison.difference_f = round1(Math.abs(apiFeelsLike - webAverage))
  }

  if (!analysis.discrepancy_analysis) {
    analysis.discrepancy_analysis = {
      major_discrepancies_found: false,
      feels_like_below_minus_20: false,
      consensus_level: 'weak',
      reliability_score: 50,
      data_freshness: 'unknown'
    }
  }

  analysis.discrepancy_analysis.reliability_score = normalizeReliabilityScore(
    Number(analysis.discrepancy_analysis.reliability_score)
  )

  if (!confirmedExtreme) {
    analysis.discrepancy_analysis.feels_like_below_minus_20 = false
  }

  if (singleSourceExtreme) {
    analysis.discrepancy_analysis.consensus_level = 'conflicting'
  }

  if (
    typeof analysis.api_comparison?.difference_f === 'number' &&
    Math.abs(analysis.api_comparison.difference_f) > 10
  ) {
    analysis.discrepancy_analysis.major_discrepancies_found = true
  }

  if (!Array.isArray(analysis.critical_alerts)) {
    analysis.critical_alerts = []
  }

  if (singleSourceExtreme) {
    const existingSingleSourceAlert = analysis.critical_alerts.some(alert =>
      String(alert?.message || '').includes('SINGLE-SOURCE EXTREME WIND CHILL')
    )
    if (!existingSingleSourceAlert) {
      const sourceNames = [...new Set(confirmableExtremeSources.map(entry => entry.source.source_name))].join(', ')
      const minExtreme = Math.min(...confirmableExtremeSources.map(entry => entry.forecastFeelsLike))
      analysis.critical_alerts.push({
        severity: 'warning',
        affected_parameter: 'feels_like',
        message:
          `SINGLE-SOURCE EXTREME WIND CHILL: ${sourceNames || 'one provider'} shows ${minExtreme}F, ` +
          'but this is not confirmed by NWS or a second independent weather provider.'
      })
    }
  }

  if (!confirmedExtreme && analysis.recommendation === 'trust_web') {
    analysis.recommendation = 'investigate_further'
  }

  const guardrailSummary = confirmedExtreme
    ? 'Guardrail check: <=-20F wind chill is confirmed by NWS or multiple independent providers.'
    : 'Guardrail check: <=-20F wind chill is NOT confirmed by NWS or multiple independent providers.'
  analysis.verification_summary = `${analysis.verification_summary}\n\n${guardrailSummary}`

  return analysis
}

// ============================================================================
// COLLABORATION CONFIGURATION
// ============================================================================

const COLLABORATION_CONFIG = {
  maxRounds: 5,           // Hard cap on debate rounds
  consensusThreshold: 10, // Agents within ±10% = consensus
  enableDebate: true      // Enable multi-round debate
}

// Schema for agents to provide probability estimates during debate rounds
const DebatePositionSchema = z.object({
  snow_day_probability: z.number().min(0).max(100).describe('Your current probability estimate'),
  confidence: z.number().min(0).max(100).describe('How confident are you in this estimate (0-100)'),
  key_factors: z.array(z.string()).describe('Top 3-5 factors driving your estimate'),
  rationale: z.string().describe('Brief explanation of your reasoning'),
  challenges: z.array(z.object({
    target_agent: z.enum(['meteorology', 'history', 'safety', 'news']).describe('Which agent you are challenging'),
    challenge: z.string().describe('What you disagree with or want clarification on'),
    impact: z.enum(['high', 'medium', 'low']).describe('How much this affects your estimate')
  })).optional().describe('Any challenges or questions for other agents'),
  adjustments_from_peer_input: z.string().optional().describe('How peer analyses changed your thinking this round')
})

// ============================================================================
// AGENTS-AS-TOOLS CONTEXT (module-level state for tool callbacks)
// ============================================================================

let _currentWeatherContext = ''
let _currentExpertAnalyses = {
  meteorology: null,
  history: null,
  safety: null,
  news: null,
  infrastructure: null,
  powerGrid: null,
  webWeatherVerifier: null
}

// ============================================================================
// SPECIALIST AGENTS (used internally and as tools for coordinator)
// ============================================================================

const meteorologistAgent = new Agent({
  name: 'Chief Meteorologist',
  instructions: meteorologistPrompt,
  model: 'gpt-5.2',
  tools: [webSearchTool(), codeInterpreterTool()],
  outputType: WeatherAnalysisSchema
})

const historianAgent = new Agent({
  name: 'Weather Pattern Historian',
  instructions: historianPrompt,
  model: 'gpt-5.2',
  tools: [webSearchTool(), codeInterpreterTool()],
  outputType: HistoricalAnalysisSchema
})

const safetyAnalystAgent = new Agent({
  name: 'Transportation Safety Analyst',
  instructions: safetyAnalystPrompt,
  model: 'gpt-5.2',
  tools: [webSearchTool(), codeInterpreterTool()],
  outputType: SafetyAnalysisSchema
})

const newsIntelAgent = new Agent({
  name: 'Local News Intelligence',
  instructions: newsIntelPrompt,
  model: 'gpt-5.2',
  tools: [webSearchTool()],
  outputType: NewsAnalysisSchema
})

// Infrastructure Monitor Agent
const infrastructureMonitorAgent = new Agent({
  name: 'Regional Infrastructure Monitor',
  instructions: infrastructureMonitorPrompt,
  model: 'gpt-5.2',
  tools: [webSearchTool()],
  outputType: InfrastructureAnalysisSchema
})

// Power Grid Analyst Agent
const powerGridAnalystAgent = new Agent({
  name: 'Power Grid Analyst',
  instructions: powerGridAnalystPrompt,
  model: 'gpt-5.2',
  tools: [webSearchTool()],
  outputType: PowerGridAnalysisSchema
})

// Web Weather Verifier Agent
const webWeatherVerifierAgent = new Agent({
  name: 'Web Weather Verifier',
  instructions: webWeatherVerifierPrompt,
  model: 'gpt-5.2',
  tools: [webSearchTool()],
  outputType: WebWeatherVerifierSchema
})

// Debate agent for providing probability estimates during collaboration rounds
const debateAgent = new Agent({
  name: 'Debate Position Agent',
  instructions: `You are participating in a collaborative debate about snow day probability.
Review the weather data and peer analyses, then provide your position with a probability estimate.
Be willing to adjust your estimate based on peer input and challenges.
Focus on constructive disagreement - challenge assumptions, not conclusions.`,
  model: 'gpt-5.2',
  tools: [webSearchTool()],
  outputType: DebatePositionSchema
})

// ============================================================================
// AGENTS-AS-TOOLS: Coordinator can consult specialists on-demand
// ============================================================================

const askMeteorologist = tool({
  name: 'ask_meteorologist',
  description: 'Ask the Chief Meteorologist a specific follow-up question about weather conditions, temperature trends, precipitation timing, wind patterns, or visibility.',
  parameters: z.object({
    question: z.string().describe('The specific question to ask the meteorologist')
  }),
  execute: async ({ question }) => {
    console.log('🌡️ Coordinator consulting meteorologist:', question)
    const context = _currentExpertAnalyses.meteorology 
      ? `Your previous analysis: ${JSON.stringify(_currentExpertAnalyses.meteorology, null, 2)}\n\n`
      : ''
    const result = await run(meteorologistAgent, `${context}Weather context:\n${_currentWeatherContext}\n\nFollow-up question: ${question}`)
    return JSON.stringify(result.finalOutput, null, 2)
  }
})

const askHistorian = tool({
  name: 'ask_historian',
  description: 'Ask the Weather Pattern Historian about historical patterns, past similar events, or climatological context.',
  parameters: z.object({
    question: z.string().describe('The specific question to ask the historian')
  }),
  execute: async ({ question }) => {
    console.log('📚 Coordinator consulting historian:', question)
    const context = _currentExpertAnalyses.history 
      ? `Your previous analysis: ${JSON.stringify(_currentExpertAnalyses.history, null, 2)}\n\n`
      : ''
    const result = await run(historianAgent, `${context}Weather context:\n${_currentWeatherContext}\n\nFollow-up question: ${question}`)
    return JSON.stringify(result.finalOutput, null, 2)
  }
})

const askSafetyAnalyst = tool({
  name: 'ask_safety_analyst',
  description: 'Ask the Transportation Safety Analyst about road conditions, plow timing, commute safety, or travel risks.',
  parameters: z.object({
    question: z.string().describe('The specific question to ask the safety analyst')
  }),
  execute: async ({ question }) => {
    console.log('🚗 Coordinator consulting safety analyst:', question)
    const context = _currentExpertAnalyses.safety 
      ? `Your previous analysis: ${JSON.stringify(_currentExpertAnalyses.safety, null, 2)}\n\n`
      : ''
    const result = await run(safetyAnalystAgent, `${context}Weather context:\n${_currentWeatherContext}\n\nFollow-up question: ${question}`)
    return JSON.stringify(result.finalOutput, null, 2)
  }
})

const askNewsIntel = tool({
  name: 'ask_news_intel',
  description: 'Ask the News Intelligence Agent to search for specific local information - neighboring district closures, community sentiment, road reports, or school announcements.',
  parameters: z.object({
    question: z.string().describe('The specific search or question for the news intel agent')
  }),
  execute: async ({ question }) => {
    console.log('📰 Coordinator consulting news intel:', question)
    const context = _currentExpertAnalyses.news 
      ? `Your previous analysis: ${JSON.stringify(_currentExpertAnalyses.news, null, 2)}\n\n`
      : ''
    const result = await run(newsIntelAgent, `${context}Follow-up request: ${question}`)
    return JSON.stringify(result.finalOutput, null, 2)
  }
})

const crossCheckExperts = tool({
  name: 'cross_check_experts',
  description: 'Ask two or more specialists to cross-check each other\'s analyses. Use when you see potential conflicts or want validation.',
  parameters: z.object({
    experts: z.array(z.enum(['meteorologist', 'historian', 'safety_analyst', 'news_intel', 'infrastructure_monitor', 'power_grid_analyst', 'web_weather_verifier'])).min(2).describe('Which experts to cross-check'),
    question: z.string().describe('The specific aspect to cross-check or validate')
  }),
  execute: async ({ experts, question }) => {
    console.log('🔄 Coordinator cross-checking experts:', experts.join(', '), '-', question)
    const expertMap = {
      meteorologist: { agent: meteorologistAgent, analysis: _currentExpertAnalyses.meteorology },
      historian: { agent: historianAgent, analysis: _currentExpertAnalyses.history },
      safety_analyst: { agent: safetyAnalystAgent, analysis: _currentExpertAnalyses.safety },
      news_intel: { agent: newsIntelAgent, analysis: _currentExpertAnalyses.news },
      infrastructure_monitor: { agent: infrastructureMonitorAgent, analysis: _currentExpertAnalyses.infrastructure },
      power_grid_analyst: { agent: powerGridAnalystAgent, analysis: _currentExpertAnalyses.powerGrid },
      web_weather_verifier: { agent: webWeatherVerifierAgent, analysis: _currentExpertAnalyses.webWeatherVerifier }
    }
    
    const combinedContext = experts.map(e => {
      const data = expertMap[e]
      return `${e.toUpperCase()} ANALYSIS:\n${JSON.stringify(data.analysis, null, 2)}`
    }).join('\n\n')
    
    const primaryExpert = expertMap[experts[0]]
    const result = await run(
      primaryExpert.agent,
      `Cross-check request. Here are the analyses from multiple experts:\n\n${combinedContext}\n\nWeather context:\n${_currentWeatherContext}\n\nQuestion to validate: ${question}\n\nProvide your perspective on this cross-check.`
    )
    return JSON.stringify(result.finalOutput, null, 2)
  }
})

const askInfrastructureMonitor = tool({
  name: 'ask_infrastructure_monitor',
  description: 'Ask the Infrastructure Monitor about road clearing status, plow operations, MDOT conditions, county road commission updates, or municipal response.',
  parameters: z.object({
    question: z.string().describe('The specific question about road clearing or infrastructure')
  }),
  execute: async ({ question }) => {
    console.log('🚜 Coordinator consulting infrastructure monitor:', question)
    const context = _currentExpertAnalyses.infrastructure 
      ? `Your previous analysis: ${JSON.stringify(_currentExpertAnalyses.infrastructure, null, 2)}\n\n`
      : ''
    const result = await run(infrastructureMonitorAgent, `${context}Weather context:\n${_currentWeatherContext}\n\nFollow-up question: ${question}`)
    return JSON.stringify(result.finalOutput, null, 2)
  }
})

const askPowerGridAnalyst = tool({
  name: 'ask_power_grid_analyst',
  description: 'Ask the Power Grid Analyst about power outages, grid stress, utility restoration timelines, or school facility power status.',
  parameters: z.object({
    question: z.string().describe('The specific question about power grid or utility status')
  }),
  execute: async ({ question }) => {
    console.log('⚡ Coordinator consulting power grid analyst:', question)
    const context = _currentExpertAnalyses.powerGrid 
      ? `Your previous analysis: ${JSON.stringify(_currentExpertAnalyses.powerGrid, null, 2)}\n\n`
      : ''
    const result = await run(powerGridAnalystAgent, `${context}Weather context:\n${_currentWeatherContext}\n\nFollow-up question: ${question}`)
    return JSON.stringify(result.finalOutput, null, 2)
  }
})

const askWebWeatherVerifier = tool({
  name: 'ask_web_weather_verifier',
  description: 'Ask the Web Weather Verifier to check additional weather sources, verify feels-like temperatures, or investigate discrepancies in weather data. Use this to resolve conflicts, not to lock on a single source.',
  parameters: z.object({
    question: z.string().describe('The specific verification request or question about weather data')
  }),
  execute: async ({ question }) => {
    const initialAnalysis = _currentExpertAnalyses.webWeatherVerifier
    console.log('🔍 Coordinator consulting web weather verifier:', question)
    const context = initialAnalysis
      ? `Your previous analysis: ${JSON.stringify(initialAnalysis, null, 2)}\n\n` +
        'If <=-20F wind chill was reported by only one source, re-check with independent providers and NWS before confirming the threshold.\n\n'
      : ''
    const result = await run(webWeatherVerifierAgent, `${context}Weather context:\n${_currentWeatherContext}\n\nFollow-up question: ${question}`)
    return JSON.stringify(result.finalOutput, null, 2)
  }
})

// ============================================================================
// DECISION COORDINATOR (with agents-as-tools)
// ============================================================================

const decisionCoordinatorAgent = new Agent({
  name: 'Snow Day Decision Coordinator',
  instructions: coordinatorPrompt + `

## AGENT CONSULTATION TOOLS

You have direct access to consult your specialist team for follow-up questions:

- **ask_meteorologist**: Get clarification on weather data, timing, precipitation types
- **ask_historian**: Explore historical patterns, ask "has this happened before?"
- **ask_safety_analyst**: Deep-dive on road conditions, plow timing math, commute risks
- **ask_news_intel**: Search for latest local news, district announcements, community buzz
- **ask_infrastructure_monitor**: Check real-time plow operations, MDOT conditions, road clearing status
- **ask_power_grid_analyst**: Check power outages, grid stress, utility restoration timelines
- **ask_web_weather_verifier**: Verify weather data against multiple sources, especially wind chill
- **cross_check_experts**: Have experts validate each other's analyses

USE THESE TOOLS when:
1. You see a conflict between expert analyses
2. You need more detail on a specific aspect
3. You want to validate your reasoning
4. Something doesn't add up and you need clarification
5. You want to confirm neighboring district status is current
6. Infrastructure or power grid data seems stale or incomplete
7. You need to verify if wind chill is truly below -20°F

CRITICAL OUTPUT REQUIREMENT:
You MUST respond with a JSON object matching this EXACT structure:
{
  "snow_day_probability": <number 0-100>,
  "confidence_level": <"very_low"|"low"|"moderate"|"high"|"very_high">,
  "primary_factors": [<array of strings>],
  "timeline": {
    "conditions_start": <string>,
    "peak_impact_time": <string>,
    "conditions_improve": <string>
  },
  "decision_rationale": <string explaining your reasoning>,
  "alternative_scenarios": [{"scenario": <string>, "probability": <number>, "impact": <string>}],
  "recommendations": {
    "for_schools": [<array of strings>],
    "for_residents": [<array of strings>],
    "for_authorities": [<array of strings>]
  },
  "updates_needed": <boolean>,
  "next_evaluation_time": <ISO datetime string>
}

DO NOT return temperature_analysis, precipitation_analysis, or raw weather data.
Return ONLY the prediction decision structure above.`,
  model: 'gpt-5.2',
  tools: [askMeteorologist, askHistorian, askSafetyAnalyst, askNewsIntel, askInfrastructureMonitor, askPowerGridAnalyst, askWebWeatherVerifier, crossCheckExperts],
  outputType: FinalPredictionSchema
})

// ============================================================================
// COLLABORATIVE DEBATE SYSTEM
// ============================================================================

/**
 * Extract probability estimate from agent analysis
 */
function extractProbabilityFromAnalysis(agentId, analysis) {
  if (!analysis || typeof analysis !== 'object') return 50 // Default uncertainty

  switch (agentId) {
    case 'meteorology':
      const precip = analysis.precipitation_analysis
      if (precip) {
        const snowProb = precip.snow_probability_morning || precip.snow_probability_overnight || 0
        const snowfall = precip.total_snowfall_inches || 0
        if (snowfall >= 8) return Math.min(snowProb + 30, 95)
        if (snowfall >= 6) return Math.min(snowProb + 15, 85)
        return snowProb || 50
      }
      return 50

    case 'history':
      const patterns = analysis.similar_weather_patterns
      if (patterns && patterns.length > 0) {
        return patterns[0].historical_snow_day_rate || 50
      }
      return 50

    case 'safety':
      const riskLevel = analysis.risk_level
      const riskMap = { low: 15, moderate: 40, high: 70, severe: 90 }
      return riskMap[riskLevel] || 50

    case 'news':
      const sentiment = analysis.community_intel?.social_media_sentiment
      const sentimentMap = {
        expecting_closure: 75,
        uncertain: 50,
        expecting_school: 25,
        no_buzz: 40
      }
      const closures = analysis.school_district_signals?.neighboring_district_closures?.length || 0
      const closureBoost = closures * 10
      return Math.min((sentimentMap[sentiment] || 50) + closureBoost, 95)

    default:
      return 50
  }
}

/**
 * Calculate probability spread across all agent positions
 */
function calculateProbabilitySpread(positions) {
  if (positions.length === 0) return 0
  const probs = positions.map(p => p.probability)
  return Math.max(...probs) - Math.min(...probs)
}

/**
 * Check if consensus has been reached
 */
function checkConsensus(positions, threshold) {
  const spread = calculateProbabilitySpread(positions)
  return spread <= threshold * 2 // ±threshold means total spread of 2*threshold
}

/**
 * Run a single debate round where agents review peer analyses and provide updated positions
 */
async function runDebateRound(roundNumber, previousPositions, weatherContext, expertAnalyses) {
  const agentIds = ['meteorology', 'history', 'safety', 'news']
  
  const peerContext = previousPositions.length > 0 
    ? `\n\nPREVIOUS ROUND POSITIONS:\n${previousPositions.map(p => 
        `- ${p.agentId}: ${p.probability}% (confidence: ${p.confidence}%) - ${p.rationale}`
      ).join('\n')}`
    : ''

  const positionPromises = agentIds.map(async (agentId) => {
    const agentAnalysis = expertAnalyses[agentId]
    const prompt = `DEBATE ROUND ${roundNumber}

You are the ${agentId.toUpperCase()} specialist. Review all analyses and provide your snow day probability estimate.

WEATHER CONTEXT:
${weatherContext}

YOUR ANALYSIS:
${JSON.stringify(agentAnalysis, null, 2)}

ALL EXPERT ANALYSES:
${Object.entries(expertAnalyses).map(([id, analysis]) => 
  `${id.toUpperCase()}:\n${JSON.stringify(analysis, null, 2)}`
).join('\n\n')}
${peerContext}

Based on your expertise and the peer analyses, provide:
1. Your probability estimate (0-100%)
2. Your confidence in that estimate (0-100%)
3. Key factors driving your estimate
4. Any challenges for other agents whose analyses concern you

${roundNumber > 1 ? 'Consider how peer positions might inform your estimate. Be willing to adjust if others raise valid points.' : ''}`

    try {
      const result = await run(debateAgent, prompt)
      const output = result.finalOutput
      return {
        agentId,
        probability: output.snow_day_probability,
        confidence: output.confidence,
        rationale: output.rationale,
        keyFactors: output.key_factors,
        challenges: output.challenges || []
      }
    } catch (error) {
      console.warn(`⚠️ Debate agent failed for ${agentId}, using fallback:`, error.message)
      const prob = extractProbabilityFromAnalysis(agentId, agentAnalysis)
      return {
        agentId,
        probability: prob,
        confidence: 60,
        rationale: `Based on ${agentId} analysis`,
        keyFactors: ['Derived from primary analysis'],
        challenges: []
      }
    }
  })

  const positionsWithChallenges = await Promise.all(positionPromises)
  
  const debates = []
  for (const position of positionsWithChallenges) {
    if (position.challenges && position.challenges.length > 0) {
      for (const challenge of position.challenges) {
        debates.push({
          round: roundNumber,
          topic: challenge.challenge,
          challenger: position.agentId,
          challenged: challenge.target_agent,
          challenge: challenge.challenge,
          response: '',
          resolution: 'disagreed',
          probabilityShift: 0
        })
      }
    }
  }

  const positions = positionsWithChallenges.map(p => ({
    agentId: p.agentId,
    probability: p.probability,
    confidence: p.confidence,
    rationale: p.rationale,
    keyFactors: p.keyFactors
  }))

  return { positions, debates }
}

/**
 * Run the full collaborative debate system with consensus detection
 */
async function runCollaborativeDebate(weatherContext, expertAnalyses) {
  const { maxRounds, consensusThreshold } = COLLABORATION_CONFIG
  const rounds = []
  let previousPositions = []
  let consensusReached = false
  let exitReason = 'max_rounds'

  console.log(`🤝 Starting collaborative debate (max ${maxRounds} rounds, consensus at ±${consensusThreshold}%)...`)

  const initialPositions = {}

  for (let round = 1; round <= maxRounds; round++) {
    console.log(`📢 Debate round ${round}/${maxRounds}...`)
    
    try {
      const { positions, debates } = await runDebateRound(
        round,
        previousPositions,
        weatherContext,
        expertAnalyses
      )

      if (round === 1) {
        positions.forEach(p => {
          initialPositions[p.agentId] = p.probability
        })
      }

      const spread = calculateProbabilitySpread(positions)
      consensusReached = checkConsensus(positions, consensusThreshold)

      const roundData = {
        round,
        timestamp: new Date().toISOString(),
        positions,
        probabilitySpread: spread,
        consensusReached,
        debates,
        roundSummary: `Round ${round}: Spread ${spread.toFixed(1)}% | ${consensusReached ? 'CONSENSUS REACHED' : 'Continuing debate'}`
      }

      rounds.push(roundData)
      previousPositions = positions

      console.log(`   Spread: ${spread.toFixed(1)}% | Consensus: ${consensusReached ? 'YES ✓' : 'NO'}`)

      if (consensusReached) {
        exitReason = 'consensus'
        console.log(`✅ Consensus reached after ${round} round(s)!`)
        break
      }
    } catch (error) {
      console.error(`❌ Debate round ${round} failed:`, error)
      exitReason = 'error'
      break
    }
  }

  const lastPositions = previousPositions.length > 0 ? previousPositions : []
  const confidenceJourney = lastPositions.map(p => ({
    agentId: p.agentId,
    initialProbability: initialPositions[p.agentId] || p.probability,
    finalProbability: p.probability,
    totalShift: p.probability - (initialPositions[p.agentId] || p.probability),
    shiftReason: p.rationale
  }))

  const keyDisagreements = rounds
    .flatMap(r => r.debates)
    .filter(d => d.probabilityShift !== 0 || d.resolution === 'disagreed')
    .slice(0, 5)
    .map(d => ({
      topic: d.topic,
      agents: [d.challenger, d.challenged],
      positions: [d.challenge, d.response],
      resolution: d.resolution,
      impact: 'medium'
    }))

  const avgProbability = lastPositions.length > 0
    ? lastPositions.reduce((sum, p) => sum + p.probability, 0) / lastPositions.length
    : 50
  const finalSpread = calculateProbabilitySpread(lastPositions)

  const collaborationSummary = exitReason === 'consensus'
    ? `Agents reached consensus after ${rounds.length} round(s) with ${finalSpread.toFixed(1)}% spread. Average probability: ${avgProbability.toFixed(0)}%.`
    : exitReason === 'max_rounds'
    ? `Debate completed after ${maxRounds} rounds without full consensus. Final spread: ${finalSpread.toFixed(1)}%. Average probability: ${avgProbability.toFixed(0)}%.`
    : `Debate ended due to error after ${rounds.length} round(s).`

  return {
    totalRounds: rounds.length,
    maxRoundsAllowed: maxRounds,
    consensusThreshold,
    finalConsensus: consensusReached,
    exitReason,
    rounds,
    confidenceJourney,
    keyDisagreements,
    collaborationSummary
  }
}

// ============================================================================
// MULTI-AGENT ORCHESTRATION
// ============================================================================

async function runAgentPrediction(weatherData, targetDate, daysAhead) {
  const location = `${weatherData.location.name}, ${weatherData.location.region}`
  const targetDateStr = targetDate.toISOString().split('T')[0]
  const dayName = targetDate.toLocaleDateString('en-US', { weekday: 'long' })
  
  console.log(`📍 Analyzing conditions for ${location}`)
  console.log(`🎯 Target school day: ${dayName}, ${targetDateStr}`)
  
  // Extract the forecast for the target date
  const targetForecast = weatherData.forecast?.forecastday?.find(
    day => day.date === targetDateStr
  ) || weatherData.forecast?.forecastday?.[daysAhead - 1] || weatherData.forecast?.forecastday?.[0]
  
  const weatherContext = `
WEATHER DATA FOR ${location}:
TARGET SCHOOL DAY: ${dayName}, ${targetDateStr} (${daysAhead} day${daysAhead > 1 ? 's' : ''} from now)

FOCUS ON THIS DATE'S FORECAST:
${JSON.stringify(targetForecast, null, 2)}

FULL FORECAST DATA:
${JSON.stringify(weatherData, null, 2)}

Analyze these conditions for snow day prediction for ${dayName}, ${targetDateStr}.`

  // Run specialist agents in parallel for efficiency
  console.log('🔄 Running expert analysis agents in parallel...')
  const [meteorologyResult, historyResult, safetyResult, newsResult, infrastructureResult, powerGridResult, webWeatherVerifierResult] = await Promise.all([
    run(meteorologistAgent, weatherContext),
    run(historianAgent, `${weatherContext}\n\nProvide historical context for this location and time of year.`),
    run(safetyAnalystAgent, weatherContext),
    run(newsIntelAgent, `Search for any local news, social media signals, school district announcements, or community chatter about weather conditions and potential school closures in Rockford, Michigan and surrounding areas for ${dayName}, ${targetDateStr}. Look for signals from neighboring districts, local news stations, and community sentiment.`),
    run(infrastructureMonitorAgent, `${weatherContext}\n\nSearch for current road clearing operations and plow fleet status in Kent County and surrounding Michigan areas. Check MDOT road conditions, county road commission updates, and municipal response levels. Focus on whether roads will be passable by 6:30 AM when school buses start routes.`),
    run(powerGridAnalystAgent, `${weatherContext}\n\nSearch for current power outage information in the Rockford, Michigan and Kent County area. Check Consumers Energy outage maps, grid stress levels, and any utility statements. Assess whether power infrastructure will support normal school operations.`),
    run(webWeatherVerifierAgent, `${weatherContext}\n\nCross-reference the Weather API data against multiple web sources including Weather.com, Weather.gov, AccuWeather, and local weather pages for ${location}. CRITICAL: Verify "feels like" temperature data. Treat <=-20F as a confirmed threshold only when validated by NWS or at least two independent weather providers. Compare API forecasts with what the public is seeing on their weather apps.`)
  ])
  
  console.log('✅ Expert analyses complete (7 agents)')
  const sanitizedWebWeatherVerifier = sanitizeWebWeatherVerification(webWeatherVerifierResult.finalOutput)

  // Store context for agent tools
  _currentWeatherContext = weatherContext
  _currentExpertAnalyses = {
    meteorology: meteorologyResult.finalOutput,
    history: historyResult.finalOutput,
    safety: safetyResult.finalOutput,
    news: newsResult.finalOutput,
    infrastructure: infrastructureResult.finalOutput,
    powerGrid: powerGridResult.finalOutput,
    webWeatherVerifier: sanitizedWebWeatherVerifier
  }

  // Run collaborative debate if enabled
  let collaboration = null
  if (COLLABORATION_CONFIG.enableDebate) {
    collaboration = await runCollaborativeDebate(weatherContext, _currentExpertAnalyses)
  }
  
  // Include collaboration results in the coordinator's context
  const collaborationContext = collaboration 
    ? `\n\n## COLLABORATIVE DEBATE RESULTS
Rounds completed: ${collaboration.totalRounds}
Consensus reached: ${collaboration.finalConsensus ? 'YES' : 'NO'}
Exit reason: ${collaboration.exitReason}
Summary: ${collaboration.collaborationSummary}

Agent positions after debate:
${collaboration.rounds[collaboration.rounds.length - 1]?.positions.map(p => 
  `- ${p.agentId}: ${p.probability}% (${p.rationale})`
).join('\n') || 'No positions recorded'}

Key disagreements to resolve:
${collaboration.keyDisagreements.map(d => 
  `- ${d.topic} (${d.agents.join(' vs ')})`
).join('\n') || 'None identified'}
`
    : ''
  
  // Prepare context for decision coordinator
  const expertAnalyses = `
METEOROLOGICAL ANALYSIS:
${JSON.stringify(meteorologyResult.finalOutput, null, 2)}

HISTORICAL PATTERN ANALYSIS:
${JSON.stringify(historyResult.finalOutput, null, 2)}

SAFETY ASSESSMENT:
${JSON.stringify(safetyResult.finalOutput, null, 2)}

LOCAL NEWS & COMMUNITY INTELLIGENCE:
${JSON.stringify(newsResult.finalOutput, null, 2)}

INFRASTRUCTURE & ROAD CLEARING STATUS:
${JSON.stringify(infrastructureResult.finalOutput, null, 2)}

POWER GRID & UTILITY STATUS:
${JSON.stringify(powerGridResult.finalOutput, null, 2)}

WEB WEATHER VERIFICATION:
${JSON.stringify(sanitizedWebWeatherVerifier, null, 2)}
${collaborationContext}
LOCATION: ${location}
ANALYSIS TIMESTAMP: ${new Date().toISOString()}

---
REMINDER: You have tools to consult specialists for follow-up questions if needed:
- ask_meteorologist, ask_historian, ask_safety_analyst, ask_news_intel
- ask_infrastructure_monitor, ask_power_grid_analyst, ask_web_weather_verifier
- cross_check_experts
Use them if you need clarification or see conflicts in the analyses above.
`
  
  console.log('🎯 Running decision coordinator (with agent consultation tools)...')
  
  // Decision coordinator can now call agent tools for follow-ups
  const finalResult = await run(
    decisionCoordinatorAgent,
    `Based on the expert analyses provided below, make a final snow day prediction and recommendation.

Before finalizing, consider:
1. Do any expert analyses conflict? If so, use your tools to clarify.
2. Is the plow timing math clear? If not, ask the safety analyst or infrastructure monitor.
3. Are neighboring district closures confirmed? If uncertain, ask news intel.
4. Are there power outage concerns? Check with power grid analyst.
5. Does the web weather verifier confirm or contradict the API data on wind chill?
${collaboration ? `6. The agents debated for ${collaboration.totalRounds} round(s). Consider unresolved disagreements.` : ''}

Synthesize all inputs and provide a comprehensive decision with clear rationale and confidence levels.

${expertAnalyses}`
  )
  
  // Validate the final output matches expected schema
  let validatedFinal = finalResult.finalOutput
  const parseResult = FinalPredictionSchema.safeParse(validatedFinal)
  
  if (!parseResult.success) {
    console.warn('⚠️ Final output did not match expected schema, attempting to extract correct fields...')
    console.warn('Validation errors:', parseResult.error.issues)
    
    // Check if the model returned meteorology data instead of prediction data
    if (validatedFinal?.temperature_analysis || validatedFinal?.precipitation_analysis) {
      console.error('❌ Coordinator returned meteorology data instead of prediction schema!')
      console.log('🔄 Retrying coordinator with explicit schema reminder...')
      
      // Retry with explicit schema instructions
      const retryResult = await run(
        decisionCoordinatorAgent,
        `IMPORTANT: You must respond with a JSON object matching this EXACT structure:
{
  "snow_day_probability": <number 0-100>,
  "confidence_level": <"very_low"|"low"|"moderate"|"high"|"very_high">,
  "primary_factors": [<array of strings>],
  "timeline": {
    "conditions_start": <string>,
    "peak_impact_time": <string>,
    "conditions_improve": <string>
  },
  "decision_rationale": <string>,
  "alternative_scenarios": [{"scenario": <string>, "probability": <number>, "impact": <string>}],
  "recommendations": {
    "for_schools": [<array of strings>],
    "for_residents": [<array of strings>],
    "for_authorities": [<array of strings>]
  },
  "updates_needed": <boolean>,
  "next_evaluation_time": <string>
}

DO NOT return temperature_analysis, precipitation_analysis, or other meteorology data.
Return ONLY the prediction decision structure above.

Based on these expert analyses, provide your final snow day prediction:

${expertAnalyses}`
      )
      
      validatedFinal = retryResult.finalOutput
      const retryParseResult = FinalPredictionSchema.safeParse(validatedFinal)
      
      if (!retryParseResult.success) {
        console.error('❌ Retry also failed schema validation')
        console.error('Output received:', JSON.stringify(validatedFinal, null, 2).slice(0, 500))
        throw new Error('Coordinator agent repeatedly returned invalid schema. Check model and prompt configuration.')
      }
      
      console.log('✅ Retry succeeded with valid schema')
      validatedFinal = retryParseResult.data
    } else {
      // Try to use partial data with defaults
      console.warn('⚠️ Attempting to use partial data with defaults...')
      validatedFinal = {
        snow_day_probability: validatedFinal?.snow_day_probability ?? 0,
        confidence_level: validatedFinal?.confidence_level ?? 'low',
        primary_factors: validatedFinal?.primary_factors ?? ['Unable to parse prediction'],
        timeline: validatedFinal?.timeline ?? {
          conditions_start: 'Unknown',
          peak_impact_time: 'Unknown',
          conditions_improve: 'Unknown'
        },
        decision_rationale: validatedFinal?.decision_rationale ?? 'Prediction parsing failed - using fallback values',
        alternative_scenarios: validatedFinal?.alternative_scenarios ?? [],
        recommendations: validatedFinal?.recommendations ?? {
          for_schools: ['Check local conditions'],
          for_residents: ['Monitor weather updates'],
          for_authorities: ['Standard winter protocols']
        },
        updates_needed: true,
        next_evaluation_time: new Date(Date.now() + 3600000).toISOString()
      }
    }
  } else {
    validatedFinal = parseResult.data
  }
  
  console.log('✅ Multi-agent analysis complete!')
  
  return {
    meteorology: meteorologyResult.finalOutput,
    history: historyResult.finalOutput,
    safety: safetyResult.finalOutput,
    news: newsResult.finalOutput,
    infrastructure: infrastructureResult.finalOutput,
    powerGrid: powerGridResult.finalOutput,
    webWeatherVerifier: sanitizedWebWeatherVerifier,
    final: validatedFinal,
    collaboration, // Include collaboration data
    timestamp: new Date().toISOString(),
    targetDate: targetDateStr,
    targetDayName: dayName,
    daysAhead,
    location,
    raw_weather_data: weatherData
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  try {
    // Determine the next school day (skip weekends)
    const runTimestamp = new Date()
    const nextSchoolDay = getNextSchoolDay(runTimestamp, appConfig.timeZone)
    const daysAhead = getDaysUntilNextSchoolDay(runTimestamp, appConfig.timeZone)
    const nextSchoolDayStr = nextSchoolDay.toISOString().split('T')[0]
    const dayName = nextSchoolDay.toLocaleDateString('en-US', { weekday: 'long', timeZone: appConfig.timeZone })
    
    console.log(`📅 Next school day: ${dayName}, ${nextSchoolDayStr} (${daysAhead} day${daysAhead > 1 ? 's' : ''} ahead)`)
    
    // Initialize weather API
    const weatherAPI = new NodeWeatherAPI(appConfig.weatherApiKey, appConfig.zipCode)

    // Get weather data (fetch enough days to cover the next school day)
    const weatherData = await weatherAPI.getForecast(daysAhead)

    // Run multi-agent prediction using OpenAI Agents SDK
    const prediction = await runAgentPrediction(weatherData, nextSchoolDay, daysAhead)

    // Ensure output directory exists
    if (!existsSync(appConfig.outputDir)) {
      mkdirSync(appConfig.outputDir, { recursive: true })
      console.log(`📁 Created output directory: ${appConfig.outputDir}`)
    }

    // Write prediction to file
    const outputPath = join(appConfig.outputDir, appConfig.outputFile)
    writeFileSync(outputPath, JSON.stringify(prediction, null, 2))

    console.log('✅ Snow day prediction generated successfully!')
    console.log(`📄 Output saved to: ${outputPath}`)
    console.log(`🎯 Snow day probability: ${prediction.final.snow_day_probability}%`)
    console.log(`🔍 Confidence: ${prediction.final.confidence_level}`)
    console.log(`📍 Location: ${prediction.location}`)
    if (prediction.collaboration) {
      console.log(`🤝 Debate rounds: ${prediction.collaboration.totalRounds}`)
      console.log(`✅ Consensus: ${prediction.collaboration.finalConsensus ? 'YES' : 'NO'}`)
    }

    // Also create a simple summary for quick access
    const summary = {
      probability: prediction.final.snow_day_probability,
      confidence: prediction.final.confidence_level,
      primary_factors: prediction.final.primary_factors,
      decision_rationale: prediction.final.decision_rationale,
      timestamp: prediction.timestamp,
      targetDate: prediction.targetDate,
      targetDayName: prediction.targetDayName,
      daysAhead: prediction.daysAhead,
      location: prediction.location,
      // Collaboration summary
      collaboration: prediction.collaboration ? {
        rounds: prediction.collaboration.totalRounds,
        consensus: prediction.collaboration.finalConsensus,
        exitReason: prediction.collaboration.exitReason,
        summary: prediction.collaboration.collaborationSummary
      } : null
    }

    writeFileSync(
      join(appConfig.outputDir, 'summary.json'),
      JSON.stringify(summary, null, 2)
    )

    console.log('📊 Summary also saved to summary.json')

    // Update outcomes.json with pending prediction
    const outcomesPath = join(appConfig.outputDir, 'outcomes.json')
    let outcomes = []
    if (existsSync(outcomesPath)) {
      try {
        outcomes = JSON.parse(readFileSync(outcomesPath, 'utf8'))
      } catch (e) {
        console.warn('⚠️ Could not parse outcomes.json, starting fresh')
      }
    }

    // Use the target school day date (not the prediction timestamp)
    const predictionDate = prediction.targetDate
    
    // Check if we already have an entry for this date
    const existingIndex = outcomes.findIndex(o => o.date === predictionDate)
    
    const newEntry = {
      date: predictionDate,
      modelProbability: prediction.final.snow_day_probability,
      confidence: prediction.final.confidence_level,
      predictionTimestamp: prediction.timestamp,
      actualSnowDay: null, // Pending
      recordedAt: new Date().toISOString(),
      recordedBy: 'system',
      source: 'prediction'
    }

    if (existingIndex >= 0) {
      // Only update if actualSnowDay is null/undefined (pending)
      if (outcomes[existingIndex].actualSnowDay === null || outcomes[existingIndex].actualSnowDay === undefined) {
         outcomes[existingIndex] = { ...outcomes[existingIndex], ...newEntry }
         console.log('📝 Updated pending outcome in outcomes.json')
      } else {
         console.log('ℹ️ Outcome already finalized for today, skipping update to outcomes.json')
      }
    } else {
      outcomes.push(newEntry)
      console.log('➕ Added pending outcome to outcomes.json')
    }
    
    // Sort by date descending
    outcomes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    writeFileSync(outcomesPath, JSON.stringify(outcomes, null, 2))
    console.log('📚 History updated in outcomes.json')

  } catch (error) {
    console.error('❌ Prediction generation failed:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// Run the script
main()
  .then(async () => {
    // After successful prediction generation, trigger deploy (unless --no-deploy flag)
    // Skip in CI environments - GitHub Actions handles deployment in a separate job
    const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true'
    
    if (!args.includes('--no-deploy') && !isLocalMode && !isCI) {
      console.log('\n🚀 Triggering deployment...')
      const { spawn } = await import('child_process')
      
      const deploy = spawn('npm', ['run', 'deploy:github'], {
        cwd: projectRoot,
        stdio: 'inherit',
        shell: true
      })
      
      deploy.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Deployment complete!')
        } else {
          console.error(`❌ Deployment failed with code ${code}`)
          process.exit(code)
        }
      })
    }
  })
  .catch(error => {
    console.error('💥 Unhandled error:', error)
    process.exit(1)
  })
