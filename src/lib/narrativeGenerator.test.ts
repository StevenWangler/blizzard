import { describe, expect, it } from 'vitest'
import { generateFullSummary, generateSafetyAdvisory } from './narrativeGenerator'

type SummaryInput = Parameters<typeof generateFullSummary>[0]

const report = (safety?: SummaryInput['safety']): SummaryInput => ({
  meteorology: {
    temperature_analysis: { current_temp_f: 25, overnight_low_f: 20, morning_high_f: 28, temperature_trend: 'steady', windchill_factor: 0 },
    precipitation_analysis: { total_snowfall_inches: 2, precipitation_type: 'snow', snow_probability_morning: 60 },
    wind_analysis: { max_wind_speed_mph: 10, wind_direction: 'W', wind_chill_impact: false },
    visibility_analysis: { minimum_visibility_miles: 5 },
  },
  final: { snow_day_probability: 40, confidence_level: 'moderate' },
  safety,
})

describe('summary safety data boundaries', () => {
  it('handles an absent safety analysis without inventing travel conditions', () => {
    expect(generateFullSummary(report()).safetyAdvisory).toContain('Safety analysis is currently unavailable')
  })

  it('requires both road and travel data before producing a safety advisory', () => {
    for (const safety of [
      { risk_level: 'high' as const },
      { risk_level: 'high' as const, road_conditions: { primary_roads_score: 2, ice_formation_risk: 'high' as const } },
      { risk_level: 'high' as const, travel_safety: { driving_conditions_score: 2 } },
    ]) {
      expect(generateFullSummary(report(safety)).safetyAdvisory).toContain('Safety analysis is currently unavailable')
    }
  })

  it('retains a complete safety assessment, including valid zero-valued scores', () => {
    const summary = generateFullSummary(report({
      risk_level: 'high',
      road_conditions: { primary_roads_score: 0, ice_formation_risk: 'severe' },
      travel_safety: { driving_conditions_score: 0 },
    }))
    expect(summary.safetyAdvisory).toBe(generateSafetyAdvisory('high', 0, 0, 'severe'))
    expect(summary.safetyAdvisory).toContain('Significant ice formation expected')
    expect(summary.residentRecommendations).toContain('Stock up on essentials before conditions deteriorate')
  })
})
