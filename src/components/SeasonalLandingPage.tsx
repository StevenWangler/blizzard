import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Snowflake,
  Sun,
  CloudSun,
  Flower2,
  TreePalm,
  Waves,
  ArrowRight,
} from 'lucide-react'
import { Button } from './ui/button'
import { Card, CardContent } from './ui/card'
import { cn } from '../utils/utils'
import { useDevicePerformance } from '../hooks/use-mobile'

/* ── helpers ── */

interface SeasonalLandingPageProps {}

type Season = 'spring' | 'summer'

function getSeason(date = new Date()): Season {
  const m = date.getMonth()
  return m >= 5 && m <= 8 ? 'summer' : 'spring'
}

function daysUntilWinter(date = new Date()): number {
  const year = date.getFullYear()
  // Target: November 1 as "winter is coming" date
  let target = new Date(year, 10, 1) // Nov 1
  if (date >= target) target = new Date(year + 1, 10, 1)
  return Math.ceil((target.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
}

const seasonConfig = {
  spring: {
    emoji: '🌸',
    greeting: 'Enjoy the sunshine!',
    bg: 'from-emerald-50 via-lime-50 to-sky-50 dark:from-emerald-950/40 dark:via-lime-950/30 dark:to-sky-950/40',
    accent: 'from-emerald-400 via-lime-400 to-teal-400',
    orb: 'from-emerald-300 via-lime-200 to-sky-200',
    orbShadow: 'shadow-emerald-300/40',
    particleColors: ['#f9a8d4', '#fde047', '#86efac', '#c4b5fd', '#fcd34d'],
    cardBg: 'bg-emerald-500/5 border-emerald-500/10',
  },
  summer: {
    emoji: '☀️',
    greeting: 'Soak up the sun!',
    bg: 'from-amber-50 via-yellow-50 to-sky-50 dark:from-amber-950/40 dark:via-yellow-950/30 dark:to-sky-950/40',
    accent: 'from-amber-400 via-yellow-400 to-orange-400',
    orb: 'from-amber-300 via-yellow-200 to-orange-200',
    orbShadow: 'shadow-amber-300/40',
    particleColors: ['#fde047', '#fb923c', '#fbbf24', '#fef08a', '#fdba74'],
    cardBg: 'bg-amber-500/5 border-amber-500/10',
  },
}

/* ── floating particles ── */

interface Particle {
  x: number; y: number; size: number
  vx: number; vy: number
  opacity: number; rotation: number; rotSpeed: number
  wobblePhase: number; wobbleFreq: number
  color: string
}

function ParticleCanvas({ season }: { season: Season }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<number>(undefined)
  const { performanceMultiplier, isLowEnd } = useDevicePerformance()

  useEffect(() => {
    if (isLowEnd || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const colors = seasonConfig[season].particleColors

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const count = Math.max(6, Math.floor(30 * performanceMultiplier))
    const particles: Particle[] = Array.from({ length: count }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      size: 2 + Math.random() * 4,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -(0.12 + Math.random() * 0.28),
      opacity: 0.15 + Math.random() * 0.35,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 0.8,
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleFreq: 0.006 + Math.random() * 0.01,
      color: colors[Math.floor(Math.random() * colors.length)],
    }))

    let tick = 0
    const draw = () => {
      tick++
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
      for (const p of particles) {
        p.y += p.vy
        p.x += p.vx + Math.sin(tick * p.wobbleFreq + p.wobblePhase) * 0.3
        p.rotation += p.rotSpeed
        if (p.y < -15) { p.y = window.innerHeight + 10; p.x = Math.random() * window.innerWidth }
        if (p.x < -15) p.x = window.innerWidth + 10
        if (p.x > window.innerWidth + 15) p.x = -10

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rotation * Math.PI) / 180)
        ctx.globalAlpha = p.opacity
        ctx.beginPath()
        if (p.size > 3.5) {
          ctx.ellipse(0, 0, p.size * 0.55, p.size, 0, 0, Math.PI * 2)
        } else {
          ctx.arc(0, 0, p.size, 0, Math.PI * 2)
        }
        ctx.fillStyle = p.color
        ctx.fill()
        ctx.restore()
      }
      frameRef.current = requestAnimationFrame(draw)
    }
    frameRef.current = requestAnimationFrame(draw)

    return () => {
      window.removeEventListener('resize', resize)
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [season, performanceMultiplier, isLowEnd])

  if (isLowEnd) return null
  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-0" aria-hidden />
}

/* ── snowflake catch game ── */

interface FallingFlake {
  id: number; x: number; y: number; size: number; speed: number; caught: boolean
}

function SnowflakeCatchGame() {
  const [score, setScore] = useState(0)
  const [flakes, setFlakes] = useState<FallingFlake[]>([])
  const [playing, setPlaying] = useState(false)
  const [timeLeft, setTimeLeft] = useState(15)
  const [highScore, setHighScore] = useState(() => {
    try { return Number(localStorage.getItem('blizzard:catch-high') || 0) } catch { return 0 }
  })
  const nextId = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined)
  const spawnRef = useRef<ReturnType<typeof setInterval>>(undefined)

  const startGame = useCallback(() => {
    setScore(0)
    setFlakes([])
    setTimeLeft(15)
    setPlaying(true)
    nextId.current = 0
  }, [])

  // Timer
  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setPlaying(false)
          clearInterval(t)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    intervalRef.current = t
    return () => clearInterval(t)
  }, [playing])

  // Save high score when game ends
  useEffect(() => {
    if (!playing && score > 0 && score > highScore) {
      setHighScore(score)
      try { localStorage.setItem('blizzard:catch-high', String(score)) } catch {}
    }
  }, [playing, score, highScore])

  // Spawn flakes
  useEffect(() => {
    if (!playing) return
    const spawn = () => {
      const id = nextId.current++
      setFlakes(prev => [
        ...prev.filter(f => !f.caught && f.y < 300),
        {
          id,
          x: 10 + Math.random() * 80,
          y: -5,
          size: 24 + Math.random() * 14,
          speed: 1.2 + Math.random() * 1.8,
          caught: false,
        },
      ])
    }
    spawn()
    spawnRef.current = setInterval(spawn, 700 + Math.random() * 400)
    return () => { if (spawnRef.current) clearInterval(spawnRef.current) }
  }, [playing])

  // Animate flakes falling
  useEffect(() => {
    if (!playing) return
    const frame = setInterval(() => {
      setFlakes(prev => prev.map(f => f.caught ? f : { ...f, y: f.y + f.speed }).filter(f => f.y < 300 || f.caught))
    }, 40)
    return () => clearInterval(frame)
  }, [playing])

  const catchFlake = useCallback((id: number) => {
    setFlakes(prev => prev.map(f => f.id === id ? { ...f, caught: true } : f))
    setScore(s => s + 1)
  }, [])

  return (
    <Card className="relative overflow-hidden border-primary/10 bg-background/70 backdrop-blur-xl">
      <CardContent className="p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Catch the Snowflakes</h3>
            <p className="text-sm text-muted-foreground">
              {playing
                ? `${timeLeft}s left`
                : score > 0
                  ? `Nice! You caught ${score} snowflake${score !== 1 ? 's' : ''}!`
                  : 'Tap the falling snowflakes before they hit the ground!'}
            </p>
          </div>
          <div className="text-right">
            {playing ? (
              <span className="text-2xl font-bold tabular-nums text-foreground">{score}</span>
            ) : (
              <Button size="sm" onClick={startGame}>
                {score > 0 ? 'Play again' : 'Start'}
              </Button>
            )}
          </div>
        </div>

        {/* Game area */}
        <div className="relative h-64 sm:h-72 overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-b from-sky-100/50 via-sky-50/30 to-white/40 dark:from-sky-900/20 dark:via-sky-950/10 dark:to-background/30" style={{ touchAction: playing ? 'none' : 'auto' }}>
          {!playing && score === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <motion.div
                animate={{ y: [0, -8, 0], rotate: [0, 10, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <Snowflake size={48} className="text-sky-400/60" />
              </motion.div>
              <p className="text-sm">Press start to play!</p>
            </div>
          )}

          {!playing && score > 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <motion.p
                className="text-4xl font-bold text-foreground"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
              >
                {score} ❄️
              </motion.p>
              {score > highScore - 1 && score > 0 && (
                <motion.p
                  className="text-sm font-medium text-amber-500"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  {score >= highScore ? '🏆 New high score!' : `Best: ${highScore}`}
                </motion.p>
              )}
              {highScore > 0 && score < highScore && (
                <p className="text-sm text-muted-foreground">Best: {highScore}</p>
              )}
            </div>
          )}

          <AnimatePresence>
            {flakes.filter(f => !f.caught).map(f => (
              <motion.button
                key={f.id}
                className="absolute cursor-pointer select-none outline-none p-2 -m-2"
                style={{ left: `${f.x}%`, top: f.y, fontSize: f.size }}
                onClick={() => catchFlake(f.id)}
                onTouchEnd={(e) => { e.preventDefault(); catchFlake(f.id) }}
                whileTap={{ scale: 1.4 }}
                exit={{ scale: 0, opacity: 0, rotate: 90 }}
                transition={{ duration: 0.15 }}
                aria-label="Catch snowflake"
              >
                ❄️
              </motion.button>
            ))}
          </AnimatePresence>

          {/* Caught burst effects */}
          <AnimatePresence>
            {flakes.filter(f => f.caught).map(f => (
              <motion.div
                key={`burst-${f.id}`}
                className="absolute pointer-events-none"
                style={{ left: `${f.x}%`, top: f.y }}
                initial={{ scale: 1, opacity: 1 }}
                animate={{ scale: 2, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                <span style={{ fontSize: f.size }}>✨</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  )
}

/* ── main component ── */

export function SeasonalLandingPage({}: SeasonalLandingPageProps) {
  const season = useMemo(() => getSeason(), [])
  const config = seasonConfig[season]
  const days = useMemo(() => daysUntilWinter(), [])

  return (
    <>
      <ParticleCanvas season={season} />

      <div className="relative z-10 mx-auto max-w-2xl space-y-8 px-1">
        {/* ── Hero section ── */}
        <div className="space-y-6 pt-4 text-center">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          >
            <motion.span
              className="inline-block text-6xl sm:text-7xl"
              animate={{ rotate: [0, 8, -8, 0], y: [0, -6, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              role="img"
              aria-label={season === 'summer' ? 'sun' : 'cherry blossom'}
            >
              {config.emoji}
            </motion.span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="space-y-4"
          >
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
              Blizzard will
              <br />
              <span className={cn('bg-gradient-to-r bg-clip-text text-transparent', config.accent)}>
                return this winter.
              </span>
            </h1>
            <p className="mx-auto max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
              {config.greeting} Blizzard is taking a warm-weather break. We'll be back with snow day predictions when the cold rolls in.
            </p>
          </motion.div>

          {/* Countdown */}
          <motion.div
            className="inline-flex items-center gap-3 rounded-full border border-border/60 bg-background/70 px-5 py-2.5 shadow-sm backdrop-blur"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Snowflake size={18} className="text-sky-400" />
            <span className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">{days}</span> days until winter mode
            </span>
          </motion.div>
        </div>

        {/* ── Snowflake catch game ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.6 }}
        >
          <SnowflakeCatchGame />
        </motion.div>


      </div>
    </>
  )
}
