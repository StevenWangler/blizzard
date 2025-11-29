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
import { Agent, run, tool, handoff, setTracingDisabled, webSearchTool, codeInterpreterTool } from '@openai/agents'
import { z } from 'zod'

// Load environment variables from .env file
loadEnv()

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
function getNextSchoolDay(fromDate = new Date()) {
  const date = new Date(fromDate)
  date.setHours(0, 0, 0, 0)
  
  // Start from tomorrow
  date.setDate(date.getDate() + 1)
  
  // Skip weekends
  const dayOfWeek = date.getDay()
  if (dayOfWeek === 6) {
    // Saturday -> skip to Monday
    date.setDate(date.getDate() + 2)
  } else if (dayOfWeek === 0) {
    // Sunday -> skip to Monday
    date.setDate(date.getDate() + 1)
  }
  
  return date
}

/**
 * Calculate how many days ahead the next school day is.
 */
function getDaysUntilNextSchoolDay(fromDate = new Date()) {
  const today = new Date(fromDate)
  today.setHours(0, 0, 0, 0)
  const nextSchool = getNextSchoolDay(fromDate)
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
  outputDir: isLocalMode 
    ? join(projectRoot, 'public', 'data', 'local')
    : join(projectRoot, 'public', 'data'),
  outputFile: 'prediction.json'
}

console.log(`📍 Location: ${appConfig.zipCode}`)
console.log(`📂 Output: ${join(appConfig.outputDir, appConfig.outputFile)}`)

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
Take your time. Think thoroughly. Cross-reference ALL FOUR expert analyses before deciding.
You have: Meteorology (35%), Safety (25%), History (20%), and NEWS INTELLIGENCE (20%).

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
- 6-8" with good timing = 35-50%
- 8+ inches OR ice = 60-85%
- Blizzard/ice storm = 80-95%
- 3+ neighboring districts closed = +15-20% adjustment

SHOW YOUR WORK in the decision_rationale. Explain how you weighted each expert.
Avoid 40-60% range unless genuinely uncertain with conflicting expert opinions.`

// ============================================================================
// AGENT DEFINITIONS (using @openai/agents SDK)
// ============================================================================

// Create agents with proper SDK patterns
const meteorologistAgent = new Agent({
  name: 'Chief Meteorologist',
  instructions: meteorologistPrompt,
  model: 'gpt-5.1',
  tools: [webSearchTool(), codeInterpreterTool()],  // Web search + code for wind chill calcs, trend analysis
  outputType: WeatherAnalysisSchema,
  handoffDescription: 'Expert in weather analysis including temperature, precipitation, wind, and visibility.'
})

const historianAgent = new Agent({
  name: 'Weather Pattern Historian',
  instructions: historianPrompt,
  model: 'gpt-5.1',
  tools: [webSearchTool(), codeInterpreterTool()],  // Web search + code for statistical pattern analysis
  outputType: HistoricalAnalysisSchema,
  handoffDescription: 'Expert in historical weather patterns and climatological context for Michigan.'
})

const safetyAnalystAgent = new Agent({
  name: 'Transportation Safety Analyst',
  instructions: safetyAnalystPrompt,
  model: 'gpt-5.1',
  tools: [webSearchTool(), codeInterpreterTool()],  // Web search + code for timing/plow window calculations
  outputType: SafetyAnalysisSchema,
  handoffDescription: 'Expert in transportation safety and travel risk assessment.'
})

const newsIntelAgent = new Agent({
  name: 'Local News Intelligence',
  instructions: newsIntelPrompt,
  model: 'gpt-5.1',
  tools: [webSearchTool()],  // Web search is the primary tool for scouring news/social media
  outputType: NewsAnalysisSchema,
  handoffDescription: 'Expert in local Rockford, MI news, social media, and community intelligence.'
})

// Decision Coordinator with handoffs to specialists
const decisionCoordinatorAgent = Agent.create({
  name: 'Snow Day Decision Coordinator',
  instructions: coordinatorPrompt,
  model: 'gpt-5.1',
  outputType: FinalPredictionSchema,
  handoffs: [
    handoff(meteorologistAgent, {
      toolDescriptionOverride: 'Request additional meteorological analysis'
    }),
    handoff(historianAgent, {
      toolDescriptionOverride: 'Request additional historical context'
    }),
    handoff(safetyAnalystAgent, {
      toolDescriptionOverride: 'Request additional safety assessment'
    }),
    handoff(newsIntelAgent, {
      toolDescriptionOverride: 'Request additional local news or community intelligence'
    })
  ]
})

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

LOCATION: ${location}
ANALYSIS TIMESTAMP: ${new Date().toISOString()}
`
  
  console.log('🎯 Running decision coordinator with handoff capability...')
  
  // Decision coordinator can use handoffs to request more info from specialists if needed
  const finalResult = await run(
    decisionCoordinatorAgent,
    `Synthesize the expert analyses and make a final snow day prediction.
    
${expertAnalyses}

If you need clarification from any specialist, you can hand off to them.
Otherwise, provide your final prediction.`
  )
  
  console.log('✅ Multi-agent analysis complete!')
  
  return {
    meteorology: meteorologyResult.finalOutput,
    history: historyResult.finalOutput,
    safety: safetyResult.finalOutput,
    news: newsResult.finalOutput,
    final: finalResult.finalOutput,
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
    const nextSchoolDay = getNextSchoolDay()
    const daysAhead = getDaysUntilNextSchoolDay()
    const nextSchoolDayStr = nextSchoolDay.toISOString().split('T')[0]
    const dayName = nextSchoolDay.toLocaleDateString('en-US', { weekday: 'long' })
    
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
      location: prediction.location
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
main().catch(error => {
  console.error('💥 Unhandled error:', error)
  process.exit(1)
})