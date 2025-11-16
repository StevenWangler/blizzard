/**
 * Multi-Agent Snow Day Prediction System
 * 
 * This system uses multiple specialized AI agents to analyze weather data
 * and collaboratively predict the probability of snow days with detailed reasoning.
 * 
 * Architecture:
 * 1. Meteorologist Agent - Analyzes current weather conditions and forecasts
 * 2. Historian Agent - Provides historical context and patterns
 * 3. Safety Analyst Agent - Evaluates travel conditions and safety risks
 * 4. Decision Coordinator Agent - Synthesizes all inputs into final prediction
 */

import { Agent, tool, run } from '@openai/agents'
import { z } from 'zod'
import type { 
  WeatherApiResponse, 
  ProcessedWeatherData,
  WeatherAlert,
  HourlyWeather 
} from "@/types/weatherTypes"
import { weatherApi, isWeatherApiKeyConfigured } from './weatherApi'
import { getRelevantWeatherInformation } from './weatherProcessing'

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

const webSearchTool = tool({
  name: 'search_weather_context',
  description: 'Search for current weather conditions, patterns, and relevant information online',
  parameters: z.object({
    query: z.string(),
    location: z.string().optional()
  }),
  execute: async ({ query, location }) => {
    // Note: In a real implementation, this would use a web search API
    // For now, return a placeholder that indicates web search capability
    return {
      query,
      location,
      results: `Searched for: ${query}${location ? ` in ${location}` : ''}`,
      timestamp: new Date().toISOString(),
      note: "Web search tool - would integrate with real search API in production"
    }
  }
})

// Agent definitions
export const meteorologistAgent = new Agent({
  name: 'Chief Meteorologist',
  instructions: `You are an expert meteorologist specializing in winter weather analysis and snow day predictions.

Your role is to:
1. Analyze current weather conditions, forecasts, and meteorological data
2. Interpret weather patterns, trends, and atmospheric conditions
3. Assess precipitation type, timing, intensity, and accumulation
4. Evaluate temperature profiles, wind patterns, and visibility factors
5. Provide technical weather analysis with confidence levels

Focus on:
- Temperature trends and freezing level analysis
- Precipitation type determination (snow vs. mixed precipitation)
- Wind impact on snow accumulation and drifting
- Visibility concerns from falling snow or blowing snow
- Timing of weather onset and peak intensity
- Weather alerts and their implications

Always provide quantitative analysis with uncertainty ranges where appropriate.
Be precise about timing, amounts, and meteorological reasoning.`,
  model: 'gpt-4o-mini',
  tools: [weatherDataTool, webSearchTool],
  outputType: WeatherAnalysisSchema
})

export const historianAgent = new Agent({
  name: 'Weather Pattern Historian',
  instructions: `You are a weather pattern analyst with expertise in historical weather data and climatological patterns.

Your role is to:
1. Identify similar historical weather patterns and their outcomes
2. Provide seasonal and climatological context
3. Analyze location-specific factors and microclimates
4. Assess how current conditions compare to historical norms
5. Identify unusual or noteworthy aspects of the current weather pattern

Focus on:
- Historical precedents for similar weather setups
- Seasonal timing and typical conditions for the current date
- Local geographical factors that influence weather outcomes
- Pattern recognition and analogous situations
- Statistical context and probability adjustments based on history
- Regional climate characteristics and trends

Provide confidence levels for your historical comparisons and pattern matching.
Consider both recent patterns (last 5-10 years) and longer climatological records.`,
  model: 'gpt-4o-mini',
  tools: [webSearchTool],
  outputType: HistoricalAnalysisSchema
})

export const safetyAnalystAgent = new Agent({
  name: 'Transportation Safety Analyst',
  instructions: `You are a transportation safety expert specializing in winter weather impact assessment.

Your role is to:
1. Evaluate road and travel conditions during winter weather events
2. Assess safety risks for different transportation modes
3. Analyze timing impacts on commuting and daily activities
4. Provide safety recommendations and risk assessments
5. Consider infrastructure and emergency preparedness factors

Focus on:
- Road surface conditions and ice formation potential
- Driving safety and vehicle operation challenges
- Walking conditions and pedestrian safety
- Public transportation impacts and disruptions
- Emergency services accessibility
- Timing of worst conditions relative to peak travel times
- School transportation and campus safety considerations

Rate conditions on safety scales and provide clear risk categorizations.
Consider both immediate safety concerns and longer-term impact scenarios.`,
  model: 'gpt-4o-mini',
  tools: [weatherDataTool],
  outputType: SafetyAnalysisSchema
})

export const decisionCoordinatorAgent = new Agent({
  name: 'Snow Day Decision Coordinator',
  instructions: `You are the final decision coordinator responsible for synthesizing all expert analysis into actionable snow day predictions.

Your role is to:
1. Integrate meteorological, historical, and safety analyses
2. Weigh different factors and expert opinions appropriately
3. Provide clear, confident predictions with supporting rationale
4. Consider multiple scenarios and contingencies
5. Make recommendations for different stakeholders
6. Determine if additional monitoring or updates are needed

Focus on:
- Balancing technical weather analysis with practical safety concerns
- Weighing expert opinions and resolving any conflicting assessments
- Providing clear probability ranges with confidence levels
- Explaining the decision-making rationale in accessible terms
- Considering the consequences of both closing and not closing schools
- Recommending appropriate timing for decisions and communications
- Identifying key factors to monitor for potential forecast changes

Your final output should be decisive yet acknowledge uncertainties appropriately.
Provide actionable guidance for school administrators, parents, and community officials.`,
  model: 'gpt-4o-mini',
  outputType: FinalPredictionSchema
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