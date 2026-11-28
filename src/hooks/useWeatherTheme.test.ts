import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { AgentPrediction } from '@/types/agentPrediction'
import { forecastThemeKey } from './useWeatherTheme'

const date = '2026-11-30'
const forecast = (values: Record<string, unknown>) => ({
  architecture: 'single-forecaster-v1', timestamp: '2026-11-27T14:00:00Z', targetDate: date, ...values
} as unknown as AgentPrediction)

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-27T18:00:00Z')) })
afterEach(() => vi.useRealTimers())

it('uses the school morning on the target date when NWS omits snow totals and visibility', () => {
  const hour = (date: string, text: string) => [{time: date + ' 07:00', condition: {text}}]
  expect(forecastThemeKey(forecast({ morningWeather: { snowInches: null }, raw_weather_data: {forecast: {forecastday: [
    {date: '2026-11-27', hour: hour('2026-11-27', 'Sunny')},
    {date, hour: hour(date, 'Mostly Cloudy')}
  ]}} }), false)).toBe('overcast')
})

it('uses explicit ice, preserves legacy snowfall, and ignores archived weather', () => {
  expect(forecastThemeKey(forecast({ morningWeather: { iceType: 'sleet' } }), false)).toBe('sleet')
  expect(forecastThemeKey(forecast({ architecture: undefined, meteorology: {
    precipitation_analysis: {total_snowfall_inches: 8}, wind_analysis: {max_wind_speed_mph: 30},
    visibility_analysis: {minimum_visibility_miles: 1}
  } }), false)).toBe('blizzard')
  expect(forecastThemeKey(forecast({ timestamp: '2025-11-01T12:00:00Z', morningWeather: {iceType: 'sleet'} }), false)).toBeNull()
})
