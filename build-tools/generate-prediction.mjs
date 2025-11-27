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

  async getForecast() {
    const url = new URL(`${this.baseUrl}/forecast.json`)
    url.searchParams.set('key', this.apiKey)
    url.searchParams.set('q', this.zipCode)
    url.searchParams.set('days', '2')
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

const coordinatorPrompt = `You are the final decision coordinator for MICHIGAN snow day predictions.

CRITICAL: You are competing against Rockford High School statistics students for accuracy.
Accuracy is measured using Brier Score: (predicted_probability - actual_outcome)²
Lower score = better. Be decisive, not wishy-washy.

MICHIGAN THRESHOLDS (higher than national averages):
- <4" snow = 5-15% probability (routine for Michigan)
- 4-6" snow = 15-35% probability  
- 6-8" with good timing = 35-50% probability
- 8+ inches OR ice = 60-85% probability
- Blizzard/ice storm = 80-95% probability

Synthesize the expert analyses and return your final prediction as JSON matching the expected schema.
Be DECISIVE - avoid 40-60% range unless genuinely uncertain.`

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
    })
  ]
})

// ============================================================================
// MULTI-AGENT ORCHESTRATION
// ============================================================================

async function runAgentPrediction(weatherData) {
  const location = `${weatherData.location.name}, ${weatherData.location.region}`
  console.log(`📍 Analyzing conditions for ${location}`)
  
  const weatherContext = `
WEATHER DATA FOR ${location}:
${JSON.stringify(weatherData, null, 2)}

Analyze these conditions for snow day prediction.`

  // Run specialist agents in parallel for efficiency
  console.log('🔄 Running expert analysis agents in parallel...')
  const [meteorologyResult, historyResult, safetyResult] = await Promise.all([
    run(meteorologistAgent, weatherContext),
    run(historianAgent, `${weatherContext}\n\nProvide historical context for this location and time of year.`),
    run(safetyAnalystAgent, weatherContext)
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
    final: finalResult.finalOutput,
    timestamp: new Date().toISOString(),
    location,
    raw_weather_data: weatherData
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  try {
    // Initialize weather API
    const weatherAPI = new NodeWeatherAPI(appConfig.weatherApiKey, appConfig.zipCode)

    // Get weather data
    const weatherData = await weatherAPI.getForecast()

    // Run multi-agent prediction using OpenAI Agents SDK
    const prediction = await runAgentPrediction(weatherData)

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

    // Use the date from the prediction timestamp
    const predictionDate = prediction.timestamp.split('T')[0]
    
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