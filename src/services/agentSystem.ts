/**
 * Multi-Agent Snow Day Prediction System - MICHIGAN CALIBRATED
 * 
 * This system uses multiple specialized AI agents to analyze weather data
 * and collaboratively predict the probability of snow days with detailed reasoning.
 * 
 * MICHIGAN-SPECIFIC CALIBRATION:
 * - Higher snow thresholds than national averages (Michigan handles 4-6" easily)
 * - Plow timing analysis (hours between snow ending and 7:40 AM school start)
 * - Ice is the "great equalizer" - even Michigan closes for ice storms
 * - Wind/drifting considerations for blowing snow
 * - Experienced winter drivers and robust infrastructure factored in
 * 
 * Architecture:
 * 1. Meteorologist Agent - Analyzes current weather conditions and forecasts (Michigan-calibrated)
 * 2. Historian Agent - Provides historical context and patterns (Michigan closure rates)
 * 3. Safety Analyst Agent - Evaluates travel conditions and safety risks (Michigan road infrastructure)
 * 4. Decision Coordinator Agent - Synthesizes all inputs into final prediction (Michigan thresholds)
 */

import { Agent, tool, run, handoff, setTracingDisabled, webSearchTool, codeInterpreterTool } from '@openai/agents'
import { z } from 'zod'
import type { 
  WeatherApiResponse, 
  ProcessedWeatherData,
  WeatherAlert,
  HourlyWeather 
} from "@/types/weatherTypes"

// Enable tracing for debugging and monitoring agent workflows (false = tracing ON)
setTracingDisabled(false)
import { weatherApi, isWeatherApiKeyConfigured } from './weatherApi'
import { getRelevantWeatherInformation } from './weatherProcessing'

// Import agent prompts from external files
import meteorologistPrompt from './prompts/meteorologist.txt?raw'
import historianPrompt from './prompts/historian.txt?raw'
import safetyAnalystPrompt from './prompts/safety-analyst.txt?raw'
import decisionCoordinatorPrompt from './prompts/decision-coordinator.txt?raw'

const WEATHER_API_KEY_MISSING_MESSAGE = 'Weather API key is not configured. Please set VITE_WEATHER_API_KEY to run the snow day prediction agents.'

function ensureWeatherApiConfigured(): void {
  if (!isWeatherApiKeyConfigured()) {
    throw new Error(WEATHER_API_KEY_MISSING_MESSAGE)
  }
}

// Structured output schemas for agent responses
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

// Tool definitions for agents
const weatherDataTool = tool({
  name: 'get_weather_data',
  description: 'Get processed weather data including forecasts, alerts, and current conditions',
  parameters: z.object({
    include_raw_data: z.boolean().default(false),
    focus_period: z.enum(['next_12_hours', 'next_24_hours', 'morning_commute']).default('next_24_hours')
  }),
  execute: async ({ include_raw_data, focus_period }) => {
    ensureWeatherApiConfigured()

    try {
      const rawWeather = await weatherApi.getForecast()
      const processedData = getRelevantWeatherInformation(rawWeather)
      
      return {
        processed: processedData,
        raw: include_raw_data ? rawWeather : undefined,
        focus_period,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to fetch weather data: ${message}`)
    }
  }
})

// Agent definitions with handoffDescription for inter-agent communication
export const meteorologistAgent = new Agent({
  name: 'Chief Meteorologist',
  instructions: meteorologistPrompt,
  model: 'gpt-5.1',
  tools: [weatherDataTool, webSearchTool(), codeInterpreterTool()],  // Weather API + web search + code for calculations
  outputType: WeatherAnalysisSchema,
  handoffDescription: 'Expert in weather analysis including temperature trends, precipitation forecasts, wind conditions, and visibility. Consult for detailed meteorological data interpretation.'
})

export const historianAgent = new Agent({
  name: 'Weather Pattern Historian',
  instructions: historianPrompt,
  model: 'gpt-5.1',
  tools: [webSearchTool(), codeInterpreterTool()],  // Web search + code for statistical pattern analysis
  outputType: HistoricalAnalysisSchema,
  handoffDescription: 'Expert in historical weather patterns and climatological context. Consult for pattern matching with past events and seasonal probability adjustments.'
})

export const safetyAnalystAgent = new Agent({
  name: 'Transportation Safety Analyst',
  instructions: safetyAnalystPrompt,
  model: 'gpt-5.1',
  tools: [weatherDataTool, webSearchTool(), codeInterpreterTool()],  // Weather + search + code for plow timing calculations
  outputType: SafetyAnalysisSchema,
  handoffDescription: 'Expert in transportation safety and travel risk assessment. Consult for road conditions, commute impact analysis, and safety recommendations.'
})

// Decision Coordinator with handoffs to specialist agents for follow-up queries
export const decisionCoordinatorAgent = Agent.create({
  name: 'Snow Day Decision Coordinator',
  instructions: decisionCoordinatorPrompt,
  model: 'gpt-5.1',
  outputType: FinalPredictionSchema,
  // Handoffs allow the coordinator to delegate back to specialists if more info needed
  handoffs: [
    handoff(meteorologistAgent, {
      toolDescriptionOverride: 'Request additional meteorological analysis or clarification on weather conditions'
    }),
    handoff(historianAgent, {
      toolDescriptionOverride: 'Request additional historical context or pattern analysis'
    }),
    handoff(safetyAnalystAgent, {
      toolDescriptionOverride: 'Request additional safety assessment or transportation risk analysis'
    })
  ]
})

// Multi-agent orchestration function
export async function runSnowDayPrediction(): Promise<{
  meteorology: z.infer<typeof WeatherAnalysisSchema>
  history: z.infer<typeof HistoricalAnalysisSchema>
  safety: z.infer<typeof SafetyAnalysisSchema>
  final: z.infer<typeof FinalPredictionSchema>
  timestamp: string
  location: string
}> {
  try {
    ensureWeatherApiConfigured()
    console.log('🌨️ Starting multi-agent snow day analysis...')
    
    // Get initial weather data for location context
    const weatherData = await weatherApi.getForecast()
    const location = `${weatherData.location.name}, ${weatherData.location.region}`
    
    console.log(`📍 Analyzing conditions for ${location}`)
    
    // Run agents in parallel for efficiency
    console.log('🔄 Running expert analysis agents...')
    const [meteorologyResult, historyResult, safetyResult] = await Promise.all([
      run(meteorologistAgent, `Analyze the current weather forecast and conditions for snow day prediction. Focus on overnight and morning conditions that would impact school operations and transportation safety.`),
      run(historianAgent, `Provide historical context and pattern analysis for the current weather situation. Compare to similar past events and provide climatological perspective for this time of year and location: ${location}.`),
      run(safetyAnalystAgent, `Evaluate transportation safety and travel conditions based on the forecasted weather. Assess risks for school transportation, student/staff commuting, and campus operations.`)
    ])
    
    console.log('🎯 Coordinating final decision...')
    
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
    
    // Get final coordinated decision
    const finalResult = await run(
      decisionCoordinatorAgent,
      `Based on the expert analyses provided below, make a final snow day prediction and recommendation. Synthesize all inputs and provide a comprehensive decision with clear rationale and confidence levels.

${expertAnalyses}`
    )
    
    console.log('✅ Multi-agent analysis complete!')
    
    return {
      meteorology: meteorologyResult.finalOutput || {} as z.infer<typeof WeatherAnalysisSchema>,
      history: historyResult.finalOutput || {} as z.infer<typeof HistoricalAnalysisSchema>,
      safety: safetyResult.finalOutput || {} as z.infer<typeof SafetyAnalysisSchema>,
      final: finalResult.finalOutput || {} as z.infer<typeof FinalPredictionSchema>,
      timestamp: new Date().toISOString(),
      location
    }
    
  } catch (error) {
    console.error('❌ Multi-agent analysis failed:', error)
    throw new Error(`Snow day prediction failed: ${error}`)
  }
}

// Export schemas for external use
export {
  WeatherAnalysisSchema,
  HistoricalAnalysisSchema,
  SafetyAnalysisSchema,
  FinalPredictionSchema
}