import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Pause, Play, ArrowCounterClockwise } from '@phosphor-icons/react'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { buildForecastBroadcast, broadcastStep, type BroadcastSlide } from '@/lib/forecastBroadcast'
import type { AgentPrediction } from '@/types/agentPrediction'

export function BroadcastCard({ slide, districtNotes = [] }: { slide: BroadcastSlide; districtNotes?: string[] }) {
  return <section className={`program-card program-${slide.id}`} aria-label={slide.label}>
    <p className="program-eyebrow">{slide.label}</p>
    <h3>{slide.title}</h3>
    {slide.id === 'opening' && <figure className="program-art"><img src="/images/broadcast/winter-school-river-v2-1280.webp" srcSet="/images/broadcast/winter-school-river-v2-640.webp 640w, /images/broadcast/winter-school-river-v2-1280.webp 1280w" sizes="(min-width: 700px) 674px, calc(100vw - 26px)" width="1280" height="640" decoding="async" alt="" /><figcaption>Illustration · not current conditions</figcaption></figure>}
    {slide.probability !== undefined && <p className="program-probability">{slide.probability}<span>%</span></p>}
    <p className="program-copy">{slide.text}</p>
    {!!slide.facts.length && <dl className="program-facts">{slide.facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>}
    {slide.id === 'outlook' && !!districtNotes.length && <aside className="program-district-note"><h4>District note in this report</h4>{districtNotes.map((note, index) => <p key={index}>{note}</p>)}</aside>}
  </section>
}

export function WatchForecast({ prediction }: { prediction: AgentPrediction | null }) {
  const reducedMotion = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [finished, setFinished] = useState(false)
  const [readAll, setReadAll] = useState(false)
  const pointer = useRef<{ x: number; y: number } | null>(null)
  const readButton = useRef<HTMLButtonElement>(null)
  const model = buildForecastBroadcast(prediction)
  const position = Math.min(index, model.slides.length - 1)
  const slide = model.slides[position]
  const changeOpen = (next: boolean) => {
    setOpen(next)
    setPlaying(next && !reducedMotion)
    if (next) { setIndex(0); setFinished(false); setReadAll(!!reducedMotion) }
  }
  useEffect(() => {
    if (reducedMotion) { setPlaying(false); setReadAll(true) }
  }, [reducedMotion])
  useEffect(() => {
    if (!open || !playing || reducedMotion || readAll) return
    const timer = window.setTimeout(() => {
      if (index >= model.slides.length - 1) { setPlaying(false); setFinished(true) }
      else setIndex(value => broadcastStep(value, 1, model.slides.length))
    }, slide.duration)
    return () => window.clearTimeout(timer)
  }, [open, playing, reducedMotion, readAll, index, model.slides.length, slide.duration])
  useEffect(() => {
    if (!open) return
    const pause = () => { if (document.hidden) setPlaying(false) }
    const leave = () => setPlaying(false)
    document.addEventListener('visibilitychange', pause)
    window.addEventListener('pagehide', leave)
    return () => { document.removeEventListener('visibilitychange', pause); window.removeEventListener('pagehide', leave) }
  }, [open])
  const move = (direction: number) => { setPlaying(false); setFinished(false); setIndex(value => broadcastStep(Math.min(value, model.slides.length - 1), direction, model.slides.length)) }
  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><button type="button" className="watch-forecast-button"><Play size={18} weight="fill" aria-hidden="true" /><span>Watch forecast</span><small>~{Math.round(model.slides.reduce((sum, card) => sum + card.duration, 0) / 1000)} sec</small></button></DialogTrigger>
    <DialogContent className="forecast-program" aria-describedby="forecast-program-description" onOpenAutoFocus={event => { event.preventDefault(); readButton.current?.focus() }} onKeyDown={event => {
      if (readAll) return
      if (event.key === 'ArrowRight') { event.preventDefault(); move(1) }
      if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1) }
    }}>
      <header className="program-header"><DialogTitle>BLIZZARD <span>Local forecast</span></DialogTitle><DialogDescription id="forecast-program-description" className="sr-only">A short forecast broadcast. Pause, use Previous and Next, or read all cards. This is an estimate, not an official closure notice.</DialogDescription></header>
      <div className="program-screen" aria-live="off" tabIndex={0} onFocus={() => setPlaying(false)} onPointerDown={event => { pointer.current = { x: event.clientX, y: event.clientY } }} onPointerCancel={() => { pointer.current = null }} onPointerUp={event => {
        if (!pointer.current || readAll) return
        const x = event.clientX - pointer.current.x, y = event.clientY - pointer.current.y
        pointer.current = null
        if (Math.abs(x) > 45 && Math.abs(x) > Math.abs(y) * 1.5) move(x < 0 ? 1 : -1)
      }}>
        {readAll ? model.slides.map(item => <BroadcastCard key={item.id} slide={item} districtNotes={model.districtNotes} />) : <BroadcastCard slide={slide} districtNotes={model.districtNotes} />}
      </div>
      <footer className="program-controls">
        <div className="program-position" aria-live="off"><span>{readAll ? 'All cards' : `${position + 1} / ${model.slides.length}`}</span><button ref={readButton} type="button" onClick={() => { setReadAll(value => !value); setPlaying(false) }}>{readAll ? 'One card at a time' : 'Read all'}</button></div>
        {!readAll && <div className="program-transport">
          <button type="button" onClick={() => move(-1)} disabled={position === 0} aria-label="Previous forecast card"><ArrowLeft size={20} aria-hidden="true" /></button>
          <button type="button" disabled={!!reducedMotion} onClick={() => { if (finished) { setIndex(0); setFinished(false) }; setPlaying(value => !value) }} aria-label={finished ? 'Replay forecast broadcast' : playing ? 'Pause forecast broadcast' : 'Play forecast broadcast'}>{finished ? <ArrowCounterClockwise size={18} aria-hidden="true" /> : playing ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}<span>{finished ? 'Replay' : playing ? 'Pause' : 'Play'}</span></button>
          <button type="button" onClick={() => move(1)} disabled={position === model.slides.length - 1} aria-label="Next forecast card"><ArrowRight size={20} aria-hidden="true" /></button>
        </div>}
      </footer>
    </DialogContent>
  </Dialog>
}
