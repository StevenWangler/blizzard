#!/usr/bin/env node

/**
 * Snow Day Prediction Generator
 * 
 * Node.js script that runs the multi-agent system to generate snow day predictions.
 * Designed to be executed by GitHub Actions on a schedule.
 * 
 * Usage:
 *   node build-tools/generate-prediction.mjs
 * 
 * Environment Variables:
 *   - OPENAI_API_KEY: Required for agent system
 *   - VITE_WEATHER_API_KEY: Required for weather data
 *   - VITE_ZIP_CODE: Location for weather forecast (default: 49341)
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { config as loadEnv } from 'dotenv'

// Load environment variables from .env file
loadEnv()

// Import our agent system (note: this requires the built files)
// We'll need to adapt this for Node.js execution
console.log('🚀 Starting Snow Day Prediction Generator...')

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

// Configuration
const appConfig = {
  openaiApiKey: process.env.OPENAI_API_KEY,
  weatherApiKey: process.env.VITE_WEATHER_API_KEY,
  zipCode: process.env.VITE_ZIP_CODE || '49341',
  outputDir: join(projectRoot, 'public', 'data'),
  outputFile: 'prediction.json'
}

console.log(`📍 Location: ${appConfig.zipCode}`)
console.log(`📂 Output: ${join(appConfig.outputDir, appConfig.outputFile)}`)

// Simplified weather API client for Node.js
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

// Simplified agent system using OpenAI API directly
class NodeAgentSystem {
  constructor(apiKey) {
    this.apiKey = apiKey
    this.baseUrl = 'https://api.openai.com/v1/chat/completions'
  }

  async runAgent(name, instructions, weatherData, model = 'gpt-4o-mini') {
    console.log(`🤖 Running ${name}...`)

    const messages = [
      {
        role: 'system',
        content: instructions
      },
      {
        role: 'user',
        content: `Analyze the following weather data and provide your expert assessment:

WEATHER DATA:
${JSON.stringify(weatherData, null, 2)}

Please provide a detailed analysis according to your expertise.`
      }
    ]

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`OpenAI API error for ${name}: ${response.status} - ${errorData.error?.message || response.statusText}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error(`No response from ${name}`)
    }

    try {
      return JSON.parse(content)
    } catch (parseError) {
      console.warn(`⚠️  Could not parse JSON from ${name}, returning raw content`)
      return { analysis: content, raw: true }
    }
  }

  async generatePrediction(weatherData) {
    console.log('🔄 Running multi-agent analysis...')

    // Define agent instructions
    const agents = {
      meteorologist: {
        name: 'Chief Meteorologist',
        instructions: `You are an expert meteorologist analyzing weather for snow day predictions. 

Analyze the weather data and return a JSON object with:
{
  "temperature_analysis": {
    "current_temp_f": number,
    "overnight_low_f": number,
    "morning_high_f": number,
    "freezing_hours": number,
    "temperature_trend": "rising|falling|steady",
    "windchill_factor": number
  },
  "precipitation_analysis": {
    "snow_probability_overnight": number (0-100),
    "snow_probability_morning": number (0-100),
    "total_snowfall_inches": number,
    "snowfall_rate_peak": number,
    "precipitation_type": "snow|freezing_rain|sleet|rain|mixed"
  },
  "wind_analysis": {
    "max_wind_speed_mph": number,
    "wind_direction": string,
    "sustained_winds_mph": number,
    "wind_chill_impact": boolean
  },
  "visibility_analysis": {
    "minimum_visibility_miles": number,
    "avg_visibility_miles": number,
    "visibility_factors": [string]
  },
  "alert_summary": [{
    "type": string,
    "severity": string,
    "description": string
  }],
  "overall_conditions_summary": string
}`
      },
      historian: {
        name: 'Weather Pattern Historian',
        instructions: `You are a weather pattern analyst providing historical context for snow day decisions.

Return a JSON object with:
{
  "similar_weather_patterns": [{
    "pattern_description": string,
    "historical_snow_day_rate": number (0-100),
    "confidence_level": "high|medium|low"
  }],
  "seasonal_context": {
    "typical_conditions_for_date": string,
    "unusual_factors": [string],
    "seasonal_probability_adjustment": number (-20 to 20)
  },
  "location_specific_factors": {
    "local_microclimates": [string],
    "infrastructure_considerations": [string],
    "elevation_impact": string
  },
  "confidence_assessment": string
}`
      },
      safety_analyst: {
        name: 'Transportation Safety Analyst',
        instructions: `You are a transportation safety expert evaluating winter weather risks.

Return a JSON object with:
{
  "road_conditions": {
    "primary_roads_score": number (1-10),
    "secondary_roads_score": number (1-10),
    "parking_lots_score": number (1-10),
    "ice_formation_risk": "low|moderate|high|severe"
  },
  "travel_safety": {
    "walking_conditions_score": number (1-10),
    "driving_conditions_score": number (1-10),
    "public_transport_impact": "minimal|moderate|significant|severe",
    "emergency_access_concern": boolean
  },
  "timing_analysis": {
    "worst_conditions_start_time": string,
    "worst_conditions_end_time": string,
    "morning_commute_impact": "minimal|moderate|significant|severe",
    "afternoon_impact": "minimal|moderate|significant|severe"
  },
  "safety_recommendations": [string],
  "risk_level": "low|moderate|high|severe"
}`
      }
    }

    // Run agents in parallel
    const agentPromises = Object.entries(agents).map(([key, agent]) =>
      this.runAgent(agent.name, agent.instructions, weatherData)
        .then(result => [key, result])
        .catch(error => {
          console.error(`❌ ${agent.name} failed:`, error.message)
          return [key, { error: error.message, agent: agent.name }]
        })
    )

    const agentResults = Object.fromEntries(await Promise.all(agentPromises))

    // Decision coordinator
    console.log('🎯 Running decision coordinator...')

    const coordinatorInstructions = `You are the final decision coordinator for snow day predictions. 

Based on the expert analyses provided, return a JSON object with:
{
  "snow_day_probability": number (0-100),
  "confidence_level": "very_low|low|moderate|high|very_high",
  "primary_factors": [string],
  "timeline": {
    "conditions_start": string,
    "peak_impact_time": string,
    "conditions_improve": string
  },
  "decision_rationale": string,
  "alternative_scenarios": [{
    "scenario": string,
    "probability": number (0-100),
    "impact": string
  }],
  "recommendations": {
    "for_schools": [string],
    "for_residents": [string],
    "for_authorities": [string]
  },
  "updates_needed": boolean,
  "next_evaluation_time": string
}

EXPERT ANALYSES:
${JSON.stringify(agentResults, null, 2)}`

    const finalDecision = await this.runAgent(
      'Decision Coordinator',
      coordinatorInstructions,
      weatherData
    )

    return {
      meteorology: agentResults.meteorologist,
      history: agentResults.historian,
      safety: agentResults.safety_analyst,
      final: finalDecision,
      timestamp: new Date().toISOString(),
      location: `${weatherData.location.name}, ${weatherData.location.region}`,
      raw_weather_data: weatherData
    }
  }
}

// Main execution
async function main() {
  try {
    // Initialize services
    const weatherAPI = new NodeWeatherAPI(appConfig.weatherApiKey, appConfig.zipCode)
    const agentSystem = new NodeAgentSystem(appConfig.openaiApiKey)

    // Get weather data
    const weatherData = await weatherAPI.getForecast()

    // Run agent analysis
    const prediction = await agentSystem.generatePrediction(weatherData)

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