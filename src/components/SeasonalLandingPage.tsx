import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Snowflake,
  Sun,
  CloudSun,
  Flower2,
  TreePalm,
  Waves,
  Leaf,
} from 'lucide-react'
import { cn } from '../utils/utils'
import { useDevicePerformance } from '../hooks/use-mobile'

/* ── helpers ── */

interface SeasonalLandingPageProps {}

type Season = 'spring' | 'summer' | 'fall'

function getSeason(date = new Date()): Season {
  const m = date.getMonth()
  // Summer: June-August (5-7)
  // Fall: September-November (8-10)
  // Spring: December-May (11, 0-4)
  if (m >= 5 && m <= 7) return 'summer'
  if (m >= 8 && m <= 10) return 'fall'
  return 'spring'
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
    greeting: 'Enjoy the blooming season!',
    bg: 'from-emerald-50 via-lime-50 to-sky-50 dark:from-emerald-950/40 dark:via-lime-950/30 dark:to-sky-950/40',
    accent: 'from-emerald-400 via-lime-400 to-teal-400',
    orb: 'from-emerald-300 via-lime-200 to-sky-200',
    orbShadow: 'shadow-emerald-300/40',
    particleColors: ['#f9a8d4', '#fde047', '#86efac', '#c4b5fd', '#fcd34d'],
    floatingElements: ['🌸', '🌼', '🦋', '🌺', '🌻', '🌷'],
    accentColor: '#86efac',
    glowColor: 'rgba(134, 239, 172, 0.3)',
  },
  summer: {
    emoji: '☀️',
    greeting: 'Soak up the sunshine!',
    bg: 'from-amber-50 via-yellow-50 to-sky-50 dark:from-amber-950/40 dark:via-yellow-950/30 dark:to-sky-950/40',
    accent: 'from-amber-400 via-yellow-400 to-orange-400',
    orb: 'from-amber-300 via-yellow-200 to-orange-200',
    orbShadow: 'shadow-amber-300/40',
    particleColors: ['#fde047', '#fb923c', '#fbbf24', '#fef08a', '#fdba74'],
    floatingElements: ['🌞', '🌻', '🦋', '☀️', '🌺', '🐝'],
    accentColor: '#fbbf24',
    glowColor: 'rgba(251, 191, 36, 0.3)',
  },
  fall: {
    emoji: '🍂',
    greeting: 'Embrace the autumn colors!',
    bg: 'from-orange-50 via-red-50 to-amber-50 dark:from-orange-950/40 dark:via-red-950/30 dark:to-amber-950/40',
    accent: 'from-orange-400 via-red-400 to-amber-400',
    orb: 'from-orange-300 via-red-200 to-amber-200',
    orbShadow: 'shadow-orange-300/40',
    particleColors: ['#fb923c', '#ef4444', '#f59e0b', '#dc2626', '#ea580c'],
    floatingElements: ['🍂', '🍁', '🍃', '🎃', '🌰', '🦉'],
    accentColor: '#fb923c',
    glowColor: 'rgba(251, 146, 60, 0.3)',
  },
}

/* ── advanced particle system ── */

interface Particle {
  x: number
  y: number
  size: number
  vx: number
  vy: number
  opacity: number
  rotation: number
  rotSpeed: number
  wobblePhase: number
  wobbleFreq: number
  color: string
  pulsePhase: number
  pulseSpeed: number
}

function AdvancedParticleCanvas({ season }: { season: Season }) {
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

    // Create multiple particle layers for depth
    const count = Math.max(15, Math.floor(50 * performanceMultiplier))
    const particles: Particle[] = Array.from({ length: count }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      size: 1.5 + Math.random() * 5,
      vx: (Math.random() - 0.5) * 0.5,
      vy: -(0.08 + Math.random() * 0.35),
      opacity: 0.2 + Math.random() * 0.5,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 1.2,
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleFreq: 0.004 + Math.random() * 0.012,
      color: colors[Math.floor(Math.random() * colors.length)],
      pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: 0.02 + Math.random() * 0.03,
    }))

    let tick = 0
    const draw = () => {
      tick++
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)

      for (const p of particles) {
        // Update position with wobble
        p.y += p.vy
        p.x += p.vx + Math.sin(tick * p.wobbleFreq + p.wobblePhase) * 0.4
        p.rotation += p.rotSpeed

        // Pulse effect
        const pulse = Math.sin(tick * p.pulseSpeed + p.pulsePhase) * 0.3 + 1

        // Wrap around screen
        if (p.y < -20) {
          p.y = window.innerHeight + 15
          p.x = Math.random() * window.innerWidth
        }
        if (p.x < -20) p.x = window.innerWidth + 15
        if (p.x > window.innerWidth + 20) p.x = -15

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rotation * Math.PI) / 180)

        // Add glow effect for larger particles
        if (p.size > 3) {
          ctx.shadowBlur = 12 * pulse
          ctx.shadowColor = p.color
        }

        ctx.globalAlpha = p.opacity * (0.85 + pulse * 0.15)
        ctx.beginPath()

        const currentSize = p.size * pulse
        if (p.size > 4) {
          // Draw star-like shape for larger particles
          for (let i = 0; i < 5; i++) {
            const angle = (i * 4 * Math.PI) / 5
            const radius = i % 2 === 0 ? currentSize : currentSize * 0.5
            const px = Math.cos(angle) * radius
            const py = Math.sin(angle) * radius
            if (i === 0) ctx.moveTo(px, py)
            else ctx.lineTo(px, py)
          }
          ctx.closePath()
        } else if (p.size > 2.5) {
          ctx.ellipse(0, 0, currentSize * 0.6, currentSize, 0, 0, Math.PI * 2)
        } else {
          ctx.arc(0, 0, currentSize, 0, Math.PI * 2)
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

/* ── floating seasonal elements ── */

interface FloatingElement {
  id: number
  emoji: string
  delay: number
  duration: number
  startX: number
  drift: number
}

function FloatingElements({ season }: { season: Season }) {
  const config = seasonConfig[season]
  const { isLowEnd } = useDevicePerformance()

  const elements = useMemo<FloatingElement[]>(() => {
    if (isLowEnd) return []
    return Array.from({ length: 8 }, (_, i) => ({
      id: i,
      emoji: config.floatingElements[i % config.floatingElements.length],
      delay: i * 1.5,
      duration: 12 + Math.random() * 8,
      startX: 10 + (i * 80) / 8,
      drift: (Math.random() - 0.5) * 30,
    }))
  }, [season, config.floatingElements, isLowEnd])

  if (isLowEnd) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {elements.map((el) => (
        <motion.div
          key={el.id}
          className="absolute text-4xl opacity-40 dark:opacity-30"
          style={{ left: `${el.startX}%`, top: '100%' }}
          animate={{
            y: ['0vh', '-110vh'],
            x: [0, el.drift, -el.drift, 0],
            rotate: [0, 360],
            scale: [0.8, 1.2, 0.8],
          }}
          transition={{
            duration: el.duration,
            delay: el.delay,
            repeat: Infinity,
            ease: 'linear',
            x: {
              duration: el.duration / 2,
              repeat: Infinity,
              repeatType: 'mirror',
              ease: 'easeInOut',
            },
            rotate: {
              duration: el.duration / 3,
              repeat: Infinity,
              ease: 'linear',
            },
            scale: {
              duration: el.duration / 4,
              repeat: Infinity,
              repeatType: 'mirror',
              ease: 'easeInOut',
            },
          }}
        >
          {el.emoji}
        </motion.div>
      ))}
    </div>
  )
}

/* ── ambient glow orbs ── */

function AmbientGlowOrbs({ season }: { season: Season }) {
  const config = seasonConfig[season]
  const { isLowEnd } = useDevicePerformance()

  if (isLowEnd) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {/* Large ambient glow orbs */}
      <motion.div
        className="absolute -left-32 top-1/4 h-96 w-96 rounded-full opacity-20 blur-3xl"
        style={{ backgroundColor: config.accentColor }}
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.15, 0.25, 0.15],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute -right-32 top-2/3 h-96 w-96 rounded-full opacity-20 blur-3xl"
        style={{ backgroundColor: config.accentColor }}
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.2, 0.3, 0.2],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-10 blur-3xl"
        style={{ backgroundColor: config.accentColor }}
        animate={{
          scale: [1, 1.5, 1],
          opacity: [0.1, 0.2, 0.1],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </div>
  )
}

/* ── interactive gradient waves ── */

function GradientWaves({ season }: { season: Season }) {
  const config = seasonConfig[season]
  const { isLowEnd } = useDevicePerformance()

  if (isLowEnd) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-30" aria-hidden>
      <motion.div
        className={cn('absolute inset-0 bg-gradient-to-br', config.accent, 'opacity-20')}
        animate={{
          scale: [1, 1.1, 1],
          rotate: [0, 5, 0],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className={cn('absolute inset-0 bg-gradient-to-tl', config.accent, 'opacity-15')}
        animate={{
          scale: [1.1, 1, 1.1],
          rotate: [0, -5, 0],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </div>
  )
}

/* ── seasonal icon animation ── */

function SeasonalIcon({ season }: { season: Season }) {
  const icons = {
    spring: <Flower2 size={80} className="text-emerald-400" strokeWidth={1.5} />,
    summer: <Sun size={80} className="text-amber-400" strokeWidth={1.5} />,
    fall: <Leaf size={80} className="text-orange-400" strokeWidth={1.5} />,
  }

  return (
    <motion.div
      className="relative"
      animate={{
        rotate: [0, 360],
        scale: [1, 1.1, 1],
      }}
      transition={{
        rotate: {
          duration: 20,
          repeat: Infinity,
          ease: 'linear',
        },
        scale: {
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        },
      }}
    >
      {icons[season]}

      {/* Animated rings around icon */}
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-current opacity-30"
        animate={{
          scale: [1, 1.5, 1],
          opacity: [0.3, 0, 0.3],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeOut',
        }}
      />
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-current opacity-30"
        animate={{
          scale: [1, 1.5, 1],
          opacity: [0.3, 0, 0.3],
        }}
        transition={{
          duration: 3,
          delay: 1,
          repeat: Infinity,
          ease: 'easeOut',
        }}
      />
    </motion.div>
  )
}

/* ── main component ── */

export function SeasonalLandingPage({}: SeasonalLandingPageProps) {
  const season = useMemo(() => getSeason(), [])
  const config = seasonConfig[season]
  const days = useMemo(() => daysUntilWinter(), [])

  return (
    <>
      {/* Layered animation effects */}
      <AmbientGlowOrbs season={season} />
      <GradientWaves season={season} />
      <AdvancedParticleCanvas season={season} />
      <FloatingElements season={season} />

      <div className="relative z-10 mx-auto max-w-2xl space-y-8 px-1">
        {/* ── Hero section ── */}
        <div className="space-y-6 pt-4 text-center">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="flex justify-center"
          >
            <SeasonalIcon season={season} />
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

          {/* Countdown with enhanced animation */}
          <motion.div
            className="inline-flex items-center gap-3 rounded-full border border-border/60 bg-background/70 px-5 py-2.5 shadow-sm backdrop-blur"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            whileHover={{ scale: 1.05 }}
          >
            <motion.div
              animate={{
                rotate: [0, 360],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: 'linear',
              }}
            >
              <Snowflake size={18} className="text-sky-400" />
            </motion.div>
            <span className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">{days}</span> days until winter mode
            </span>
          </motion.div>
        </div>

        {/* Decorative season info cards */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.6 }}
          className="grid gap-4 sm:grid-cols-3"
        >
          {season === 'spring' && (
            <>
              <SeasonInfoCard
                icon={<Flower2 size={24} />}
                title="Spring"
                description="Nature awakens"
                delay={0.4}
              />
              <SeasonInfoCard
                icon={<CloudSun size={24} />}
                title="Sunshine"
                description="Warmer days ahead"
                delay={0.5}
              />
              <SeasonInfoCard
                icon={<Waves size={24} />}
                title="Fresh Air"
                description="Enjoy the outdoors"
                delay={0.6}
              />
            </>
          )}
          {season === 'summer' && (
            <>
              <SeasonInfoCard
                icon={<Sun size={24} />}
                title="Summer"
                description="Peak sunshine"
                delay={0.4}
              />
              <SeasonInfoCard
                icon={<TreePalm size={24} />}
                title="Vacation"
                description="Relax and unwind"
                delay={0.5}
              />
              <SeasonInfoCard
                icon={<Waves size={24} />}
                title="Beach Time"
                description="Make memories"
                delay={0.6}
              />
            </>
          )}
          {season === 'fall' && (
            <>
              <SeasonInfoCard
                icon={<Leaf size={24} />}
                title="Autumn"
                description="Colors change"
                delay={0.4}
              />
              <SeasonInfoCard
                icon={<CloudSun size={24} />}
                title="Crisp Air"
                description="Cozy season"
                delay={0.5}
              />
              <SeasonInfoCard
                icon={<Snowflake size={24} />}
                title="Winter Soon"
                description="Almost here!"
                delay={0.6}
              />
            </>
          )}
        </motion.div>
      </div>
    </>
  )
}

/* ── season info card ── */

interface SeasonInfoCardProps {
  icon: React.ReactNode
  title: string
  description: string
  delay: number
}

function SeasonInfoCard({ icon, title, description, delay }: SeasonInfoCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      whileHover={{ scale: 1.05, y: -5 }}
      className="group relative overflow-hidden rounded-lg border border-border/40 bg-background/50 p-4 backdrop-blur-sm transition-all hover:border-border/60 hover:bg-background/60"
    >
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
        initial={false}
      />
      <div className="relative flex flex-col items-center gap-2 text-center">
        <motion.div
          className="text-primary"
          whileHover={{ rotate: 360 }}
          transition={{ duration: 0.6 }}
        >
          {icon}
        </motion.div>
        <div>
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
    </motion.div>
  )
}
