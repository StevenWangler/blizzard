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

import { Agent, tool, run, setTracingDisabled, webSearchTool, codeInterpreterTool } from '@openai/agents'
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
import newsIntelPrompt from './prompts/news-intel.txt?raw'
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

// ============================================================================
// SPECIALIST AGENTS (Internal - used as tools by the coordinator)
// ============================================================================

const meteorologistAgent = new Agent({
  name: 'Chief Meteorologist',
  instructions: meteorologistPrompt,
  model: 'gpt-5.1',
  tools: [weatherDataTool, webSearchTool(), codeInterpreterTool()],
  outputType: WeatherAnalysisSchema
})

const historianAgent = new Agent({
  name: 'Weather Pattern Historian',
  instructions: historianPrompt,
  model: 'gpt-5.1',
  tools: [webSearchTool(), codeInterpreterTool()],
  outputType: HistoricalAnalysisSchema
})

const safetyAnalystAgent = new Agent({
  name: 'Transportation Safety Analyst',
  instructions: safetyAnalystPrompt,
  model: 'gpt-5.1',
  tools: [weatherDataTool, webSearchTool(), codeInterpreterTool()],
  outputType: SafetyAnalysisSchema
})

const newsIntelAgent = new Agent({
  name: 'Local News Intelligence',
  instructions: newsIntelPrompt,
  model: 'gpt-5.1',
  tools: [webSearchTool()],
  outputType: NewsAnalysisSchema
})

// ============================================================================
// AGENTS-AS-TOOLS: Coordinator can consult specialists on-demand
// ============================================================================

// Store for passing context to agent tools (set before running coordinator)
let _currentWeatherContext = ''
let _currentExpertAnalyses: {
  meteorology?: z.infer<typeof WeatherAnalysisSchema>
  history?: z.infer<typeof HistoricalAnalysisSchema>
  safety?: z.infer<typeof SafetyAnalysisSchema>
  news?: z.infer<typeof NewsAnalysisSchema>
} = {}

const askMeteorologist = tool({
  name: 'ask_meteorologist',
  description: 'Ask the Chief Meteorologist a specific follow-up question about weather conditions, temperature trends, precipitation timing, wind patterns, or visibility. Use when you need clarification or deeper analysis on meteorological data.',
  parameters: z.object({
    question: z.string().describe('The specific question to ask the meteorologist')
  }),
  execute: async ({ question }) => {
    const context = _currentExpertAnalyses.meteorology 
      ? `Your previous analysis: ${JSON.stringify(_currentExpertAnalyses.meteorology, null, 2)}\n\n`
      : ''
    const result = await run(meteorologistAgent, `${context}Weather context:\n${_currentWeatherContext}\n\nFollow-up question: ${question}`)
    return JSON.stringify(result.finalOutput, null, 2)
  }
})

const askHistorian = tool({
  name: 'ask_historian',
  description: 'Ask the Weather Pattern Historian about historical patterns, past similar events, or climatological context. Use when you need to understand how similar conditions played out historically.',
  parameters: z.object({
    question: z.string().describe('The specific question to ask the historian')
  }),
  execute: async ({ question }) => {
    const context = _currentExpertAnalyses.history 
      ? `Your previous analysis: ${JSON.stringify(_currentExpertAnalyses.history, null, 2)}\n\n`
      : ''
    const result = await run(historianAgent, `${context}Weather context:\n${_currentWeatherContext}\n\nFollow-up question: ${question}`)
    return JSON.stringify(result.finalOutput, null, 2)
  }
})

const askSafetyAnalyst = tool({
  name: 'ask_safety_analyst',
  description: 'Ask the Transportation Safety Analyst about road conditions, plow timing, commute safety, or travel risks. Use when you need clarification on safety assessments or specific timing scenarios.',
  parameters: z.object({
    question: z.string().describe('The specific question to ask the safety analyst')
  }),
  execute: async ({ question }) => {
    const context = _currentExpertAnalyses.safety 
      ? `Your previous analysis: ${JSON.stringify(_currentExpertAnalyses.safety, null, 2)}\n\n`
      : ''
    const result = await run(safetyAnalystAgent, `${context}Weather context:\n${_currentWeatherContext}\n\nFollow-up question: ${question}`)
    return JSON.stringify(result.finalOutput, null, 2)
  }
})

const askNewsIntel = tool({
  name: 'ask_news_intel',
  description: 'Ask the News Intelligence Agent to search for specific local information - neighboring district closures, community sentiment, road reports, or school announcements. Use when you need real-time local signals.',
  parameters: z.object({
    question: z.string().describe('The specific search or question for the news intel agent')
  }),
  execute: async ({ question }) => {
    const context = _currentExpertAnalyses.news 
      ? `Your previous analysis: ${JSON.stringify(_currentExpertAnalyses.news, null, 2)}\n\n`
      : ''
    const result = await run(newsIntelAgent, `${context}Follow-up request: ${question}`)
    return JSON.stringify(result.finalOutput, null, 2)
  }
})

const crossCheckExperts = tool({
  name: 'cross_check_experts',
  description: 'Ask two or more specialists to cross-check each other\'s analyses. Use when you see potential conflicts or want validation between experts.',
  parameters: z.object({
    experts: z.array(z.enum(['meteorologist', 'historian', 'safety_analyst', 'news_intel'])).min(2).describe('Which experts to cross-check'),
    question: z.string().describe('The specific aspect to cross-check or validate')
  }),
  execute: async ({ experts, question }) => {
    const expertMap = {
      meteorologist: { agent: meteorologistAgent, analysis: _currentExpertAnalyses.meteorology },
      historian: { agent: historianAgent, analysis: _currentExpertAnalyses.history },
      safety_analyst: { agent: safetyAnalystAgent, analysis: _currentExpertAnalyses.safety },
      news_intel: { agent: newsIntelAgent, analysis: _currentExpertAnalyses.news }
    }
    
    // Build context from all selected experts
    const combinedContext = experts.map(e => {
      const data = expertMap[e]
      return `${e.toUpperCase()} ANALYSIS:\n${JSON.stringify(data.analysis, null, 2)}`
    }).join('\n\n')
    
    // Ask the first expert to cross-check against the others
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

export const decisionCoordinatorAgent = new Agent({
  name: 'Snow Day Decision Coordinator',
  instructions: decisionCoordinatorPrompt + `

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

Example uses:
- "ask_safety_analyst: If snow ends at 4 AM, how many plow hours before 7:40 AM buses?"
- "ask_news_intel: Check if Forest Hills or Cedar Springs have announced closures"
- "cross_check_experts: meteorologist + safety_analyst - does the ice timing align with commute impact?"

You are IN CONTROL. Use these tools to build confidence in your decision.`,
  model: 'gpt-5.1',
  tools: [askMeteorologist, askHistorian, askSafetyAnalyst, askNewsIntel, crossCheckExperts],
  outputType: FinalPredictionSchema
})

// Export specialist agents for direct use if needed
export { meteorologistAgent, historianAgent, safetyAnalystAgent, newsIntelAgent }

// Multi-agent orchestration function
export async function runSnowDayPrediction(): Promise<{
  meteorology: z.infer<typeof WeatherAnalysisSchema>
  history: z.infer<typeof HistoricalAnalysisSchema>
  safety: z.infer<typeof SafetyAnalysisSchema>
  news: z.infer<typeof NewsAnalysisSchema>
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
    
    // Store weather context for agent tools
    _currentWeatherContext = `Location: ${location}\nWeather Data: ${JSON.stringify(weatherData, null, 2)}`
    
    // Run specialist agents in parallel for initial analysis
    console.log('🔄 Running expert analysis agents...')
    const [meteorologyResult, historyResult, safetyResult, newsResult] = await Promise.all([
      run(meteorologistAgent, `Analyze the current weather forecast and conditions for snow day prediction. Focus on overnight and morning conditions that would impact school operations and transportation safety.`),
      run(historianAgent, `Provide historical context and pattern analysis for the current weather situation. Compare to similar past events and provide climatological perspective for this time of year and location: ${location}.`),
      run(safetyAnalystAgent, `Evaluate transportation safety and travel conditions based on the forecasted weather. Assess risks for school transportation, student/staff commuting, and campus operations.`),
      run(newsIntelAgent, `Search for any local news, social media signals, school district announcements, or community chatter about weather conditions and potential school closures in Rockford, Michigan and surrounding areas. Look for signals from neighboring districts, local news stations, and community sentiment.`)
    ])
    
    // Store expert analyses for agent tools to reference
    _currentExpertAnalyses = {
      meteorology: meteorologyResult.finalOutput,
      history: historyResult.finalOutput,
      safety: safetyResult.finalOutput,
      news: newsResult.finalOutput
    }
    
    console.log('🎯 Coordinating final decision (with agent consultation available)...')
    
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

---
REMINDER: You have tools to consult specialists for follow-up questions if needed:
- ask_meteorologist, ask_historian, ask_safety_analyst, ask_news_intel, cross_check_experts
Use them if you need clarification or see conflicts in the analyses above.
`
    
    // Get final coordinated decision - coordinator can now call agent tools for follow-ups
    const finalResult = await run(
      decisionCoordinatorAgent,
      `Based on the expert analyses provided below, make a final snow day prediction and recommendation. 

Before finalizing, consider:
1. Do any expert analyses conflict? If so, use your tools to clarify.
2. Is the plow timing math clear? If not, ask the safety analyst.
3. Are neighboring district closures confirmed? If uncertain, ask news intel.

Synthesize all inputs and provide a comprehensive decision with clear rationale and confidence levels.

${expertAnalyses}`
    )
    
    console.log('✅ Multi-agent analysis complete!')
    
    return {
      meteorology: meteorologyResult.finalOutput || {} as z.infer<typeof WeatherAnalysisSchema>,
      history: historyResult.finalOutput || {} as z.infer<typeof HistoricalAnalysisSchema>,
      safety: safetyResult.finalOutput || {} as z.infer<typeof SafetyAnalysisSchema>,
      news: newsResult.finalOutput || {} as z.infer<typeof NewsAnalysisSchema>,
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
  NewsAnalysisSchema,
  FinalPredictionSchema
}