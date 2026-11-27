import { describe, expect, it } from 'vitest'
import type { AgentPrediction } from '@/types/agentPrediction'
import { broadcastStep, buildForecastBroadcast } from './forecastBroadcast'

const now = new Date('2026-11-01T20:00:00Z')
const report = (overrides: Record<string, unknown> = {}) => ({
  timestamp: '2026-11-01T19:00:00Z', targetDate: '2026-11-02',
  final: { snow_day_probability: 72, next_evaluation_time: 'not a promised schedule' },
  meteorology: {
    temperature_analysis: { overnight_low_f: 18, morning_high_f: 24, overnight_feels_like_f: 8 },
    precipitation_analysis: { total_snowfall_inches: 3.5, precipitation_type: 'snow' },
    wind_analysis: { max_wind_speed_mph: 26 },
  }, ...overrides,
} as unknown as AgentPrediction)

describe('forecast broadcast truth and timing', () => {
  it('matches illustrations to target-date bus hours and keeps conditional and unknown weather readable', () => {
    const day = '2026-11-02'
    const hour = (time: string, condition: string) => ({ time: `${day} ${time}:00`, condition: { text: condition }, temp_f: 0 })
    const prediction = report({ raw_weather_data: { forecast: { forecastday: [
      { date: '2026-11-01', hour: [hour('07', 'Heavy rain')] },
      { date: day, hour: [hour('06', 'Chance of snow'), hour('07', 'Partly Sunny'), hour('08', 'Fog'), hour('18', 'Sunny')] },
    ] } } })
    const { slides } = buildForecastBroadcast(prediction, now)
    expect(slides[0].hours).toMatchObject([{ time: '7 AM', symbol: 'partly' }])
    expect(slides.find(s => s.id === 'timing')?.hours).toEqual([
      { time: '6 AM', symbol: 'snow', condition: 'Chance of snow', temperature: 0 },
      { time: '7 AM', symbol: 'partly', condition: 'Partly Sunny', temperature: 0 },
      { time: '8 AM', symbol: undefined, condition: 'Fog', temperature: 0 },
    ])
    expect(buildForecastBroadcast(prediction, new Date('2026-11-03')).slides.every(s => !s.hours)).toBe(true)
  })
  it('builds a 27-second current forecast with the actual target date, chance and structured facts', () => {
    const model = buildForecastBroadcast(report(), now)
    expect(model.slides.map(card => card.id)).toEqual(['opening', 'outlook', 'timing', 'reasons', 'closing'])
    expect(model.slides.reduce((total, card) => total + card.duration, 0)).toBe(27000)
    expect(model.slides[1]).toMatchObject({ label: 'Monday, Nov 2, 2026', probability: 72, title: 'Snow day likely' })
    expect(model.slides[2].facts).toEqual([{ label: 'Overnight low', value: '18°F' }, { label: 'Morning high', value: '24°F' }])
    expect(model.slides[3].facts).toHaveLength(3)
    expect(JSON.stringify(model)).not.toContain('school-start')
    expect(JSON.stringify(model)).not.toContain('not a promised schedule')
  })
  it.each([0, 100])('preserves a valid %s percent without declaring an official closure', probability => {
    const model = buildForecastBroadcast(report({ final: { snow_day_probability: probability } }), now)
    expect(model.slides[1].probability).toBe(probability)
    expect(model.ticker).toContainEqual({ label: 'Snow day', value: `${probability}% chance` })
    expect(model.slides[1].text).toContain('the district decides')
  })
  it('uses the supplied date, not a hardcoded Monday or invented holiday calendar', () => {
    const model = buildForecastBroadcast(report({ targetDate: '2026-12-25' }), now)
    expect(model.ticker).toContainEqual({ label: 'School date', value: 'Friday, Dec 25, 2026' })
  })
  it('withholds the old percentage and all old weather in both broadcast and ticker', () => {
    const model = buildForecastBroadcast(report({ timestamp: '2026-10-29T19:00:00Z' }), now)
    expect(model.current).toBe(false)
    expect(model.slides.map(card => card.id)).toEqual(['opening', 'outlook', 'closing'])
    expect(model.slides[1].title).toBe('No forecast yet')
    expect(model.slides[1].probability).toBeUndefined()
    expect(model.ticker.some(fact => /chance|snow expected|winds up to/i.test(fact.label))).toBe(false)
    expect(model.slides.reduce((total, card) => total + card.duration, 0)).toBe(20000)
  })
  it.each([undefined, 'bad', '2026-02-30'])('does not invent a current target from %s', targetDate => {
    const model = buildForecastBroadcast(report({ targetDate }), now)
    expect(model.current).toBe(false)
    expect(model.slides[1].probability).toBeUndefined()
    expect(model.ticker.some(fact => fact.label === 'School date')).toBe(false)
  })
  it.each([undefined, 'bad', '2026-11-02T02:00:00Z'])('withholds unverified/future generation time %s', timestamp => {
    expect(buildForecastBroadcast(report({ timestamp }), now).current).toBe(false)
  })
  it('handles missing report and unknown probability without converting either to zero', () => {
    const missing = buildForecastBroadcast(null, now)
    expect(missing.slides[1].title).toBe('No current forecast')
    const unknown = buildForecastBroadcast(report({ final: {} }), now)
    expect(unknown.slides[1].probability).toBeUndefined()
    expect(unknown.slides[1].title).toBe('Chance unavailable')
  })
  it('omits unsupported periods and never pads reasons with invented conditions', () => {
    const model = buildForecastBroadcast(report({ meteorology: {} }), now)
    expect(model.slides.map(card => card.id)).toEqual(['opening', 'outlook', 'closing'])
    expect(model.slides.flatMap(card => card.facts).map(fact => fact.label)).toEqual(['Updated'])
  })
  it('does not hide freezing rain behind a zero snow amount', () => {
    const model = buildForecastBroadcast(report({ meteorology: { precipitation_analysis: { total_snowfall_inches: 0, precipitation_type: 'freezing_rain' } } }), now)
    expect(model.slides.find(card => card.id === 'reasons')?.facts).toEqual([{ label: 'Precipitation', value: 'Freezing rain' }])
  })
  it('rejects nonfinite/negative amounts and preserves meaningful zero and subzero temperatures', () => {
    const model = buildForecastBroadcast(report({ meteorology: { precipitation_analysis: { total_snowfall_inches: NaN }, wind_analysis: { max_wind_speed_mph: -1 }, temperature_analysis: { overnight_low_f: -4, morning_high_f: 0 } } }), now)
    expect(model.slides.find(card => card.id === 'reasons')).toBeUndefined()
    expect(model.slides.find(card => card.id === 'timing')?.facts.map(fact => fact.value)).toEqual(['-4°F', '0°F'])
  })
  it('retains current district notes visibly, excluding them when the report is stale', () => {
    const news = { school_district_signals: { official_announcements: ['District notice supplied in report'] } }
    expect(buildForecastBroadcast(report({ news }), now).districtNotes).toEqual(['District notice supplied in report'])
    expect(buildForecastBroadcast(report({ news, timestamp: '2026-10-01T19:00:00Z' }), now).districtNotes).toEqual([])
  })
  it('bounds manual navigation at the first and last cards', () => {
    expect(broadcastStep(0, -1, 5)).toBe(0)
    expect(broadcastStep(4, 1, 5)).toBe(4)
    expect(broadcastStep(1, 1, 5)).toBe(2)
  })
  it('expires a report left open past its freshness window', () => {
    const prediction = report()
    expect(buildForecastBroadcast(prediction, now).slides[1].probability).toBe(72)
    const later = buildForecastBroadcast(prediction, new Date('2026-11-02T20:00:00Z'))
    expect(later.current).toBe(false)
    expect(later.slides[1].probability).toBeUndefined()
    expect(later.ticker.some(fact => fact.value === '72% chance')).toBe(false)
  })
})
