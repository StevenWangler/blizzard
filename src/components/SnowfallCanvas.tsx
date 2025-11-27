import { useEffect, useRef } from 'react'

interface SnowflakeParticle {
  x: number
  y: number
  radius: number
  speed: number
  drift: number
  opacity: number
  angle: number
  sparkle: number
  type: 'flake' | 'crystal' | 'dust'
}

interface SnowfallCanvasProps {
  /** Snow intensity based on predicted snowfall (0-20+ inches) */
  intensity?: number
  /** Wind speed in mph (affects drift) */
  windSpeed?: number
  /** Whether animation should respect prefers-reduced-motion */
  respectReducedMotion?: boolean
  /** Custom className for positioning/styling */
  className?: string
  /** Weather theme for color matching */
  theme?: 'light_snow' | 'heavy_snow' | 'blizzard' | 'ice_storm' | 'whiteout' | string
}

export function SnowfallCanvas({
  intensity = 0,
  windSpeed = 0,
  respectReducedMotion = true,
  className = '',
  theme = 'light_snow'
}: SnowfallCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number | undefined>(undefined)
  const snowflakesRef = useRef<SnowflakeParticle[]>([])

  useEffect(() => {
    // Respect user's motion preferences
    if (respectReducedMotion) {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (prefersReducedMotion) {
        return
      }
    }

    // Only show snow if there's meaningful snowfall predicted
    if (intensity < 1) {
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size to match container
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // Calculate particle count based on intensity (1-8 inches = 20-100 particles)
    const baseCount = Math.min(Math.floor(intensity * 12), 180)
    const particleCount = theme === 'blizzard' || theme === 'whiteout' 
      ? baseCount * 2 
      : baseCount
    
    // Calculate drift based on wind speed (0-50 mph = 0-5 drift)
    const windDrift = Math.min(windSpeed / 8, 6)

    // Get theme-specific colors
    const getSnowColor = (opacity: number) => {
      switch (theme) {
        case 'blizzard':
          return `rgba(255, 255, 255, ${opacity})`
        case 'ice_storm':
          return `rgba(200, 230, 255, ${opacity})`
        case 'whiteout':
          return `rgba(255, 255, 255, ${Math.min(opacity * 1.2, 1)})`
        case 'heavy_snow':
          return `rgba(245, 250, 255, ${opacity})`
        default:
          return `rgba(255, 255, 255, ${opacity * 0.9})`
      }
    }

    // Initialize snowflakes
    const createSnowflake = (width: number, height: number, randomY = false): SnowflakeParticle => {
      const types: SnowflakeParticle['type'][] = ['flake', 'crystal', 'dust']
      const type = types[Math.floor(Math.random() * types.length)]
      
      return {
        x: Math.random() * width,
        y: randomY ? Math.random() * height : -10,
        radius: type === 'dust' 
          ? Math.random() * 1.5 + 0.5 
          : type === 'crystal' 
            ? Math.random() * 2.5 + 1.5 
            : Math.random() * 2 + 1,
        speed: type === 'dust' 
          ? Math.random() * 0.8 + 0.3 
          : Math.random() * 1.2 + 0.5,
        drift: (Math.random() - 0.5) * windDrift,
        opacity: type === 'dust' 
          ? Math.random() * 0.4 + 0.2 
          : Math.random() * 0.6 + 0.4,
        angle: Math.random() * Math.PI * 2,
        sparkle: Math.random(),
        type
      }
    }

    const initSnowflakes = () => {
      snowflakesRef.current = []
      for (let i = 0; i < particleCount; i++) {
        snowflakesRef.current.push(createSnowflake(canvas.width, canvas.height, true))
      }
    }

    initSnowflakes()

    // Animation loop
    let lastTime = performance.now()
    const animate = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / 16 // Normalize to ~60fps
      lastTime = currentTime

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      snowflakesRef.current.forEach((flake, index) => {
        // Update position
        flake.y += flake.speed * deltaTime
        flake.x += flake.drift * deltaTime
        flake.angle += 0.01 * deltaTime
        flake.sparkle = (flake.sparkle + 0.02) % 1

        // Add subtle oscillation for realism
        const oscillation = Math.sin(flake.angle) * (flake.type === 'crystal' ? 1 : 0.5)
        
        // Reset snowflake if it goes off screen
        if (flake.y > canvas.height) {
          snowflakesRef.current[index] = createSnowflake(canvas.width, canvas.height)
        }
        if (flake.x > canvas.width) {
          flake.x = 0
        }
        if (flake.x < 0) {
          flake.x = canvas.width
        }

        // Calculate sparkle effect for crystals
        const sparkleBoost = flake.type === 'crystal' 
          ? Math.sin(flake.sparkle * Math.PI * 2) * 0.3 + 0.7 
          : 1

        // Draw snowflake based on type
        ctx.beginPath()
        
        if (flake.type === 'crystal' && flake.radius > 2) {
          // Draw a simple 6-point star for larger crystals
          ctx.save()
          ctx.translate(flake.x + oscillation, flake.y)
          ctx.rotate(flake.angle)
          
          const size = flake.radius
          ctx.strokeStyle = getSnowColor(flake.opacity * sparkleBoost)
          ctx.lineWidth = 0.5
          ctx.lineCap = 'round'
          
          for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3
            ctx.moveTo(0, 0)
            ctx.lineTo(Math.cos(angle) * size, Math.sin(angle) * size)
          }
          ctx.stroke()
          ctx.restore()
        } else {
          // Draw circular snowflake
          ctx.arc(flake.x + oscillation, flake.y, flake.radius, 0, Math.PI * 2)
          ctx.fillStyle = getSnowColor(flake.opacity * sparkleBoost)
          
          // Add glow for larger flakes
          if (flake.radius > 1.5 && (theme === 'blizzard' || theme === 'ice_storm')) {
            ctx.shadowColor = 'rgba(255, 255, 255, 0.5)'
            ctx.shadowBlur = flake.radius * 2
          }
          
          ctx.fill()
          ctx.shadowBlur = 0
        }
      })

      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animationFrameRef.current = requestAnimationFrame(animate)

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [intensity, windSpeed, respectReducedMotion, theme])

  // Don't render if no snow predicted
  if (intensity < 1) {
    return null
  }

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none ${className}`}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 1
      }}
      aria-hidden="true"
    />
  )
}
