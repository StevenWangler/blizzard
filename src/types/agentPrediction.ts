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
  timestamp: string
  targetDate?: string
  targetDayName?: string
  daysAhead?: number
  location: string
}
