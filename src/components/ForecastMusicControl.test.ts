import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ForecastMusicControl, ForecastMusicCredits } from './ForecastMusicControl'
import { MUSIC_ARTIST_URL, MUSIC_CREDIT } from '@/lib/forecastMusic'

vi.mock('@/lib/forecastMusicAsset', () => ({ forecastMusicUrl: '/test-only/licensed.mp3' }))

describe('music control and attribution', () => {
  it('renders enabled but never claims playing before client playback succeeds', () => {
    const html = renderToStaticMarkup(createElement(ForecastMusicControl))
    expect(html).toContain('aria-label="Start forecast music"')
    expect(html).toContain('PLAY')
    expect(html).toContain('aria-pressed="false"')
    expect(html).not.toContain('<audio')
    expect(html).not.toContain('licensed.mp3')
    expect(html).not.toContain('autoplay')
  })

  it('retains the exact supplied credit in an accessible disclosure', () => {
    expect(`${MUSIC_CREDIT} ${MUSIC_ARTIST_URL}`).toBe("Music: 'Fireside Romance' by Albert Behar on #Uppbeat https://uppbeat.io/c/albert-behar")
    const html = renderToStaticMarkup(createElement(ForecastMusicCredits))
    expect(html).toContain('<summary>Music credits</summary>')
    expect(html).toContain('Fireside Romance')
    expect(html).toContain('Albert Behar on #Uppbeat')
    expect(html).toContain(`href="${MUSIC_ARTIST_URL}"`)
    expect(html).not.toContain('download=')
    expect(html).not.toContain('.mp3')
  })
})
