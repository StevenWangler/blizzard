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

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
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
// AGENT PROMPTS (Michigan-calibrated)
// ============================================================================

const meteorologistPrompt = `You are an expert meteorologist analyzing weather for snow day predictions in MICHIGAN.

MICHIGAN CONTEXT:
- Michigan averages 40-80+ inches of snow per year
- Schools have high tolerance for snow (4-6" is routine)
- Ice is the "great equalizer" - even Michigan closes for ice storms
- Timing matters: snow ending before 4 AM allows plows to clear roads

Analyze the weather data and return your assessment as a JSON object matching the expected schema.
Focus on temperature trends, precipitation type/amounts, wind conditions, and visibility.`

const historianPrompt = `You are a weather pattern analyst providing historical context for MICHIGAN snow day decisions.

MICHIGAN CONTEXT:
- Michigan schools rarely close for just snow amount alone
- Historical closure triggers: ice storms, blizzards, extreme cold (<-15°F wind chill)
- 8-10+ inches with bad timing is needed for closures
- Compare current patterns to similar historical events

Return your analysis as a JSON object matching the expected schema.`

const safetyAnalystPrompt = `You are a transportation safety expert evaluating winter weather risks for MICHIGAN schools.

MICHIGAN CONTEXT:
- Robust plow infrastructure works overnight
- Experienced winter drivers and bus operators
- School starts ~7:40 AM, giving plows time after overnight snow
- Primary concern: road conditions during morning commute (6-8 AM)

Evaluate road conditions, travel safety, and timing. Return JSON matching the expected schema.`

const newsIntelPrompt = `You are a Local News Intelligence Agent specialized in gathering real-time community information for Rockford, Michigan snow day predictions.

LOCATION FOCUS: Rockford, Michigan (Kent County) - ZIP 49341
SCHOOL DISTRICT: Rockford Public Schools

YOUR MISSION:
Scour the internet for any local news, social media signals, community reports, or official announcements that could provide additional context for snow day decisions.

PRIORITY SEARCH TARGETS:
1. Rockford Public Schools announcements and social media
2. Neighboring districts: Forest Hills, Cedar Springs, Sparta, Lowell, Greenville, Kent ISD
3. Local news: WOOD TV8, WZZM 13, MLive, Fox 17
4. Michigan DOT road conditions, Kent County Road Commission
5. Power outage reports (Consumers Energy)
6. Local Facebook groups, Twitter/X, Reddit r/grandrapids

WHAT TO LOOK FOR:
- School closure hints or announcements
- Neighboring district closures (domino effect)
- Hazardous road condition reports
- Power outages, event cancellations
- Community sentiment about weather

Return JSON matching the expected schema with news, district signals, and community intel.`

const coordinatorPrompt = `You are the final decision coordinator for MICHIGAN snow day predictions.

## DEEP ANALYSIS DIRECTIVE
Take your time. Think thoroughly. Cross-reference ALL expert analyses before deciding.
You have: Meteorology (30%), Safety (20%), History (15%), and NEWS INTELLIGENCE (15%).
(Note: Infrastructure 10% and Power Grid 10% are included in Safety analysis in this system.)

The News Intelligence is YOUR SECRET WEAPON - the stats students don't have real-time community signals.
- If neighboring districts closed → bump probability UP 15-20%
- If community expects closure → bump UP 10-15%
- If community says "this is nothing" → lean toward lower end

## PRE-DECISION CHECKLIST (answer before deciding):
1. What do all four experts AGREE on?
2. Where do they DISAGREE?
3. What's the plow timing math? (hours from snow end to 7:40 AM)
4. Is there ANY ice? (ice changes everything)
5. What are neighboring districts doing?
6. What would make me WRONG?

## COMPETITION CONTEXT
You're competing against Rockford High School stats students.
Brier Score: (predicted_probability - actual_outcome)²
Lower = better. Be DECISIVE, not wishy-washy.

## MICHIGAN THRESHOLDS (higher than national):
- <4" snow = 5-15% (routine for Michigan)
- 4-6" snow = 15-35%  
- 6-8" = 35-55% (depends on timing)
- 8-10" = 55-75% (likely closure)
- 10+\" = 75-90%
- Ice storm / freezing rain = 80-95% (ice is the great equalizer)
- Blizzard (heavy snow + high winds) = 85-95%
- 3+ neighboring districts closed = +15-20% adjustment

## WIND CHILL THRESHOLDS (critical for bus safety):
- Wind chill above -10°F = no cold-based adjustment
- Wind chill -10°F to -15°F = 25-40% (uncomfortable, districts watching)
- Wind chill -15°F to -20°F = 50-70% (borderline dangerous, many close proactively)
- Wind chill ≤ -20°F = 90-95% (essentially guaranteed closure)

SHOW YOUR WORK in the decision_rationale. Explain how you weighted each expert.
Avoid 40-60% range unless genuinely uncertain with conflicting expert opinions.`

// ============================================================================
// AGENTS-AS-TOOLS CONTEXT (module-level state for tool callbacks)
// ============================================================================

let _currentWeatherContext = ''
let _currentExpertAnalyses = {
  meteorology: null,
  history: null,
  safety: null,
  news: null
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
    experts: z.array(z.enum(['meteorologist', 'historian', 'safety_analyst', 'news_intel'])).min(2).describe('Which experts to cross-check'),
    question: z.string().describe('The specific aspect to cross-check or validate')
  }),
  execute: async ({ experts, question }) => {
    console.log('🔄 Coordinator cross-checking experts:', experts.join(', '), '-', question)
    const expertMap = {
      meteorologist: { agent: meteorologistAgent, analysis: _currentExpertAnalyses.meteorology },
      historian: { agent: historianAgent, analysis: _currentExpertAnalyses.history },
      safety_analyst: { agent: safetyAnalystAgent, analysis: _currentExpertAnalyses.safety },
      news_intel: { agent: newsIntelAgent, analysis: _currentExpertAnalyses.news }
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
- **cross_check_experts**: Have experts validate each other's analyses

USE THESE TOOLS when:
1. You see a conflict between expert analyses
2. You need more detail on a specific aspect
3. You want to validate your reasoning
4. Something doesn't add up and you need clarification
5. You want to confirm neighboring district status is current

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
  tools: [askMeteorologist, askHistorian, askSafetyAnalyst, askNewsIntel, crossCheckExperts],
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
  const [meteorologyResult, historyResult, safetyResult, newsResult] = await Promise.all([
    run(meteorologistAgent, weatherContext),
    run(historianAgent, `${weatherContext}\n\nProvide historical context for this location and time of year.`),
    run(safetyAnalystAgent, weatherContext),
    run(newsIntelAgent, `Search for any local news, social media signals, school district announcements, or community chatter about weather conditions and potential school closures in Rockford, Michigan and surrounding areas for ${dayName}, ${targetDateStr}. Look for signals from neighboring districts, local news stations, and community sentiment.`)
  ])
  
  console.log('✅ Expert analyses complete')

  // Store context for agent tools
  _currentWeatherContext = weatherContext
  _currentExpertAnalyses = {
    meteorology: meteorologyResult.finalOutput,
    history: historyResult.finalOutput,
    safety: safetyResult.finalOutput,
    news: newsResult.finalOutput
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
${collaborationContext}
LOCATION: ${location}
ANALYSIS TIMESTAMP: ${new Date().toISOString()}

---
REMINDER: You have tools to consult specialists for follow-up questions if needed:
- ask_meteorologist, ask_historian, ask_safety_analyst, ask_news_intel, cross_check_experts
Use them if you need clarification or see conflicts in the analyses above.
`
  
  console.log('🎯 Running decision coordinator (with agent consultation tools)...')
  
  // Decision coordinator can now call agent tools for follow-ups
  const finalResult = await run(
    decisionCoordinatorAgent,
    `Based on the expert analyses provided below, make a final snow day prediction and recommendation.

Before finalizing, consider:
1. Do any expert analyses conflict? If so, use your tools to clarify.
2. Is the plow timing math clear? If not, ask the safety analyst.
3. Are neighboring district closures confirmed? If uncertain, ask news intel.
${collaboration ? `4. The agents debated for ${collaboration.totalRounds} round(s). Consider unresolved disagreements.` : ''}

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
  
  // =========================================================================
  // EXTREME COLD OVERRIDE - Programmatic floor for wind chill closures
  // =========================================================================
  // Michigan schools close for extreme cold regardless of snow amounts.
  // This check ensures the model can't underestimate cold-only closure scenarios.
  
  const meteorologyData = meteorologyResult.finalOutput
  const windchillFactor = meteorologyData?.temperature_analysis?.windchill_factor
  const overnightLow = meteorologyData?.temperature_analysis?.overnight_low_f
  const morningFeelsLike = meteorologyData?.temperature_analysis?.morning_feels_like_f
  const extremeColdFlag = meteorologyData?.temperature_analysis?.feels_like_below_minus_20
  
  console.log(`🌡️ Cold detection: windchill_factor=${windchillFactor}, overnight_low=${overnightLow}, morning_feels_like=${morningFeelsLike}, flag=${extremeColdFlag}`)
  
  // Determine extreme cold condition from ANY available source
  const hasExtremeCold = 
    extremeColdFlag === true ||
    (morningFeelsLike !== undefined && morningFeelsLike <= -20) ||
    (windchillFactor !== undefined && windchillFactor <= -20) ||
    (overnightLow !== undefined && overnightLow <= -15) // Very cold overnight = dangerous morning wind chill
  
  const hasDangerousCold = 
    (morningFeelsLike !== undefined && morningFeelsLike <= -15) ||
    (windchillFactor !== undefined && windchillFactor <= -15) ||
    (overnightLow !== undefined && overnightLow <= -10)
  
  // Apply floor if ANY source indicates extreme cold (≤ -20°F wind chill)
  if (hasExtremeCold) {
    const currentProb = validatedFinal.snow_day_probability || 0
    if (currentProb < 95) {
      console.log(`🥶 EXTREME COLD OVERRIDE: Raising probability from ${currentProb}% to 95% (wind chill ≤ -20°F = automatic closure)`)
      validatedFinal = {
        ...validatedFinal,
        snow_day_probability: 95,
        primary_factors: [
          'EXTREME COLD: Wind chill ≤ -20°F triggers AUTOMATIC closure - buses cannot operate safely',
          ...(validatedFinal.primary_factors || []).filter(f => !f.includes('EXTREME COLD'))
        ]
      }
    }
  } else if (hasDangerousCold) {
    // -15°F to -20°F floor at 50%
    const currentProb = validatedFinal.snow_day_probability || 0
    if (currentProb < 50) {
      console.log(`❄️ DANGEROUS COLD OVERRIDE: Raising probability from ${currentProb}% to 50% (wind chill -15°F to -20°F)`)
      validatedFinal = {
        ...validatedFinal,
        snow_day_probability: 50,
        primary_factors: [
          'DANGEROUS COLD: Wind chill -15°F to -20°F - many districts close proactively',
          ...(validatedFinal.primary_factors || []).filter(f => !f.includes('DANGEROUS COLD'))
        ]
      }
    }
  }
  
  console.log('✅ Multi-agent analysis complete!')
  
  return {
    meteorology: meteorologyResult.finalOutput,
    history: historyResult.finalOutput,
    safety: safetyResult.finalOutput,
    news: newsResult.finalOutput,
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
