import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TodayForecast } from './TodayForecast'
import type { AgentPrediction } from '@/types/agentPrediction'

const report = (overrides: Record<string, unknown> = {}) => ({
  timestamp: '2026-10-05T21:00:00Z', targetDate: '2026-10-06',
  final: { snow_day_probability: 80 },
  meteorology: { precipitation_analysis: { total_snowfall_inches: 2.5, precipitation_type: 'snow' } },
  ...overrides,
} as unknown as AgentPrediction)
const render = (prediction: AgentPrediction | null) => renderToStaticMarkup(createElement(TodayForecast, {
  prediction, onNavigateToDetails: () => {}, onNavigateToHistory: () => {},
}))

describe('Today forecast content', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-05T22:00:00Z')) })
  afterEach(() => vi.useRealTimers())

  it('answers the snow-day question with a date, chance, short weather fact and update time', () => {
    const html = render(report())
    for (const text of ['Chance of a snow day', 'Tuesday, Oct 6', '80</span><small>%', '2.5 in of snow expected.', 'Updated Oct 5', 'Why this chance?']) expect(html).toContain(text)
    expect(html).not.toContain('Archived')
    expect(html).toContain('Past calls')
  })

  it('shows the bus-run high when the single forecaster has no snowfall total', () => {
    const html = render(report({
      architecture: 'single-forecaster-v1', meteorology: undefined, final: { snow_day_probability: 3 },
      morningWeather: { snowInches: null, overnightLowF: 31, morningHighF: 33, maxWindMph: 8, iceType: null, alerts: [] },
    }))
    expect(html).toContain('3</span><small>%')
    expect(html).toContain('High of 33°F during the morning bus run.')
  })

  it('does not put an old percentage on Today', () => {
    const html = render(report({ timestamp: '2026-09-07T21:00:00Z', targetDate: '2026-09-08', final: { snow_day_probability: 1 } }))
    expect(html).toContain('No forecast yet')
    expect(html).toContain('For the next school day.')
    expect(html).toContain('Past calls')
    expect(html).toContain('Last forecast: Tuesday, Sep 8, 2026')
    expect(html).not.toContain('Winter illustration')
    expect(html).not.toContain('School status')
    expect(html).not.toContain('<small>%</small>')
    expect(html).not.toContain('Archived')
  })

  it('also withholds an estimate that is old even when its target is upcoming', () => {
    const html = render(report({ timestamp: '2026-10-03T20:00:00Z' }))
    expect(html).toContain('No forecast yet')
    expect(html).not.toContain('<small>%</small>')
  })

  it.each([undefined, 'garbage', '2026-02-30'])('does not invent a school date or chance for invalid target %s', (targetDate) => {
    const html = render(report({ targetDate }))
    expect(html).toContain('No current forecast')
    expect(html).not.toContain('<small>%</small>')
    expect(html).not.toContain('Tuesday, Oct 6')
  })

  it.each([undefined, 'bad', '2026-10-06T01:00:00Z'])('withholds an estimate with unverified generation time %s', (timestamp) => {
    const html = render(report({ timestamp }))
    expect(html).toContain('We can’t verify the date and time')
    expect(html).not.toContain('<small>%</small>')
  })

  it('shows the supplied future date, without inventing a holiday calendar', () => {
    const html = render(report({ targetDate: '2026-12-25' }))
    expect(html).toContain('Friday, Dec 25')
    expect(html).not.toContain('next school day')
  })

  it.each([0, 100])('preserves a valid %s percent estimate without calling it an official closure', (probability) => {
    const html = render(report({ final: { snow_day_probability: probability } }))
    expect(html).toContain(`${probability}</span><small>%`)
    expect(html).toContain('Chance of a snow day')
    expect(html).not.toContain('School is closed')
  })

  it('does not turn a missing chance into zero', () => {
    const html = render(report({ final: {} }))
    expect(html).toContain('Chance unavailable')
    expect(html).toContain('Weather details')
    expect(html).not.toContain('<small>%</small>')
  })

  it('handles a completely absent forecast without an old or invented chance', () => {
    const html = render(null)
    expect(html).toContain('No current forecast')
    expect(html).not.toContain('<small>%</small>')
  })
})
