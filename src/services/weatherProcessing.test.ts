import { describe, expect, it } from 'vitest'
import { calculateTrend, calculateWindChill, getHourlyForecastData } from './weatherProcessing'
import type { HourlyWeather } from '@/types/weatherTypes'

const hour = (time: string, overrides: Partial<HourlyWeather> = {}): HourlyWeather => ({
  time_epoch: Date.parse(`${time.replace(' ', 'T')}Z`) / 1000,
  time,
  temp_c: -3.9,
  temp_f: 25,
  is_day: 0,
  feelslike_c: -6.7,
  feelslike_f: 20,
  windchill_c: -6.7,
  windchill_f: 20,
  heatindex_c: -3.9,
  heatindex_f: 25,
  dewpoint_c: -9.4,
  dewpoint_f: 15,
  will_it_rain: 0,
  chance_of_rain: 0,
  will_it_snow: 1,
  chance_of_snow: 50,
  snow_cm: 2,
  wind_mph: 12,
  wind_kph: 19.3,
  wind_degree: 270,
  wind_dir: 'W',
  gust_mph: 18,
  gust_kph: 29,
  vis_miles: 4,
  vis_km: 6.4,
  humidity: 80,
  cloud: 100,
  pressure_mb: 1010,
  pressure_in: 29.83,
  precip_mm: 1,
  precip_in: 0.04,
  uv: 0,
  condition: { text: 'Snow', icon: '', code: 1210 },
  ...overrides
})

describe('weather processing', () => {
  it('identifies steady and material trends', () => {
    expect(calculateTrend([20])).toBe('steady')
    expect(calculateTrend([20, 20.2, 20.3, 20.4])).toBe('steady')
    expect(calculateTrend([10, 12, 16, 18])).toBe('increasing')
    expect(calculateTrend([18, 16, 12, 10])).toBe('decreasing')
  })

  it('only applies wind chill in conditions where it is meaningful', () => {
    expect(calculateWindChill(55, 20)).toBe(55)
    expect(calculateWindChill(20, 2)).toBe(20)
    expect(calculateWindChill(20, 15)).toBeLessThan(20)
  })

  it('includes both sides of an overnight forecast window', () => {
    const processed = getHourlyForecastData([
      hour('2026-02-03 18:00'),
      hour('2026-02-03 20:00'),
      hour('2026-02-04 01:00'),
      hour('2026-02-04 08:00')
    ], 19, 8)

    expect(processed.total_hours_analyzed).toBe(2)
    expect(processed.hour_20_probability).toBeTypeOf('number')
    expect(processed.hour_1_probability).toBeTypeOf('number')
    expect(processed.hour_18_probability).toBeUndefined()
    expect(processed.hour_8_probability).toBeUndefined()
  })
})
