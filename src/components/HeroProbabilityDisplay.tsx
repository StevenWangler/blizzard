import { useEffect, useState, useRef } from 'react'
import { motion, useSpring } from 'framer-motion'
import { useDevicePerformance } from '@/hooks/use-mobile'

interface HeroProbabilityDisplayProps {
  /** Target probability value (0-100) */
  value: number
  /** Duration of counting animation in seconds */
  duration?: number
}

// Floating particles around the orb
function OrbParticles({ probability, isLowEnd }: { probability: number; isLowEnd: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  useEffect(() => {
    if (isLowEnd) return
    
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * window.devicePixelRatio
      canvas.height = rect.height * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }
    
    resizeCanvas()
    
    const centerX = canvas.width / (2 * window.devicePixelRatio)
    const centerY = canvas.height / (2 * window.devicePixelRatio)
    const orbRadius = Math.min(centerX, centerY) * 0.6
    
    // Particle count scales with probability
    const particleCount = Math.floor(15 + (probability / 100) * 25)
    
    interface Particle {
      angle: number
      distance: number
      speed: number
      size: number
      opacity: number
      orbitSpeed: number
    }
    
    const particles: Particle[] = []
    
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        angle: Math.random() * Math.PI * 2,
        distance: orbRadius + 20 + Math.random() * 60,
        speed: 0.002 + Math.random() * 0.003,
        size: 1 + Math.random() * 2,
        opacity: 0.3 + Math.random() * 0.5,
        orbitSpeed: (Math.random() > 0.5 ? 1 : -1) * (0.001 + Math.random() * 0.002)
      })
    }
    
    let animationId: number
    
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      particles.forEach(p => {
        p.angle += p.orbitSpeed
        
        const x = centerX + Math.cos(p.angle) * p.distance
        const y = centerY + Math.sin(p.angle) * p.distance
        
        // Pulsing opacity
        const pulseOpacity = p.opacity * (0.7 + 0.3 * Math.sin(Date.now() * p.speed))
        
        ctx.beginPath()
        ctx.arc(x, y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = probability >= 70 
          ? `rgba(34, 211, 238, ${pulseOpacity})`
          : probability >= 50 
            ? `rgba(99, 102, 241, ${pulseOpacity})`
            : `rgba(148, 163, 184, ${pulseOpacity})`
        ctx.fill()
      })
      
      animationId = requestAnimationFrame(animate)
    }
    
    animationId = requestAnimationFrame(animate)
    
    return () => {
      if (animationId) cancelAnimationFrame(animationId)
    }
  }, [probability, isLowEnd])
  
  if (isLowEnd) return null
  
  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ width: '100%', height: '100%' }}
      aria-hidden="true"
    />
  )
}

export function HeroProbabilityDisplay({ value, duration = 2 }: HeroProbabilityDisplayProps) {
  const [displayValue, setDisplayValue] = useState(0)
  const { isLowEnd, isMobile } = useDevicePerformance()
  
  // Spring animation for counting
  const spring = useSpring(0, {
    duration: duration * 1000,
    bounce: 0
  })
  
  useEffect(() => {
    spring.set(value)
    
    const unsubscribe = spring.on('change', (latest) => {
      setDisplayValue(Math.round(latest))
    })
    
    return () => unsubscribe()
  }, [value, spring])
  
  // Color schemes based on probability
  const getOrbColors = () => {
    if (value >= 80) return {
      core: 'rgba(6, 182, 212, 0.95)',       // cyan-500
      mid: 'rgba(8, 145, 178, 0.7)',         // cyan-600
      outer: 'rgba(34, 211, 238, 0.4)',      // cyan glow
      ring: 'rgba(34, 211, 238, 0.8)',
      text: 'text-cyan-950 dark:text-white',
      accent: 'cyan'
    }
    if (value >= 60) return {
      core: 'rgba(79, 70, 229, 0.9)',        // indigo-600
      mid: 'rgba(67, 56, 202, 0.6)',         // indigo-700
      outer: 'rgba(99, 102, 241, 0.35)',     // indigo glow
      ring: 'rgba(129, 140, 248, 0.7)',
      text: 'text-indigo-950 dark:text-white',
      accent: 'indigo'
    }
    if (value >= 40) return {
      core: 'rgba(37, 99, 235, 0.85)',       // blue-600
      mid: 'rgba(29, 78, 216, 0.55)',        // blue-700
      outer: 'rgba(59, 130, 246, 0.3)',      // blue glow
      ring: 'rgba(96, 165, 250, 0.6)',
      text: 'text-blue-950 dark:text-white',
      accent: 'blue'
    }
    return {
      core: 'rgba(71, 85, 105, 0.8)',        // slate-600
      mid: 'rgba(51, 65, 85, 0.5)',          // slate-700
      outer: 'rgba(100, 116, 139, 0.25)',    // slate glow
      ring: 'rgba(148, 163, 184, 0.5)',
      text: 'text-slate-800 dark:text-slate-100',
      accent: 'slate'
    }
  }
  
  const colors = getOrbColors()
  const pulseSpeed = value >= 70 ? 3 : value >= 50 ? 4 : 5
  
  return (
    <div className="relative flex items-center justify-center w-full aspect-square max-w-[320px] sm:max-w-[500px] mx-auto">
      {/* Floating particles */}
      <OrbParticles probability={value} isLowEnd={isLowEnd} />
      
      {/* Outer rotating ring */}
      {!isLowEnd && (
        <motion.div
          className="absolute inset-[10%] rounded-full border opacity-30"
          style={{ borderColor: colors.ring }}
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        />
      )}
      
      {/* Secondary rotating ring (opposite direction) */}
      {!isLowEnd && !isMobile && (
        <motion.div
          className="absolute inset-[15%] rounded-full border opacity-20"
          style={{ borderColor: colors.ring }}
          animate={{ rotate: -360 }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
        />
      )}
      
      {/* Pulsing outer glow */}
      <motion.div
        className="absolute inset-[15%] rounded-full"
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: pulseSpeed,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
        style={{
          background: `radial-gradient(circle, ${colors.outer} 0%, transparent 70%)`,
          filter: 'blur(20px)',
        }}
      />
      
      {/* Main orb container */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          type: 'spring',
          stiffness: 100,
          damping: 15,
          delay: 0.2
        }}
        className="absolute inset-[20%] rounded-full"
      >
        {/* Orb outer layer - glass effect */}
        <div 
          className="absolute inset-0 rounded-full"
          style={{
            background: `
              radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2) 0%, transparent 50%),
              radial-gradient(circle at center, ${colors.mid} 0%, ${colors.outer} 60%, transparent 70%)
            `,
            boxShadow: `
              inset 0 0 60px ${colors.core},
              0 0 80px ${colors.outer},
              0 0 120px ${colors.outer}
            `,
          }}
        />
        
        {/* Inner core glow */}
        <motion.div
          className="absolute inset-[15%] rounded-full"
          animate={!isLowEnd ? {
            scale: [1, 1.05, 1],
            opacity: [0.8, 1, 0.8],
          } : {}}
          transition={{
            duration: pulseSpeed * 0.8,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
          style={{
            background: `radial-gradient(circle, ${colors.core} 0%, ${colors.mid} 50%, transparent 70%)`,
            filter: !isLowEnd ? 'blur(10px)' : undefined,
          }}
        />
        
        {/* Highlight reflection */}
        <div 
          className="absolute top-[10%] left-[15%] w-[35%] h-[25%] rounded-full opacity-40"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.6) 0%, transparent 60%)',
            filter: 'blur(8px)',
          }}
        />
      </motion.div>
      
      {/* Dashed orbit ring with markers */}
      {!isLowEnd && !isMobile && (
        <svg className="absolute inset-[5%] w-[90%] h-[90%] opacity-20" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={colors.ring}
            strokeWidth="0.3"
            strokeDasharray="2 4"
          />
          {/* Orbit markers */}
          {[0, 90, 180, 270].map((angle) => (
            <motion.circle
              key={angle}
              cx={50 + 45 * Math.cos((angle * Math.PI) / 180)}
              cy={50 + 45 * Math.sin((angle * Math.PI) / 180)}
              r="1"
              fill={colors.ring}
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ 
                duration: 2, 
                repeat: Infinity, 
                delay: angle / 360,
                ease: 'easeInOut'
              }}
            />
          ))}
        </svg>
      )}
      
      {/* The percentage number */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5, duration: 0.8 }}
        className="relative z-10 flex flex-col items-center justify-center"
      >
        {/* Breathing animation wrapper */}
        <motion.div
          animate={!isLowEnd ? {
            scale: [1, 1.02, 1],
          } : {}}
          transition={{
            duration: pulseSpeed,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
          className="flex flex-col items-center"
        >
          <span
            className={`
              font-black tracking-tight select-none leading-none
              text-[16vw] max-[360px]:text-[18vw] sm:text-[14vw] md:text-[12vw] lg:text-[10rem]
              ${colors.text}
              drop-shadow-lg
            `}
            style={{
              textShadow: `
                0 0 30px ${colors.core},
                0 0 60px ${colors.mid}
              `,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {displayValue}
          </span>
          <span
            className={`
              text-[4.5vw] sm:text-[4vw] md:text-[3vw] lg:text-[2.5rem]
              font-semibold tracking-widest uppercase opacity-70
              ${colors.text}
            `}
            style={{
              textShadow: `0 0 20px ${colors.mid}`,
            }}
          >
            percent
          </span>
        </motion.div>
      </motion.div>
      
      {/* High probability energy effect */}
      {value >= 80 && !isLowEnd && !isMobile && (
        <motion.div
          className="absolute inset-[18%] rounded-full pointer-events-none"
          animate={{
            boxShadow: [
              `0 0 60px ${colors.core}, inset 0 0 60px ${colors.mid}`,
              `0 0 100px ${colors.core}, inset 0 0 80px ${colors.mid}`,
              `0 0 60px ${colors.core}, inset 0 0 60px ${colors.mid}`,
            ],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />
      )}
    </div>
  )
}
