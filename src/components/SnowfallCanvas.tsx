import { useEffect, useRef } from 'react'

interface SnowflakeParticle {
  x: number
  y: number
  radius: number
  speed: number
  drift: number
  opacity: number
  angle: number
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
}

export function SnowfallCanvas({
  intensity = 0,
  windSpeed = 0,
  respectReducedMotion = true,
  className = ''
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
    const particleCount = Math.min(Math.floor(intensity * 10), 150)
    
    // Calculate drift based on wind speed (0-50 mph = 0-5 drift)
    const windDrift = Math.min(windSpeed / 10, 5)

    // Initialize snowflakes
    const initSnowflakes = () => {
      snowflakesRef.current = []
      for (let i = 0; i < particleCount; i++) {
        snowflakesRef.current.push(createSnowflake(canvas.width, canvas.height, true))
      }
    }

    const createSnowflake = (width: number, height: number, randomY = false): SnowflakeParticle => {
      return {
        x: Math.random() * width,
        y: randomY ? Math.random() * height : -10,
        radius: Math.random() * 2 + 1, // 1-3px radius
        speed: Math.random() * 1 + 0.5, // 0.5-1.5 fall speed
        drift: (Math.random() - 0.5) * windDrift, // -2.5 to 2.5 horizontal drift
        opacity: Math.random() * 0.6 + 0.4, // 0.4-1.0 opacity
        angle: Math.random() * Math.PI * 2
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

        // Add subtle oscillation for realism
        const oscillation = Math.sin(flake.angle) * 0.5
        
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

        // Draw snowflake
        ctx.beginPath()
        ctx.arc(flake.x + oscillation, flake.y, flake.radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 255, 255, ${flake.opacity})`
        ctx.fill()
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
  }, [intensity, windSpeed, respectReducedMotion])

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
