import { useEffect, useId, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { Pause, Play } from '@phosphor-icons/react'
import type { AgentPrediction } from '@/types/agentPrediction'
import { buildForecastBroadcast, type BroadcastFact } from '@/lib/forecastBroadcast'

export function ForecastTicker({ prediction, loading = false, error = false, suspended = false }: { prediction: AgentPrediction | null; loading?: boolean; error?: boolean; suspended?: boolean }) {
  const reduceMotion = useReducedMotion()
  const [paused, setPaused] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const id = useId()
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  const stopped = paused || !!reduceMotion || suspended
  const facts: BroadcastFact[] = loading ? [{ label: 'Rockford', value: 'Loading the forecast…' }] : error ? [{ label: 'Rockford', value: 'Forecast unavailable' }, { label: 'School status', value: 'Check district announcements' }] : buildForecastBroadcast(prediction, now).ticker
  const content = facts.map((fact, index) => <span className="ticker-fact" key={index}><strong>{fact.label}</strong><span>{fact.value}</span><span className="ticker-separator" aria-hidden="true">◆</span></span>)
  return <section className={`forecast-ticker ${stopped ? 'is-static' : ''}`} aria-label="Local forecast ticker" aria-live="off">
    <button type="button" className="ticker-switch" onClick={() => setPaused(value => !value)} disabled={!!reduceMotion || suspended} aria-label={reduceMotion ? 'Ticker is static with reduced motion' : stopped ? 'Resume forecast ticker' : 'Pause forecast ticker'} aria-pressed={stopped} aria-controls={id} title={stopped ? 'Ticker paused' : 'Tap to pause ticker'}><span>LOCAL</span>{stopped ? <Play size={12} aria-hidden="true" /> : <Pause size={12} aria-hidden="true" />}</button>
    {!stopped && <p className="sr-only">{facts.map(fact => `${fact.label}: ${fact.value}`).join('. ')}</p>}
    <div id={id} className="ticker-window" tabIndex={stopped ? 0 : undefined} aria-label={stopped ? 'Forecast facts. Scroll horizontally for more.' : undefined}>
      <div className="ticker-track" aria-hidden={stopped ? undefined : true}>
        <div className="ticker-copy">{content}</div><div className="ticker-copy ticker-repeat" aria-hidden="true">{content}</div>
      </div>
    </div>
  </section>
}
