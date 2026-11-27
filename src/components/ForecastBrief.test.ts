import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ForecastBrief } from './ForecastBrief'
import type { AgentPrediction } from '@/types/agentPrediction'

// Markdown sanitization requires a browser DOM. These tests cover the brief's
// state and content, not the separate rich-text rendering implementation.
vi.mock('@/components/ui/markdown', () => ({
  Markdown: ({ content }: { content: string }) => createElement('p', null, content),
}))

const render = (prediction: AgentPrediction | null) => renderToStaticMarkup(
  createElement(ForecastBrief, { prediction, fallback: null, nextRefresh: '2h' }),
)

const report = (overrides: Partial<AgentPrediction> = {}) => ({
  timestamp: '2026-10-05T21:00:00Z',
  targetDate: '2026-10-06',
  targetDayName: 'Monday', // Deliberately wrong: the date should win.
  final: { snow_day_probability: 0.8, confidence_level: 'moderate', primary_factors: ['Road ice', 'Morning snow', 'Other context'] },
  meteorology: {
    precipitation_analysis: { total_snowfall_inches: 2.5 },
    wind_analysis: { max_wind_speed_mph: 20 },
    temperature_analysis: { overnight_low_f: 25 },
    visibility_analysis: { minimum_visibility_miles: 1 },
    alert_summary: [{ type: 'Winter Weather Advisory', description: 'Ice possible through the morning commute. Take extra care on bridges.' }],
  },
  ...overrides,
} as unknown as AgentPrediction)

describe('student forecast brief', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-05T22:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('leads with the correct school date and normalizes the probability', () => {
    const html = render(report())
    expect(html).toContain('Tuesday, Oct 6')
    expect(html).toContain('Snow day likely.')
    expect(html).toContain('80<small>%</small>')
    expect(html).toContain('2.5 in')
    expect(html).toContain('25°F')
    expect(html).toContain('Chance of a snow day')
    expect(html).toContain('Updated Oct 5, 2026')
    expect(html).toContain('Rockford Public Schools makes the final call.')
    expect(html).toContain('2.5 in of snow expected.')
    expect(html).not.toContain('Road ice')
    expect(html).not.toContain('Morning snow')
    expect(html).not.toContain('Other context')
    expect(html).toContain('<h3 id="forecast-weather-title">The morning weather</h3>')
    expect(html.match(/Rockford Public Schools makes the final call/g)).toHaveLength(1)
  })

  it('reads provider measurements and missing values from a single-forecaster snapshot', () => {
    const fresh = report({ architecture: 'single-forecaster-v1', morningWeather: {
      snowInches: null, overnightLowF: 29, overnightFeelsLikeF: null, morningHighF: 32,
      maxWindMph: 12, minVisibilityMiles: null, iceType: 'freezing_rain', alerts: ['Winter Weather Advisory'],
    } })
    const html = render(fresh)
    expect(html).toContain('Freezing rain expected.')
    expect(html).toContain('29°F')
    expect(html).toContain('12 mph')
    expect(html).not.toContain('2.5 in')
    expect(html).toContain('Winter Weather Advisory')
  })

  it('does not promote an archived report as a live school status or countdown', () => {
    const html = render(report({ timestamp: '2026-01-29T23:00:00Z', targetDate: '2026-01-30' }))
    expect(html).toContain('Earlier estimate')
    expect(html).toContain('for this date')
    expect(html).toContain('Friday, Jan 30, 2026')
    expect(html).not.toContain('Archived')
    expect(html).toContain('2026')
    expect(html).not.toContain('Snow day likely.')
    expect(html).not.toContain('Next scheduled update')
  })

  it('displays a decimal estimate from an archived report as recorded', () => {
    const archived = report({ timestamp: '2026-02-22T23:09:01Z', targetDate: '2026-02-23' })
    archived.final.snow_day_probability = 0.5
    expect(render(archived)).toContain('0.5<small>%</small>')
  })

  it('preserves full alert text, separately from shortened analysis previews', () => {
    const html = render(report())
    expect(html).toContain('Weather alerts in this report')
    expect(html).toContain('Ice possible through the morning commute. Take extra care on bridges.')
  })

  it('does not attach a probability to a forecast without a verified target date', () => {
    const html = render(report({ targetDate: undefined }))
    expect(html).toContain('Forecast date unavailable')
    expect(html).toContain('Chance unavailable')
    expect(html).not.toContain('80<small>%</small>')
    expect(html).not.toContain('Snow day likely.')
  })

  it('shows unavailable data rather than inventing a zero probability or weather', () => {
    const html = render(null)
    expect(html).toContain('We can’t verify this forecast’s date and time.')
    expect(html).toContain('Update time unavailable')
    expect(html).toContain('—')
    expect(html).not.toContain('0<small>%</small>')
    expect(html).not.toContain('0 in')
    expect(html).not.toContain('School is likely open')
  })
})
