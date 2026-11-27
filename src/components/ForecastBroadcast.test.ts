import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BroadcastCard, WatchForecast } from './WatchForecast'
import { ForecastTicker } from './ForecastTicker'
import { SeasonalLandingPage } from './SeasonalLandingPage'

describe('broadcast accessible content', () => {
  it('renders zero as a real estimate and district text as text, never injected markup', () => {
    const html = renderToStaticMarkup(createElement(BroadcastCard, { slide: { id: 'outlook', label: 'Exact report date', title: 'Snow day unlikely', text: 'Forecast only. District decides.', facts: [], duration: 7000, probability: 0 }, districtNotes: ['<script>bad()</script>'] }))
    expect(html).toContain('0<span>%</span>')
    expect(html).toContain('District note in this report')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
  })
  it('keeps watch optional and does not load the illustration before opening', () => {
    const html = renderToStaticMarkup(createElement(WatchForecast, { prediction: null }))
    expect(html).toContain('Watch forecast')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('role="dialog"')
  })
  it('does not announce the scrolling ticker repeatedly and exposes a pause control', () => {
    const html = renderToStaticMarkup(createElement(ForecastTicker, { prediction: null }))
    expect(html).toContain('aria-live="off"')
    expect(html).toContain('Pause forecast ticker')
    expect(html).toContain('No verified current forecast')
    expect(html).toContain('aria-hidden="true"')
  })
  it('gives loading/error ticker states without invented forecasts', () => {
    expect(renderToStaticMarkup(createElement(ForecastTicker, { prediction: null, loading: true }))).toContain('Loading the forecast')
    const html = renderToStaticMarkup(createElement(ForecastTicker, { prediction: null, error: true }))
    expect(html).toContain('Forecast unavailable')
    expect(html).not.toContain('% chance')
  })
  it('makes seasonal standby truthful with no automatic reactivation countdown or archive access', () => {
    const html = renderToStaticMarkup(createElement(SeasonalLandingPage))
    expect(html).toContain('SEASONAL STANDBY')
    expect(html).toContain('are off air.')
    expect(html).toContain('when the season is reactivated')
    expect(html).not.toContain('01 NOV')
    expect(html).not.toContain('DAYS')
    expect(html).not.toContain('href="#')
  })
})
