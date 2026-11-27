import { useCallback, useEffect, useRef, useState } from 'react'
import { MusicNotesSimple, Pause, Play, WarningCircle } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { attachMusicLifecycle, ForecastMusic, MUSIC_ARTIST_URL, MUSIC_CREDIT, type MusicState } from '@/lib/forecastMusic'
import { forecastMusicUrl } from '@/lib/forecastMusicAsset'
import { readMusicEnabled, writeMusicEnabled } from '@/lib/musicPreference'

export function ForecastMusicControl({ navigationKey }: { navigationKey: string }) {
  const [state, setState] = useState<MusicState>('off')
  const [enabled, setEnabled] = useState(readMusicEnabled)
  const enabledPreference = useRef(enabled)
  const previousNavigation = useRef(navigationKey)
  const host = useRef<HTMLSpanElement>(null)
  const player = useRef<ForecastMusic | null>(null)

  const rememberEnabled = useCallback((next: boolean) => {
    enabledPreference.current = next
    setEnabled(next)
    writeMusicEnabled(next)
  }, [])

  const getPlayer = useCallback(() => {
    if (!player.current) player.current = new ForecastMusic(() => {
      if (!forecastMusicUrl || !host.current) throw new Error('Music unavailable')
      const audio = document.createElement('audio')
      audio.preload = 'none'
      audio.loop = true
      audio.hidden = true
      audio.setAttribute('data-forecast-music', '')
      try { audio.volume = 0.18 } catch { /* Some mobile platforms use hardware volume only. */ }
      audio.src = forecastMusicUrl
      host.current.append(audio)
      return audio
    }, next => {
      setState(next)
      if (next === 'error') toast.error('Music couldn’t start. Tap the music button to retry.', { id: 'forecast-music-error' })
      else toast.dismiss('forecast-music-error')
    }, () => rememberEnabled(false))
    return player.current
  }, [rememberEnabled])

  useEffect(() => {
    const current = getPlayer()
    setState(current.state)
    const detach = attachMusicLifecycle(current, document, window)
    if (forecastMusicUrl && enabledPreference.current) current.autoplay()
    return () => {
      detach()
      current.dispose()
      if (player.current === current) player.current = null
    }
  }, [getPlayer])

  useEffect(() => {
    if (previousNavigation.current !== navigationKey) {
      previousNavigation.current = navigationKey
      player.current?.pause()
    }
  }, [navigationKey])

  if (!forecastMusicUrl) return null
  const active = state === 'playing'
  const needsTap = state === 'blocked' || (state === 'off' && enabled)
  const label = active ? 'Pause forecast music' : state === 'loading' ? 'Cancel forecast music' : state === 'error' ? 'Retry forecast music' : needsTap ? 'Start forecast music' : 'Play forecast music'
  const Icon = state === 'error' ? WarningCircle : active ? Pause : needsTap ? Play : MusicNotesSimple
  const status = active ? 'ON' : state === 'error' ? 'RETRY' : state === 'loading' ? '…' : needsTap ? 'PLAY' : 'OFF'
  return <>
    <Button type="button" variant="ghost" className="forecast-music-control min-h-11 min-w-11" onClick={() => { const current = getPlayer(); rememberEnabled(!current.requested); current.toggle() }} aria-label={label} aria-pressed={active} aria-busy={state === 'loading'} title={label}>
      <Icon size={14} weight={active || needsTap ? 'fill' : 'regular'} aria-hidden="true" />
      <span className="music-tap-label">Music <span>{status}</span></span>
    </Button>
    <span className="sr-only" role="status" aria-live="polite">{active ? 'Forecast music playing' : state === 'loading' ? 'Loading forecast music' : state === 'blocked' ? 'Autoplay is blocked. Tap Play to start forecast music.' : state === 'error' ? 'Forecast music couldn’t play. Tap to retry.' : enabled ? 'Forecast music enabled. Tap Play to start.' : 'Forecast music off'}</span>
    <span ref={host} hidden />
  </>
}

export function ForecastMusicCredits() {
  return <details className="page-disclosure music-credits">
    <summary>Music credits</summary>
    <div className="page-disclosure-content"><p>{MUSIC_CREDIT}{' '}<a href={MUSIC_ARTIST_URL} target="_blank" rel="noopener noreferrer">{MUSIC_ARTIST_URL}</a></p></div>
  </details>
}
