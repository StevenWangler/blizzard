import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentPrediction } from '@/types/agentPrediction'
import { AgentsView } from './AgentsView'

vi.mock('@/components/ui/markdown', () => ({
  Markdown: ({ content }: { content: string }) => createElement('p', null, content),
}))

function render(report: unknown) {
  return renderToStaticMarkup(createElement(AgentsView, {
    forecast: { prediction: report as AgentPrediction | null, loading: false, error: null, reload: vi.fn() },
  }))
}

describe('How it works saved report', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-27T03:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('distinguishes a one percent forecast from agreement and from the chance of snow', () => {
    const html = render({
      timestamp: '2026-11-27T01:00:00Z', targetDate: '2026-11-30',
      final: { snow_day_probability: 1, confidence_level: 'high' },
      meteorology: { precipitation_analysis: { snow_probability_morning: 0.5 } },
      collaboration: null,
    })
    expect(html).toContain('Monday, Nov 30, 2026')
    expect(html).toContain('1% chance')
    expect(html).toContain('0.5% chance for morning snow')
    expect(html).not.toContain('100%')
    expect(html).not.toContain('Debate recorded for this forecast')
  })

  it('preserves a fractional archived call and labels an empty debate accurately', () => {
    const html = render({
      timestamp: '2026-01-21T23:00:00Z', targetDate: '2026-01-22',
      final: { snow_day_probability: 0.5 },
      collaboration: { rounds: [], totalRounds: 0, maxRoundsAllowed: 1, finalConsensus: false,
        consensusThreshold: 10, exitReason: 'error', keyDisagreements: [], confidenceJourney: [] },
    })
    expect(html).toContain('Archived snow-day chance')
    expect(html).toContain('0.5% chance')
    expect(html).toContain('Not reached')
    expect(html).not.toContain('>0%</p>')
    expect(html).toContain('20 points')
  })

  it('shows the single forecaster rationale without the retired specialist roster', () => {
    const html = render({ architecture: 'single-forecaster-v1', targetDate: '2026-11-30', timestamp: '2026-11-27T01:00:00Z',
      final: { snow_day_probability: 12, confidence_level: 'moderate', decision_rationale: 'Ice ends before buses leave.' } })
    expect(html).toContain('12% chance')
    expect(html).toContain('Ice ends before buses leave.')
    expect(html).not.toContain('Chief Meteorologist')
  })

  it('keeps the workflow readable when the forecast is missing', () => {
    const html = render(null)
    expect(html).toContain('Unavailable')
    expect(html).toContain('One forecaster reads hourly temperatures')
    expect(html).not.toContain('Latest collaboration')
  })
})
