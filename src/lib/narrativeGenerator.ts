/**
 * Narrative Generator - Transforms structured AI prediction data into natural language summaries
 * 
 * This module provides template-based text generation for creating conversational,
 * human-readable summaries from the structured agent prediction output.
 */

interface TemperatureAnalysis {
  current_temp_f: number
  overnight_low_f: number
  morning_high_f: number
  temperature_trend: 'rising' | 'falling' | 'steady'
  windchill_factor: number
}

interface PrecipitationAnalysis {
  total_snowfall_inches: number
  precipitation_type: 'snow' | 'freezing_rain' | 'sleet' | 'rain' | 'mixed'
  snow_probability_morning: number
}

interface WindAnalysis {
  max_wind_speed_mph: number
  wind_direction: string
  wind_chill_impact: boolean
}

interface VisibilityAnalysis {
  minimum_visibility_miles: number
}

interface Timeline {
  conditions_start: string
  peak_impact_time: string
  conditions_improve: string
}

/**
 * Generate a concise weather summary from meteorological data
 */
export function generateWeatherSummary(
  temp: TemperatureAnalysis,
  precip: PrecipitationAnalysis,
  wind: WindAnalysis,
  visibility: VisibilityAnalysis
): string {
  const parts: string[] = []

  // Precipitation narrative
  if (precip.total_snowfall_inches > 0) {
    const amount = precip.total_snowfall_inches
    const descriptor = amount > 8 ? 'heavy' : amount > 4 ? 'significant' : amount > 2 ? 'moderate' : 'light'
    
    if (precip.precipitation_type === 'mixed') {
      parts.push(`Expect ${descriptor} mixed precipitation with up to ${amount.toFixed(1)}" of accumulation`)
    } else if (precip.precipitation_type === 'snow') {
      parts.push(`${descriptor.charAt(0).toUpperCase() + descriptor.slice(1)} snowfall expected with ${amount.toFixed(1)}" of accumulation`)
    } else {
      parts.push(`${precip.precipitation_type} with ${amount.toFixed(1)}" accumulation expected`)
    }
  } else {
    parts.push('No significant precipitation expected')
  }

  // Temperature and wind chill narrative
  if (wind.wind_chill_impact) {
    parts.push(`with temperatures dropping to ${temp.overnight_low_f}°F and wind chills making it feel even colder`)
  } else if (temp.temperature_trend === 'falling') {
    parts.push(`as temperatures fall from ${temp.current_temp_f}°F to ${temp.overnight_low_f}°F overnight`)
  } else if (temp.overnight_low_f <= 32) {
    parts.push(`with overnight lows around ${temp.overnight_low_f}°F`)
  }

  // Wind narrative (if significant)
  if (wind.max_wind_speed_mph >= 20) {
    const windStrength = wind.max_wind_speed_mph >= 35 ? 'strong' : wind.max_wind_speed_mph >= 25 ? 'gusty' : 'moderate'
    parts.push(`${windStrength} ${wind.wind_direction} winds up to ${wind.max_wind_speed_mph} mph`)
  }

  // Visibility impact (if poor)
  if (visibility.minimum_visibility_miles < 1) {
    parts.push('creating hazardous visibility conditions')
  } else if (visibility.minimum_visibility_miles < 2) {
    parts.push('with reduced visibility')
  }

  // Join parts with appropriate connectors
  if (parts.length === 0) return 'Clear conditions expected'
  if (parts.length === 1) return parts[0] + '.'
  if (parts.length === 2) return parts[0] + ' ' + parts[1] + '.'
  
  return parts[0] + ', ' + parts.slice(1, -1).join(', ') + ', and ' + parts[parts.length - 1] + '.'
}

/**
 * Generate timeline narrative from event timeline data
 */
export function generateTimelineNarrative(timeline: Timeline | undefined | null): string {
  if (!timeline) {
    return 'Timeline information is currently unavailable.'
  }
  const start = timeline.conditions_start ?? 'unknown time'
  const peak = timeline.peak_impact_time ?? 'unknown time'
  const improve = timeline.conditions_improve ?? 'unknown time'
  return `Conditions begin ${start}, peak around ${peak}, and improve by ${improve}.`
}

/**
 * Generate impact statement based on probability and confidence
 */
export function generateImpactStatement(
  probability: number,
  confidence: 'very_low' | 'low' | 'moderate' | 'high' | 'very_high',
  primaryFactors: string[] | undefined | null
): string {
  let likelihoodPhrase = ''
  
  if (probability >= 80) {
    likelihoodPhrase = 'Very likely'
  } else if (probability >= 60) {
    likelihoodPhrase = 'Likely'
  } else if (probability >= 40) {
    likelihoodPhrase = 'Possible'
  } else if (probability >= 20) {
    likelihoodPhrase = 'Unlikely'
  } else {
    likelihoodPhrase = 'Very unlikely'
  }

  const confidencePhrase = confidence === 'very_high' || confidence === 'high' 
    ? ' with high confidence' 
    : confidence === 'moderate' 
      ? ' with moderate confidence'
      : ' with lower confidence'

  const factors = primaryFactors ?? []
  const factorPhrase = factors.length > 0
    ? ` due to ${factors.slice(0, 2).join(' and ')}.`
    : '.'

  return `${likelihoodPhrase} to result in a snow day${confidencePhrase}${factorPhrase}`
}

/**
 * Generate safety advisory based on risk level and road conditions
 */
export function generateSafetyAdvisory(
  riskLevel: 'low' | 'moderate' | 'high' | 'severe',
  roadScore: number,
  drivingScore: number,
  iceRisk: 'low' | 'moderate' | 'high' | 'severe'
): string {
  if (riskLevel === 'low') {
    return 'Normal travel conditions expected. Exercise routine winter caution.'
  }

  if (riskLevel === 'moderate') {
    return 'Some travel difficulties possible. Allow extra time and reduce speeds.'
  }

  if (riskLevel === 'high') {
    const iceWarning = iceRisk === 'high' || iceRisk === 'severe' 
      ? ' Significant ice formation expected.' 
      : ''
    return `Hazardous travel conditions likely.${iceWarning} Avoid unnecessary trips if possible.`
  }

  // severe
  return 'Dangerous travel conditions expected. Avoid all non-essential travel. Emergency personnel may have difficulty reaching locations.'
}

/**
 * Generate contextual recommendations for residents
 */
export function generateResidentRecommendations(
  probability: number,
  timeline: Timeline | undefined | null,
  safetyRisk: 'low' | 'moderate' | 'high' | 'severe'
): string[] {
  const recommendations: string[] = []
  const peakTime = timeline?.peak_impact_time ?? 'the morning hours'

  if (probability >= 50) {
    recommendations.push('Monitor local school and business closings overnight')
    recommendations.push(`Check for official announcements around ${peakTime}`)
  }

  if (probability >= 70) {
    recommendations.push('Prepare for possible closure by arranging childcare or work-from-home options')
  }

  if (safetyRisk === 'high' || safetyRisk === 'severe') {
    recommendations.push('Stock up on essentials before conditions deteriorate')
    recommendations.push('Charge devices and prepare for potential power disruptions')
  }

  if (probability < 30) {
    recommendations.push('Plan for normal schedule, but monitor conditions overnight')
  }

  return recommendations
}

/**
 * Generate full conversational summary from all prediction data
 */
export function generateFullSummary(prediction: {
  meteorology: {
    temperature_analysis: TemperatureAnalysis
    precipitation_analysis: PrecipitationAnalysis
    wind_analysis: WindAnalysis
    visibility_analysis: VisibilityAnalysis
  }
  final: {
    snow_day_probability?: number
    confidence_level?: 'very_low' | 'low' | 'moderate' | 'high' | 'very_high'
    primary_factors?: string[]
    timeline?: Timeline
  }
  safety?: {
    risk_level: 'low' | 'moderate' | 'high' | 'severe'
    road_conditions?: {
      primary_roads_score: number
      ice_formation_risk: 'low' | 'moderate' | 'high' | 'severe'
    }
    travel_safety?: {
      driving_conditions_score: number
    }
  }
}): {
  weatherSummary: string
  impactStatement: string
  timelineNarrative: string
  safetyAdvisory: string
  residentRecommendations: string[]
} {
  // Handle cases where safety data may have an error or be incomplete
  const hasSafetyData = prediction.safety?.road_conditions && prediction.safety?.travel_safety
  
  // Extract final prediction values with defaults
  const probability = prediction.final?.snow_day_probability ?? 0
  const confidence = prediction.final?.confidence_level ?? 'moderate'
  const timeline = prediction.final?.timeline
  
  return {
    weatherSummary: generateWeatherSummary(
      prediction.meteorology.temperature_analysis,
      prediction.meteorology.precipitation_analysis,
      prediction.meteorology.wind_analysis,
      prediction.meteorology.visibility_analysis
    ),
    impactStatement: generateImpactStatement(
      probability,
      confidence,
      prediction.final?.primary_factors
    ),
    timelineNarrative: generateTimelineNarrative(timeline),
    safetyAdvisory: hasSafetyData 
      ? generateSafetyAdvisory(
          prediction.safety.risk_level,
          prediction.safety.road_conditions.primary_roads_score,
          prediction.safety.travel_safety.driving_conditions_score,
          prediction.safety.road_conditions.ice_formation_risk
        )
      : 'Safety analysis is currently unavailable. Please check local conditions and exercise caution.',
    residentRecommendations: generateResidentRecommendations(
      probability,
      timeline,
      hasSafetyData ? prediction.safety.risk_level : 'moderate'
    )
  }
}
