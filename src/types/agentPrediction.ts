// Agent identifiers for collaboration tracking
export type AgentId = 'meteorology' | 'history' | 'safety' | 'news' | 'infrastructure' | 'powerGrid' | 'webWeatherVerifier' | 'final'

// Collaboration types for multi-round debate system
export interface DebatePosition {
  agentId: AgentId
  probability: number
  confidence: number // 0-100
  rationale: string
  keyFactors: string[]
}

export interface DebateExchange {
  round: number
  topic: string
  challenger: AgentId
  challenged: AgentId
  challenge: string
  response: string
  resolution: 'agreed' | 'disagreed' | 'compromised'
  probabilityShift?: number
}

export interface CollaborationRound {
  round: number
  timestamp: string
  positions: DebatePosition[]
  probabilitySpread: number // max - min probability across agents
  consensusReached: boolean
  debates: DebateExchange[]
  roundSummary: string
}

export interface AgentCollaboration {
  totalRounds: number
  maxRoundsAllowed: number
  consensusThreshold: number // e.g., 10 = agents within ±10% is consensus
  finalConsensus: boolean
  exitReason: 'consensus' | 'max_rounds' | 'error'
  rounds: CollaborationRound[]
  confidenceJourney: Array<{
    agentId: AgentId
    initialProbability: number
    finalProbability: number
    totalShift: number
    shiftReason: string
  }>
  keyDisagreements: Array<{
    topic: string
    agents: AgentId[]
    positions: string[]
    resolution: string
    impact: 'high' | 'medium' | 'low'
  }>
  collaborationSummary: string
}

export interface AgentPrediction {
  meteorology: {
    temperature_analysis: {
      current_temp_f: number
      overnight_low_f: number
      morning_high_f: number
      freezing_hours: number
      temperature_trend: 'rising' | 'falling' | 'steady'
      windchill_factor: number
    }
    precipitation_analysis: {
      snow_probability_overnight: number
      snow_probability_morning: number
      total_snowfall_inches: number
      snowfall_rate_peak: number
      precipitation_type: 'snow' | 'freezing_rain' | 'sleet' | 'rain' | 'mixed' | 'none'
    }
    wind_analysis: {
      max_wind_speed_mph: number
      wind_direction: string
      sustained_winds_mph: number
      wind_chill_impact: boolean
    }
    visibility_analysis: {
      minimum_visibility_miles: number
      avg_visibility_miles: number
      visibility_factors: string[]
    }
    alert_summary: Array<{
      type: string
      severity: string
      description: string
    }>
    overall_conditions_summary: string
  }
  history: {
    similar_weather_patterns: Array<{
      pattern_description: string
      historical_snow_day_rate: number
      confidence_level: 'high' | 'medium' | 'low'
    }>
    seasonal_context: {
      typical_conditions_for_date: string
      unusual_factors: string[]
      seasonal_probability_adjustment: number
    }
    location_specific_factors: {
      local_microclimates: string[]
      infrastructure_considerations: string[]
      elevation_impact: string
    }
    confidence_assessment: string
  }
  safety: {
    road_conditions: {
      primary_roads_score: number
      secondary_roads_score: number
      parking_lots_score: number
      ice_formation_risk: 'low' | 'moderate' | 'high' | 'severe'
    }
    travel_safety: {
      walking_conditions_score: number
      driving_conditions_score: number
      public_transport_impact: 'minimal' | 'moderate' | 'significant' | 'severe'
      emergency_access_concern: boolean
    }
    timing_analysis: {
      worst_conditions_start_time: string
      worst_conditions_end_time: string
      morning_commute_impact: 'minimal' | 'moderate' | 'significant' | 'severe'
      afternoon_impact: 'minimal' | 'moderate' | 'significant' | 'severe'
    }
    safety_recommendations: string[]
    risk_level: 'low' | 'moderate' | 'high' | 'severe'
  }
  news: {
    local_news: Array<{
      source: string
      headline: string
      summary: string
      relevance: 'high' | 'medium' | 'low'
      url?: string
    }>
    school_district_signals: {
      official_announcements: string[]
      early_dismissal_history: boolean
      neighboring_district_closures: string[]
    }
    community_intel: {
      social_media_sentiment: 'expecting_closure' | 'uncertain' | 'expecting_school' | 'no_buzz'
      reported_road_conditions: string[]
      power_outage_reports: boolean
      local_event_cancellations: string[]
    }
    key_findings_summary: string
  }
  infrastructure: {
    road_clearing_status: {
      state_highways: {
        status: 'clear' | 'partially_covered' | 'snow_covered' | 'ice_covered' | 'impassable'
        plow_activity_level: 'heavy' | 'moderate' | 'light' | 'none'
        estimated_clear_time: string
        score: number
      }
      county_roads: {
        status: 'clear' | 'partially_covered' | 'snow_covered' | 'ice_covered' | 'impassable'
        plow_activity_level: 'heavy' | 'moderate' | 'light' | 'none'
        estimated_clear_time: string
        score: number
      }
      local_streets: {
        status: 'clear' | 'partially_covered' | 'snow_covered' | 'ice_covered' | 'impassable'
        plow_activity_level: 'heavy' | 'moderate' | 'light' | 'none'
        estimated_clear_time: string
        score: number
      }
      parking_lots: {
        status: 'clear' | 'partially_cleared' | 'not_started' | 'unknown'
        estimated_clear_time: string
        score: number
      }
    }
    resource_levels: {
      salt_sand_supply: 'adequate' | 'moderate' | 'low' | 'critical'
      plow_fleet_status: 'full_deployment' | 'partial' | 'limited' | 'breakdown_issues'
      driver_availability: 'full_staffing' | 'moderate' | 'understaffed'
    }
    municipal_response_level: 'aggressive' | 'normal' | 'limited' | 'overwhelmed'
    clearing_timeline: {
      snow_end_time: string
      hours_until_bus_routes: number
      estimated_road_condition_at_6_30_am: string
      confidence_in_estimate: 'high' | 'moderate' | 'low'
    }
    overall_clearing_assessment: string
    data_confidence: 'high' | 'moderate' | 'low' | 'very_low'
    data_sources: string[]
    key_concerns: string[]
  }
  powerGrid: {
    current_outages: {
      total_customers_affected: number
      outages_in_school_district: 'none' | 'some' | 'significant' | 'unknown'
      affected_areas: string[]
      cause: 'storm_damage' | 'equipment_failure' | 'high_demand' | 'ice_accumulation' | 'unknown' | 'none'
    }
    outage_trend: 'increasing' | 'stable' | 'decreasing' | 'new_event' | 'none'
    grid_stress_level: 'normal' | 'elevated' | 'high' | 'critical'
    heating_demand: {
      demand_level: 'normal' | 'elevated' | 'high' | 'extreme'
      overnight_low_f: number
      wind_chill_impact: 'minimal' | 'moderate' | 'significant'
      extended_cold_concern: boolean
    }
    school_facility_risk: {
      schools_without_power: 'none' | 'some' | 'unknown'
      schools_in_outage_areas: string[]
      traffic_signals_affected: boolean
      estimated_restoration_time: string
      risk_level: 'low' | 'moderate' | 'high' | 'severe'
    }
    restoration_estimate: {
      estimated_hours_to_restore: number
      factors_affecting_restoration: string[]
      utility_statements: string
    }
    overall_grid_assessment: string
    data_confidence: 'high' | 'moderate' | 'low' | 'very_low'
    data_sources: string[]
    special_alerts: string[]
  }
  webWeatherVerifier: {
    weather_sources: Array<{
      source_name: string
      url: string
      current_temp_f: number
      feels_like_temp_f: number
      forecast_feels_like_f: number
      snowfall_forecast_inches: number
      wind_speed_mph: number
      alerts: string[]
      data_timestamp: string
      reliability: 'high' | 'medium' | 'low'
    }>
    api_comparison: {
      api_feels_like_f: number
      web_average_feels_like_f: number
      difference_f: number
      api_temp_f: number
      web_average_temp_f: number
      temp_difference_f: number
      snowfall_difference_inches: number
    }
    critical_alerts: Array<{
      severity: 'critical' | 'warning' | 'info'
      message: string
      affected_parameter: string
    }>
    discrepancy_analysis: {
      major_discrepancies_found: boolean
      feels_like_below_minus_20: boolean
      consensus_level: 'strong' | 'moderate' | 'weak' | 'conflicting'
      reliability_score: number
      data_freshness: 'current' | 'recent' | 'stale' | 'unknown'
    }
    verification_summary: string
    recommendation: 'trust_api' | 'trust_web' | 'investigate_further' | 'use_average'
  }
  final: {
    snow_day_probability: number
    confidence_level: 'very_low' | 'low' | 'moderate' | 'high' | 'very_high'
    primary_factors: string[]
    timeline: {
      conditions_start: string
      peak_impact_time: string
      conditions_improve: string
    }
    decision_rationale: string
    alternative_scenarios: Array<{
      scenario: string
      probability: number
      impact: string
    }>
    recommendations: {
      for_schools: string[]
      for_residents: string[]
      for_authorities: string[]
    }
    updates_needed: boolean
    next_evaluation_time: string
  }
  // Collaboration data from multi-round debate system
  collaboration?: AgentCollaboration
  timestamp: string
  targetDate?: string
  targetDayName?: string
  daysAhead?: number
  location: string
}
