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
 * 
 * COLLABORATION SYSTEM:
 * - Iterative debate rounds where agents see peer outputs and can challenge/adjust
 * - Consensus detection: exit early when agents within ±10% probability
 * - Max 5 rounds to prevent infinite loops
 * - Specialist-to-specialist tools for organic back-and-forth
 */

import { Agent, tool, run, setTracingDisabled, webSearchTool, codeInterpreterTool } from '@openai/agents'
import { z } from 'zod'
import type { 
  WeatherApiResponse, 
  ProcessedWeatherData,
  WeatherAlert,
  HourlyWeather 
} from "@/types/weatherTypes"
import type {
  AgentId,
  AgentCollaboration,
  CollaborationRound,
  DebatePosition,
  DebateExchange
} from "@/types/agentPrediction"

// Enable tracing for debugging and monitoring agent workflows (false = tracing ON)
setTracingDisabled(false)
import { weatherApi, isWeatherApiKeyConfigured } from './weatherApi'
import { getRelevantWeatherInformation } from './weatherProcessing'

// Import agent prompts from external files
import meteorologistPrompt from './prompts/meteorologist.txt?raw'
import historianPrompt from './prompts/historian.txt?raw'
import safetyAnalystPrompt from './prompts/safety-analyst.txt?raw'
import newsIntelPrompt from './prompts/news-intel.txt?raw'
import infrastructurePrompt from './prompts/infrastructure.txt?raw'
import powerGridPrompt from './prompts/power-grid.txt?raw'
import webWeatherVerifierPrompt from './prompts/web-weather-verifier.txt?raw'
import decisionCoordinatorPrompt from './prompts/decision-coordinator.txt?raw'

// ============================================================================
// COLLABORATION CONFIGURATION
// ============================================================================

export interface CollaborationConfig {
  maxRounds: number           // Hard cap on debate rounds (default: 5)
  consensusThreshold: number  // Agents within ±X% = consensus (default: 10)
  enableDebate: boolean       // Enable multi-round debate (default: true)
}

export const defaultCollaborationConfig: CollaborationConfig = {
  maxRounds: 5,
  consensusThreshold: 10,
  enableDebate: true
}

let collaborationConfig: CollaborationConfig = { ...defaultCollaborationConfig }

export function setCollaborationConfig(config: Partial<CollaborationConfig>): void {
  collaborationConfig = { ...collaborationConfig, ...config }
}

export function getCollaborationConfig(): CollaborationConfig {
  return { ...collaborationConfig }
}

// ============================================================================
// AGENT CONFIGURATION
// ============================================================================

export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high'

export interface AgentConfig {
  model: string
  reasoningEffort: ReasoningEffort
}

export interface AgentSystemConfig {
  meteorologist: AgentConfig
  historian: AgentConfig
  safetyAnalyst: AgentConfig
  newsIntel: AgentConfig
  infrastructureMonitor: AgentConfig
  powerGridAnalyst: AgentConfig
  webWeatherVerifier: AgentConfig
  decisionCoordinator: AgentConfig
}

// Default configuration - can be overridden via setAgentConfig()
export const defaultAgentConfig: AgentSystemConfig = {
  meteorologist: { model: 'gpt-5.2', reasoningEffort: 'high' },
  historian: { model: 'gpt-5.2', reasoningEffort: 'medium' },
  safetyAnalyst: { model: 'gpt-5.2', reasoningEffort: 'medium' },
  newsIntel: { model: 'gpt-5.2', reasoningEffort: 'medium' },
  infrastructureMonitor: { model: 'gpt-5.2', reasoningEffort: 'medium' },
  powerGridAnalyst: { model: 'gpt-5.2', reasoningEffort: 'medium' },
  webWeatherVerifier: { model: 'gpt-5.2', reasoningEffort: 'high' },
  decisionCoordinator: { model: 'gpt-5.2', reasoningEffort: 'high' }
}

// Current active configuration
let agentConfig: AgentSystemConfig = { ...defaultAgentConfig }

// Update agent configuration at runtime
export function setAgentConfig(config: Partial<AgentSystemConfig>): void {
  agentConfig = { ...agentConfig, ...config }
}

// Get current agent configuration
export function getAgentConfig(): AgentSystemConfig {
  return { ...agentConfig }
}

// ============================================================================

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
    current_feels_like_f: z.number(),
    overnight_low_f: z.number(),
    overnight_feels_like_f: z.number(),
    morning_high_f: z.number(),
    morning_feels_like_f: z.number(),
    freezing_hours: z.number(),
    temperature_trend: z.enum(['rising', 'falling', 'steady']),
    windchill_factor: z.number(),
    feels_like_below_minus_20: z.boolean()
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

// Schema for agents to provide probability estimates during debate rounds
const DebatePositionSchema = z.object({
  snow_day_probability: z.number().min(0).max(100).describe('Your current probability estimate'),
  confidence: z.number().min(0).max(100).describe('How confident are you in this estimate (0-100)'),
  key_factors: z.array(z.string()).describe('Top 3-5 factors driving your estimate'),
  rationale: z.string().describe('Brief explanation of your reasoning'),
  challenges: z.array(z.object({
    target_agent: z.enum(['meteorology', 'history', 'safety', 'news', 'infrastructure', 'powerGrid', 'webWeatherVerifier']).describe('Which agent you are challenging'),
    challenge: z.string().describe('What you disagree with or want clarification on'),
    impact: z.enum(['high', 'medium', 'low']).describe('How much this affects your estimate')
  })).optional().describe('Any challenges or questions for other agents'),
  adjustments_from_peer_input: z.string().optional().describe('How peer analyses changed your thinking this round')
})

// Schema for debate response when challenged
const DebateResponseSchema = z.object({
  response: z.string().describe('Your response to the challenge'),
  probability_adjustment: z.number().min(-30).max(30).describe('How much you adjusted your probability based on this challenge'),
  new_probability: z.number().min(0).max(100).describe('Your updated probability estimate'),
  resolution: z.enum(['agreed', 'disagreed', 'compromised']).describe('How was this challenge resolved')
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
  model: agentConfig.meteorologist.model,
  modelSettings: { reasoningEffort: agentConfig.meteorologist.reasoningEffort },
  tools: [weatherDataTool, webSearchTool(), codeInterpreterTool()],
  outputType: WeatherAnalysisSchema
})

const historianAgent = new Agent({
  name: 'Weather Pattern Historian',
  instructions: historianPrompt,
  model: agentConfig.historian.model,
  modelSettings: { reasoningEffort: agentConfig.historian.reasoningEffort },
  tools: [webSearchTool(), codeInterpreterTool()],
  outputType: HistoricalAnalysisSchema
})

const safetyAnalystAgent = new Agent({
  name: 'Transportation Safety Analyst',
  instructions: safetyAnalystPrompt,
  model: agentConfig.safetyAnalyst.model,
  modelSettings: { reasoningEffort: agentConfig.safetyAnalyst.reasoningEffort },
  tools: [weatherDataTool, webSearchTool(), codeInterpreterTool()],
  outputType: SafetyAnalysisSchema
})

const newsIntelAgent = new Agent({
  name: 'Local News Intelligence',
  instructions: newsIntelPrompt,
  model: agentConfig.newsIntel.model,
  modelSettings: { reasoningEffort: agentConfig.newsIntel.reasoningEffort },
  tools: [webSearchTool()],
  outputType: NewsAnalysisSchema
})

const infrastructureMonitorAgent = new Agent({
  name: 'Regional Infrastructure Monitor',
  instructions: infrastructurePrompt,
  model: agentConfig.infrastructureMonitor.model,
  modelSettings: { reasoningEffort: agentConfig.infrastructureMonitor.reasoningEffort },
  tools: [webSearchTool()],
  outputType: InfrastructureAnalysisSchema
})

const powerGridAnalystAgent = new Agent({
  name: 'Power Grid Analyst',
  instructions: powerGridPrompt,
  model: agentConfig.powerGridAnalyst.model,
  modelSettings: { reasoningEffort: agentConfig.powerGridAnalyst.reasoningEffort },
  tools: [webSearchTool()],
  outputType: PowerGridAnalysisSchema
})

const webWeatherVerifierAgent = new Agent({
  name: 'Web Weather Verification Specialist',
  instructions: webWeatherVerifierPrompt,
  model: agentConfig.webWeatherVerifier.model,
  modelSettings: { reasoningEffort: agentConfig.webWeatherVerifier.reasoningEffort },
  tools: [weatherDataTool, webSearchTool()],
  outputType: WebWeatherVerifierSchema
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
  infrastructure?: z.infer<typeof InfrastructureAnalysisSchema>
  powerGrid?: z.infer<typeof PowerGridAnalysisSchema>
  webWeatherVerifier?: z.infer<typeof WebWeatherVerifierSchema>
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
    experts: z.array(z.enum(['meteorologist', 'historian', 'safety_analyst', 'news_intel', 'infrastructure_monitor', 'power_grid_analyst'])).min(2).describe('Which experts to cross-check'),
    question: z.string().describe('The specific aspect to cross-check or validate')
  }),
  execute: async ({ experts, question }) => {
    const expertMap = {
      meteorologist: { agent: meteorologistAgent, analysis: _currentExpertAnalyses.meteorology },
      historian: { agent: historianAgent, analysis: _currentExpertAnalyses.history },
      safety_analyst: { agent: safetyAnalystAgent, analysis: _currentExpertAnalyses.safety },
      news_intel: { agent: newsIntelAgent, analysis: _currentExpertAnalyses.news },
      infrastructure_monitor: { agent: infrastructureMonitorAgent, analysis: _currentExpertAnalyses.infrastructure },
      power_grid_analyst: { agent: powerGridAnalystAgent, analysis: _currentExpertAnalyses.powerGrid }
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

const askInfrastructureMonitor = tool({
  name: 'ask_infrastructure_monitor',
  description: 'Ask the Regional Infrastructure Monitor about road clearing operations, plow fleet status, MDOT/county road conditions, salt supply, or municipal response levels. Use when you need real-time ground truth on whether roads will actually be clear by school time.',
  parameters: z.object({
    question: z.string().describe('The specific question about road infrastructure or clearing operations')
  }),
  execute: async ({ question }) => {
    const context = _currentExpertAnalyses.infrastructure 
      ? `Your previous analysis: ${JSON.stringify(_currentExpertAnalyses.infrastructure, null, 2)}\n\n`
      : ''
    const result = await run(infrastructureMonitorAgent, `${context}Weather context:\n${_currentWeatherContext}\n\nFollow-up question: ${question}`)
    return JSON.stringify(result.finalOutput, null, 2)
  }
})

const askPowerGridAnalyst = tool({
  name: 'ask_power_grid_analyst',
  description: 'Ask the Power Grid Analyst about current power outages, grid stress levels, utility restoration timelines, or school facility power status. Use when outages are reported or ice storm conditions threaten the grid.',
  parameters: z.object({
    question: z.string().describe('The specific question about power grid status or outages')
  }),
  execute: async ({ question }) => {
    const context = _currentExpertAnalyses.powerGrid 
      ? `Your previous analysis: ${JSON.stringify(_currentExpertAnalyses.powerGrid, null, 2)}\n\n`
      : ''
    const result = await run(powerGridAnalystAgent, `${context}Weather context:\n${_currentWeatherContext}\n\nFollow-up question: ${question}`)
    return JSON.stringify(result.finalOutput, null, 2)
  }
})

const askWebWeatherVerifier = tool({
  name: 'ask_web_weather_verifier',
  description: 'Ask the Web Weather Verifier to cross-check Weather API data against web sources like Weather.com, Weather.gov, and local news. CRITICAL for verifying "feels like" temperature below -20°F (automatic closure threshold). Use when you need to validate API data or find discrepancies.',
  parameters: z.object({
    question: z.string().describe('The specific question about weather data verification or comparison')
  }),
  execute: async ({ question }) => {
    const context = _currentExpertAnalyses.webWeatherVerifier 
      ? `Your previous analysis: ${JSON.stringify(_currentExpertAnalyses.webWeatherVerifier, null, 2)}\n\n`
      : ''
    const result = await run(webWeatherVerifierAgent, `${context}Weather context:\n${_currentWeatherContext}\n\nFollow-up question: ${question}`)
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
- **ask_infrastructure_monitor**: Get real-time plow fleet status, road clearing progress, MDOT conditions
- **ask_power_grid_analyst**: Check power outages, grid stress, utility restoration timelines
- **ask_web_weather_verifier**: Cross-check Weather API data against web sources, verify "feels like" temperature
- **cross_check_experts**: Have experts validate each other's analyses

USE THESE TOOLS when:
1. You see a conflict between expert analyses
2. You need more detail on a specific aspect
3. You want to validate your reasoning
4. Something doesn't add up and you need clarification
5. You want to confirm neighboring district status is current
6. You need to verify critical temperature thresholds like "feels like" below -20°F

Example uses:
- "ask_safety_analyst: If snow ends at 4 AM, how many plow hours before 7:40 AM buses?"
- "ask_news_intel: Check if Forest Hills or Cedar Springs have announced closures"
- "ask_infrastructure_monitor: What's the current plow activity on county roads? Are they keeping up?"
- "ask_power_grid_analyst: Any power outages in the Rockford area? Is the grid under stress?"
- "ask_web_weather_verifier: What does Weather.com show for feels like temperature tomorrow morning?"
- "ask_web_weather_verifier: Cross-check the API snowfall forecast against web sources"
- "cross_check_experts: meteorologist + safety_analyst - does the ice timing align with commute impact?"
- "cross_check_experts: infrastructure_monitor + safety_analyst - do actual road conditions match safety's assumptions?"

You are IN CONTROL. Use these tools to build confidence in your decision.`,
  model: agentConfig.decisionCoordinator.model,
  modelSettings: { reasoningEffort: agentConfig.decisionCoordinator.reasoningEffort },
  tools: [askMeteorologist, askHistorian, askSafetyAnalyst, askNewsIntel, askInfrastructureMonitor, askPowerGridAnalyst, askWebWeatherVerifier, crossCheckExperts],
  outputType: FinalPredictionSchema
})

// Export specialist agents for direct use if needed
export { meteorologistAgent, historianAgent, safetyAnalystAgent, newsIntelAgent, infrastructureMonitorAgent, powerGridAnalystAgent, webWeatherVerifierAgent }

// ============================================================================
// COLLABORATIVE DEBATE SYSTEM
// ============================================================================

// Agent for providing debate positions with probability estimates
const debateAgent = new Agent({
  name: 'Debate Position Agent',
  instructions: `You are participating in a collaborative debate about snow day probability.
Review the weather data and peer analyses, then provide your position with a probability estimate.
Be willing to adjust your estimate based on peer input and challenges.
Focus on constructive disagreement - challenge assumptions, not conclusions.`,
  model: agentConfig.decisionCoordinator.model,
  modelSettings: { reasoningEffort: 'medium' },
  tools: [webSearchTool()],
  outputType: DebatePositionSchema
})

/**
 * Extract probability estimate from agent analysis
 */
function extractProbabilityFromAnalysis(agentId: AgentId, analysis: unknown): number {
  if (!analysis || typeof analysis !== 'object') return 50 // Default uncertainty

  const a = analysis as Record<string, unknown>
  
  switch (agentId) {
    case 'meteorology':
      // Use snow probability as base
      const precip = a.precipitation_analysis as Record<string, unknown> | undefined
      if (precip) {
        const snowProb = (precip.snow_probability_morning as number) || (precip.snow_probability_overnight as number)
        const snowfall = (precip.total_snowfall_inches as number) || 0
        // Higher snowfall = higher closure probability
        if (snowfall >= 8) return Math.min(snowProb + 30, 95)
        if (snowfall >= 6) return Math.min(snowProb + 15, 85)
        return snowProb || 50
      }
      return 50

    case 'history':
      // Use historical snow day rate
      const patterns = a.similar_weather_patterns as Array<{ historical_snow_day_rate: number }> | undefined
      if (patterns && patterns.length > 0) {
        return patterns[0].historical_snow_day_rate || 50
      }
      return 50

    case 'safety':
      // Convert risk level to probability
      const riskLevel = a.risk_level as string
      const riskMap: Record<string, number> = { low: 15, moderate: 40, high: 70, severe: 90 }
      return riskMap[riskLevel] || 50

    case 'news':
      // Use community sentiment
      const sentiment = (a.community_intel as Record<string, unknown>)?.social_media_sentiment as string
      const sentimentMap: Record<string, number> = {
        expecting_closure: 75,
        uncertain: 50,
        expecting_school: 25,
        no_buzz: 40
      }
      // Boost if neighboring districts closed
      const closures = (a.school_district_signals as Record<string, unknown>)?.neighboring_district_closures as string[] | undefined
      const closureBoost = (closures?.length || 0) * 10
      return Math.min((sentimentMap[sentiment] || 50) + closureBoost, 95)

    case 'infrastructure':
      // Use road clearing timeline
      const timeline = a.clearing_timeline as Record<string, unknown> | undefined
      const hoursUntil = (timeline?.hours_until_bus_routes as number) || 3
      if (hoursUntil <= 0) return 20 // Roads will be clear
      if (hoursUntil <= 2) return 35
      if (hoursUntil <= 4) return 55
      return 75 // Roads won't be clear in time

    case 'powerGrid':
      // Use school facility risk
      const schoolRisk = (a.school_facility_risk as Record<string, unknown>)?.risk_level as string
      const powerRiskMap: Record<string, number> = { low: 10, moderate: 35, high: 65, severe: 90 }
      return powerRiskMap[schoolRisk] || 20

    case 'webWeatherVerifier':
      // Use discrepancy analysis and critical alerts
      const discrepancy = a.discrepancy_analysis as Record<string, unknown> | undefined
      const criticalAlerts = a.critical_alerts as Array<Record<string, unknown>> | undefined
      
      // If feels like is below -20, that's automatic closure consideration
      if (discrepancy?.feels_like_below_minus_20) return 85
      
      // If major discrepancies found, increase probability
      if (discrepancy?.major_discrepancies_found) return 60
      
      // Otherwise, neutral
      return 50

    default:
      return 50
  }
}

/**
 * Calculate probability spread across all agent positions
 */
function calculateProbabilitySpread(positions: DebatePosition[]): number {
  if (positions.length === 0) return 0
  const probs = positions.map(p => p.probability)
  return Math.max(...probs) - Math.min(...probs)
}

/**
 * Check if consensus has been reached
 */
function checkConsensus(positions: DebatePosition[], threshold: number): boolean {
  const spread = calculateProbabilitySpread(positions)
  return spread <= threshold * 2 // ±threshold means total spread of 2*threshold
}

/**
 * Run a single debate round where agents review peer analyses and provide updated positions
 */
async function runDebateRound(
  roundNumber: number,
  previousPositions: DebatePosition[],
  weatherContext: string,
  expertAnalyses: Record<string, unknown>
): Promise<{ positions: DebatePosition[], debates: DebateExchange[] }> {
  const agentIds: AgentId[] = ['meteorology', 'history', 'safety', 'news', 'infrastructure', 'powerGrid', 'webWeatherVerifier']
  
  // Build peer context for this round
  const peerContext = previousPositions.length > 0 
    ? `\n\nPREVIOUS ROUND POSITIONS:\n${previousPositions.map(p => 
        `- ${p.agentId}: ${p.probability}% (confidence: ${p.confidence}%) - ${p.rationale}`
      ).join('\n')}`
    : ''

  // Run all agents in parallel to get their positions
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
      const output = result.finalOutput as z.infer<typeof DebatePositionSchema>
      return {
        agentId,
        probability: output.snow_day_probability,
        confidence: output.confidence,
        rationale: output.rationale,
        keyFactors: output.key_factors,
        challenges: output.challenges || []
      }
    } catch (error) {
      // Fallback: extract probability from original analysis
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
  
  // Process challenges into debate exchanges
  const debates: DebateExchange[] = []
  for (const position of positionsWithChallenges) {
    if (position.challenges && position.challenges.length > 0) {
      for (const challenge of position.challenges) {
        debates.push({
          round: roundNumber,
          topic: challenge.challenge,
          challenger: position.agentId,
          challenged: challenge.target_agent as AgentId,
          challenge: challenge.challenge,
          response: '', // Will be filled in if we implement response mechanism
          resolution: 'disagreed', // Default
          probabilityShift: 0
        })
      }
    }
  }

  const positions: DebatePosition[] = positionsWithChallenges.map(p => ({
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
async function runCollaborativeDebate(
  weatherContext: string,
  expertAnalyses: Record<string, unknown>
): Promise<AgentCollaboration> {
  const { maxRounds, consensusThreshold } = collaborationConfig
  const rounds: CollaborationRound[] = []
  let previousPositions: DebatePosition[] = []
  let consensusReached = false
  let exitReason: 'consensus' | 'max_rounds' | 'error' = 'max_rounds'

  console.log(`🤝 Starting collaborative debate (max ${maxRounds} rounds, consensus at ±${consensusThreshold}%)...`)

  // Track initial positions for confidence journey
  const initialPositions: Record<AgentId, number> = {} as Record<AgentId, number>

  for (let round = 1; round <= maxRounds; round++) {
    console.log(`📢 Debate round ${round}/${maxRounds}...`)
    
    try {
      const { positions, debates } = await runDebateRound(
        round,
        previousPositions,
        weatherContext,
        expertAnalyses
      )

      // Store initial positions from round 1
      if (round === 1) {
        positions.forEach(p => {
          initialPositions[p.agentId] = p.probability
        })
      }

      const spread = calculateProbabilitySpread(positions)
      consensusReached = checkConsensus(positions, consensusThreshold)

      const roundData: CollaborationRound = {
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

  // Build confidence journey
  const lastPositions = previousPositions.length > 0 ? previousPositions : []
  const confidenceJourney = lastPositions.map(p => ({
    agentId: p.agentId,
    initialProbability: initialPositions[p.agentId] || p.probability,
    finalProbability: p.probability,
    totalShift: p.probability - (initialPositions[p.agentId] || p.probability),
    shiftReason: p.rationale
  }))

  // Identify key disagreements (high spread topics)
  const keyDisagreements = rounds
    .flatMap(r => r.debates)
    .filter(d => d.probabilityShift !== 0 || d.resolution === 'disagreed')
    .slice(0, 5)
    .map(d => ({
      topic: d.topic,
      agents: [d.challenger, d.challenged],
      positions: [d.challenge, d.response],
      resolution: d.resolution,
      impact: 'medium' as const
    }))

  // Generate summary
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

// Multi-agent orchestration function
export async function runSnowDayPrediction(): Promise<{
  meteorology: z.infer<typeof WeatherAnalysisSchema>
  history: z.infer<typeof HistoricalAnalysisSchema>
  safety: z.infer<typeof SafetyAnalysisSchema>
  news: z.infer<typeof NewsAnalysisSchema>
  infrastructure: z.infer<typeof InfrastructureAnalysisSchema>
  powerGrid: z.infer<typeof PowerGridAnalysisSchema>
  webWeatherVerifier: z.infer<typeof WebWeatherVerifierSchema>
  final: z.infer<typeof FinalPredictionSchema>
  collaboration?: AgentCollaboration
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
    console.log('🔄 Running expert analysis agents (7 specialists)...')
    const [meteorologyResult, historyResult, safetyResult, newsResult, infrastructureResult, powerGridResult, webWeatherVerifierResult] = await Promise.all([
      run(meteorologistAgent, `Analyze the current weather forecast and conditions for snow day prediction. Focus on overnight and morning conditions that would impact school operations and transportation safety.`),
      run(historianAgent, `Provide historical context and pattern analysis for the current weather situation. Compare to similar past events and provide climatological perspective for this time of year and location: ${location}.`),
      run(safetyAnalystAgent, `Evaluate transportation safety and travel conditions based on the forecasted weather. Assess risks for school transportation, student/staff commuting, and campus operations.`),
      run(newsIntelAgent, `Search for any local news, social media signals, school district announcements, or community chatter about weather conditions and potential school closures in Rockford, Michigan and surrounding areas. Look for signals from neighboring districts, local news stations, and community sentiment.`),
      run(infrastructureMonitorAgent, `Search for current road clearing operations and plow fleet status in Kent County and surrounding Michigan areas. Check MDOT road conditions, county road commission updates, and municipal response levels. Focus on whether roads will be passable by 6:30 AM when school buses start routes.`),
      run(powerGridAnalystAgent, `Search for current power outage information in the Rockford, Michigan and Kent County area. Check Consumers Energy outage maps, grid stress levels, and any utility statements. Assess whether power infrastructure will support normal school operations.`),
      run(webWeatherVerifierAgent, `Cross-reference the Weather API data against multiple web sources including Weather.com, Weather.gov, AccuWeather, and local news weather pages for ${location}. CRITICAL: Verify "feels like" temperature data - if any source shows below -20°F, this triggers automatic closure consideration. Compare API forecasts with what the public is seeing on their weather apps.`)
    ])
    
    // Store expert analyses for agent tools to reference
    _currentExpertAnalyses = {
      meteorology: meteorologyResult.finalOutput,
      history: historyResult.finalOutput,
      safety: safetyResult.finalOutput,
      news: newsResult.finalOutput,
      infrastructure: infrastructureResult.finalOutput,
      powerGrid: powerGridResult.finalOutput,
      webWeatherVerifier: webWeatherVerifierResult.finalOutput
    }

    // Run collaborative debate if enabled
    let collaboration: AgentCollaboration | undefined
    if (collaborationConfig.enableDebate) {
      collaboration = await runCollaborativeDebate(
        _currentWeatherContext,
        _currentExpertAnalyses as unknown as Record<string, unknown>
      )
    }
    
    console.log('🎯 Coordinating final decision (with agent consultation available)...')
    
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
METEOROLOGICAL ANALYSIS (Weight: 30%):
${JSON.stringify(meteorologyResult.finalOutput, null, 2)}

HISTORICAL PATTERN ANALYSIS (Weight: 15%):
${JSON.stringify(historyResult.finalOutput, null, 2)}

SAFETY ASSESSMENT (Weight: 20%):
${JSON.stringify(safetyResult.finalOutput, null, 2)}

LOCAL NEWS & COMMUNITY INTELLIGENCE (Weight: 15%):
${JSON.stringify(newsResult.finalOutput, null, 2)}

INFRASTRUCTURE & ROAD CLEARING STATUS (Weight: 10%):
${JSON.stringify(infrastructureResult.finalOutput, null, 2)}

POWER GRID & UTILITY STATUS (Weight: 5%):
${JSON.stringify(powerGridResult.finalOutput, null, 2)}

WEB WEATHER VERIFICATION (Critical Cross-Check):
${JSON.stringify(webWeatherVerifierResult.finalOutput, null, 2)}
${collaborationContext}
LOCATION: ${location}
ANALYSIS TIMESTAMP: ${new Date().toISOString()}

---
REMINDER: You have tools to consult specialists for follow-up questions if needed:
- ask_meteorologist, ask_historian, ask_safety_analyst, ask_news_intel, ask_infrastructure_monitor, ask_power_grid_analyst, ask_web_weather_verifier, cross_check_experts
Use them if you need clarification or see conflicts in the analyses above.
`
    
    // Get final coordinated decision - coordinator can now call agent tools for follow-ups
    const finalResult = await run(
      decisionCoordinatorAgent,
      `Based on the expert analyses provided below, make a final snow day prediction and recommendation. 

Before finalizing, consider:
1. Do any expert analyses conflict? If so, use your tools to clarify.
2. Is the plow timing math clear? If not, ask the safety analyst or infrastructure monitor.
3. Are neighboring district closures confirmed? If uncertain, ask news intel.
4. Are there any power outage concerns? If infrastructure is borderline, check with power grid analyst.
5. Do the infrastructure monitor's actual road conditions match the safety analyst's assumptions?
${collaboration ? `6. The agents debated for ${collaboration.totalRounds} round(s). Consider unresolved disagreements.` : ''}

Synthesize all inputs and provide a comprehensive decision with clear rationale and confidence levels.

${expertAnalyses}`
    )
    
    // Apply extreme cold floor to final probability
    // This is a hard programmatic constraint - extreme cold guarantees high closure probability
    let finalPrediction = finalResult.finalOutput || {} as z.infer<typeof FinalPredictionSchema>
    
    // Check for extreme cold from multiple sources
    const meteorologyData = meteorologyResult.finalOutput as z.infer<typeof WeatherAnalysisSchema> | undefined
    const webVerifierData = webWeatherVerifierResult.finalOutput as z.infer<typeof WebWeatherVerifierSchema> | undefined
    
    const extremeColdFromMeteorology = meteorologyData?.temperature_analysis?.feels_like_below_minus_20
    const extremeColdFromWebVerifier = webVerifierData?.discrepancy_analysis?.feels_like_below_minus_20
    const morningFeelsLike = meteorologyData?.temperature_analysis?.morning_feels_like_f
    const windchillFactor = meteorologyData?.temperature_analysis?.windchill_factor
    const overnightLow = meteorologyData?.temperature_analysis?.overnight_low_f
    
    // Determine extreme cold condition from ANY available source
    const hasExtremeCold = 
      extremeColdFromMeteorology === true ||
      extremeColdFromWebVerifier === true ||
      (morningFeelsLike !== undefined && morningFeelsLike <= -20) ||
      (windchillFactor !== undefined && windchillFactor <= -20) ||
      (overnightLow !== undefined && overnightLow <= -15) // Very cold overnight = dangerous morning wind chill
    
    const hasDangerousCold = 
      (morningFeelsLike !== undefined && morningFeelsLike <= -15) ||
      (windchillFactor !== undefined && windchillFactor <= -15) ||
      (overnightLow !== undefined && overnightLow <= -10)
    
    // Log detected values for debugging
    console.log(`🌡️ Cold detection: windchill_factor=${windchillFactor}, overnight_low=${overnightLow}, morning_feels_like=${morningFeelsLike}`)
    
    // Apply floor if ANY source indicates extreme cold (≤ -20°F)
    if (hasExtremeCold) {
      const currentProb = finalPrediction.snow_day_probability || 0
      if (currentProb < 95) {
        console.log(`🥶 EXTREME COLD OVERRIDE: Raising probability from ${currentProb}% to 95% (wind chill ≤ -20°F = automatic closure)`)
        finalPrediction = {
          ...finalPrediction,
          snow_day_probability: 95,
          primary_factors: [
            'EXTREME COLD: Wind chill ≤ -20°F triggers AUTOMATIC closure - buses cannot operate safely',
            ...(finalPrediction.primary_factors || []).filter(f => !f.includes('EXTREME COLD'))
          ]
        }
      }
    } else if (hasDangerousCold) {
      // -15°F to -20°F floor at 50%
      const currentProb = finalPrediction.snow_day_probability || 0
      if (currentProb < 50) {
        console.log(`❄️ DANGEROUS COLD OVERRIDE: Raising probability from ${currentProb}% to 50% (wind chill -15°F to -20°F)`)
        finalPrediction = {
          ...finalPrediction,
          snow_day_probability: 50,
          primary_factors: [
            'DANGEROUS COLD: Wind chill -15°F to -20°F - many districts close proactively',
            ...(finalPrediction.primary_factors || []).filter(f => !f.includes('DANGEROUS COLD'))
          ]
        }
      }
    }
    
    console.log('✅ Multi-agent analysis complete!')
    
    return {
      meteorology: meteorologyResult.finalOutput || {} as z.infer<typeof WeatherAnalysisSchema>,
      history: historyResult.finalOutput || {} as z.infer<typeof HistoricalAnalysisSchema>,
      safety: safetyResult.finalOutput || {} as z.infer<typeof SafetyAnalysisSchema>,
      news: newsResult.finalOutput || {} as z.infer<typeof NewsAnalysisSchema>,
      infrastructure: infrastructureResult.finalOutput || {} as z.infer<typeof InfrastructureAnalysisSchema>,
      powerGrid: powerGridResult.finalOutput || {} as z.infer<typeof PowerGridAnalysisSchema>,
      webWeatherVerifier: webWeatherVerifierResult.finalOutput || {} as z.infer<typeof WebWeatherVerifierSchema>,
      final: finalPrediction,
      collaboration,
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
  InfrastructureAnalysisSchema,
  PowerGridAnalysisSchema,
  FinalPredictionSchema,
  DebatePositionSchema,
  DebateResponseSchema
}

// Export collaboration functions
export { runCollaborativeDebate }