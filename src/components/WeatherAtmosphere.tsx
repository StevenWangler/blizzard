import { useEffect, useRef, useMemo } from 'react'
import { useWeatherTheme } from '../hooks/useWeatherTheme'

interface Particle {
  x: number
  y: number
  size: number
  speedY: number
  speedX: number
  opacity: number
  wobble: number
  wobbleSpeed: number
  rotation: number
  rotationSpeed: number
  type: 'snow' | 'ice' | 'rain' | 'star' | 'aurora'
}

export function WeatherAtmosphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | undefined>(undefined)
  const particlesRef = useRef<Particle[]>([])
  const { currentTheme, getCurrentTheme, isDarkMode } = useWeatherTheme()
  const theme = getCurrentTheme()

  const config = useMemo(() => {
    // Configuration based on current theme
    const configs: Record<string, {
      particleCount: number
      particleTypes: Particle['type'][]
      speedMultiplier: number
      sizeRange: [number, number]
      windStrength: number
      hasGradientOverlay: boolean
      hasGlow: boolean
      glowIntensity: number
    }> = {
      clear: {
        particleCount: isDarkMode ? 50 : 20,
        particleTypes: isDarkMode ? ['star'] : ['star'],
        speedMultiplier: 0.2,
        sizeRange: [0.5, 2],
        windStrength: 0,
        hasGradientOverlay: true,
        hasGlow: true,
        glowIntensity: 0.3
      },
      partly_cloudy: {
        particleCount: 15,
        particleTypes: ['star'],
        speedMultiplier: 0.1,
        sizeRange: [0.5, 1.5],
        windStrength: 0.5,
        hasGradientOverlay: true,
        hasGlow: false,
        glowIntensity: 0.1
      },
      overcast: {
        particleCount: 0,
        particleTypes: [],
        speedMultiplier: 0,
        sizeRange: [0, 0],
        windStrength: 0,
        hasGradientOverlay: true,
        hasGlow: false,
        glowIntensity: 0
      },
      light_snow: {
        particleCount: 80,
        particleTypes: ['snow'],
        speedMultiplier: 0.8,
        sizeRange: [1, 3],
        windStrength: 0.3,
        hasGradientOverlay: true,
        hasGlow: true,
        glowIntensity: 0.4
      },
      snow_flurries: {
        particleCount: 120,
        particleTypes: ['snow'],
        speedMultiplier: 1.2,
        sizeRange: [0.8, 2.5],
        windStrength: 1.5,
        hasGradientOverlay: true,
        hasGlow: true,
        glowIntensity: 0.5
      },
      heavy_snow: {
        particleCount: 200,
        particleTypes: ['snow'],
        speedMultiplier: 1.5,
        sizeRange: [1.5, 4],
        windStrength: 0.8,
        hasGradientOverlay: true,
        hasGlow: true,
        glowIntensity: 0.6
      },
      blizzard: {
        particleCount: 350,
        particleTypes: ['snow', 'ice'],
        speedMultiplier: 2.5,
        sizeRange: [1, 5],
        windStrength: 3,
        hasGradientOverlay: true,
        hasGlow: true,
        glowIntensity: 0.8
      },
      ice_storm: {
        particleCount: 150,
        particleTypes: ['ice', 'rain'],
        speedMultiplier: 2,
        sizeRange: [1, 3],
        windStrength: 1.5,
        hasGradientOverlay: true,
        hasGlow: true,
        glowIntensity: 0.7
      },
      freezing_rain: {
        particleCount: 180,
        particleTypes: ['rain', 'ice'],
        speedMultiplier: 3,
        sizeRange: [1, 2],
        windStrength: 1,
        hasGradientOverlay: true,
        hasGlow: false,
        glowIntensity: 0.3
      },
      sleet: {
        particleCount: 160,
        particleTypes: ['rain', 'snow', 'ice'],
        speedMultiplier: 2.2,
        sizeRange: [0.8, 2.5],
        windStrength: 1.2,
        hasGradientOverlay: true,
        hasGlow: false,
        glowIntensity: 0.4
      },
      whiteout: {
        particleCount: 500,
        particleTypes: ['snow'],
        speedMultiplier: 3,
        sizeRange: [2, 6],
        windStrength: 4,
        hasGradientOverlay: true,
        hasGlow: true,
        glowIntensity: 1
      },
      aurora: {
        particleCount: 80,
        particleTypes: ['aurora', 'star'],
        speedMultiplier: 0.3,
        sizeRange: [0.5, 2],
        windStrength: 0.2,
        hasGradientOverlay: true,
        hasGlow: true,
        glowIntensity: 0.9
      }
    }
    return configs[currentTheme] || configs.clear
  }, [currentTheme, isDarkMode])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Check for reduced motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // Initialize particles
    const createParticle = (randomY = true): Particle => {
      const types = config.particleTypes
      const type = types[Math.floor(Math.random() * types.length)] || 'snow'
      
      return {
        x: Math.random() * canvas.width,
        y: randomY ? Math.random() * canvas.height : -10,
        size: config.sizeRange[0] + Math.random() * (config.sizeRange[1] - config.sizeRange[0]),
        speedY: (0.5 + Math.random()) * config.speedMultiplier,
        speedX: (Math.random() - 0.5) * config.windStrength,
        opacity: 0.3 + Math.random() * 0.7,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.02 + Math.random() * 0.03,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.02,
        type
      }
    }

    particlesRef.current = Array.from({ length: config.particleCount }, () => createParticle(true))

    // Aurora wave state
    let auroraPhase = 0

    const animate = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw aurora effect for aurora theme
      if (currentTheme === 'aurora') {
        drawAurora(ctx, canvas.width, canvas.height, auroraPhase)
        auroraPhase += 0.005
      }

      // Update and draw particles
      particlesRef.current.forEach((p, i) => {
        // Update position
        p.y += p.speedY
        p.x += p.speedX + Math.sin(p.wobble) * 0.5
        p.wobble += p.wobbleSpeed
        p.rotation += p.rotationSpeed

        // Wrap around edges
        if (p.y > canvas.height + 10) {
          particlesRef.current[i] = createParticle(false)
          return
        }
        if (p.x > canvas.width + 10) p.x = -10
        if (p.x < -10) p.x = canvas.width + 10

        // Draw based on type
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.globalAlpha = p.opacity

        switch (p.type) {
          case 'snow':
            drawSnowflake(ctx, p.size, theme?.particleColor || 'rgba(255,255,255,0.9)')
            break
          case 'ice':
            drawIceCrystal(ctx, p.size, theme?.particleColor || 'rgba(200,230,255,0.8)')
            break
          case 'rain':
            drawRaindrop(ctx, p.size, theme?.particleColor || 'rgba(150,180,220,0.7)')
            break
          case 'star':
            drawStar(ctx, p.size, theme?.particleColor || 'rgba(255,255,200,0.8)')
            break
          case 'aurora':
            drawAuroraParticle(ctx, p.size, time)
            break
        }

        ctx.restore()
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [currentTheme, config, theme, isDarkMode])

  // Don't render for themes with no particles and no special effects
  if (config.particleCount === 0 && currentTheme !== 'overcast') {
    return null
  }

  return (
    <>
      {/* Gradient overlay */}
      {config.hasGradientOverlay && theme?.gradient && (
        <div 
          className="fixed inset-0 pointer-events-none z-0 transition-opacity duration-1000"
          style={{
            background: theme.gradient,
            opacity: theme.atmosphereIntensity || 0.15,
            mixBlendMode: isDarkMode ? 'screen' : 'multiply'
          }}
        />
      )}
      
      {/* Glow effect */}
      {config.hasGlow && theme?.glowColor && (
        <div 
          className="fixed inset-0 pointer-events-none z-0"
          style={{
            background: `radial-gradient(ellipse at 50% 0%, ${theme.glowColor} 0%, transparent 60%)`,
            opacity: config.glowIntensity * 0.4,
          }}
        />
      )}

      {/* Shimmer effect for appropriate themes */}
      {theme?.shimmer && (
        <div 
          className="fixed inset-0 pointer-events-none z-0 animate-shimmer"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${theme.glowColor || 'rgba(255,255,255,0.1)'} 50%, transparent 100%)`,
            opacity: 0.1,
            backgroundSize: '200% 100%',
          }}
        />
      )}
      
      {/* Particle canvas */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-[1]"
        aria-hidden="true"
      />
    </>
  )
}

// Drawing functions
function drawSnowflake(ctx: CanvasRenderingContext2D, size: number, color: string) {
  ctx.beginPath()
  ctx.fillStyle = color
  // Simple circle snowflake with slight glow
  ctx.shadowColor = 'rgba(255,255,255,0.5)'
  ctx.shadowBlur = size
  ctx.arc(0, 0, size, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
}

function drawIceCrystal(ctx: CanvasRenderingContext2D, size: number, color: string) {
  ctx.beginPath()
  ctx.strokeStyle = color
  ctx.lineWidth = size * 0.3
  ctx.lineCap = 'round'
  
  // Draw a simple 6-pointed crystal
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3
    ctx.moveTo(0, 0)
    ctx.lineTo(Math.cos(angle) * size * 2, Math.sin(angle) * size * 2)
  }
  ctx.stroke()
}

function drawRaindrop(ctx: CanvasRenderingContext2D, size: number, color: string) {
  ctx.beginPath()
  ctx.fillStyle = color
  // Elongated teardrop shape
  ctx.ellipse(0, 0, size * 0.3, size * 1.5, 0, 0, Math.PI * 2)
  ctx.fill()
}

function drawStar(ctx: CanvasRenderingContext2D, size: number, color: string) {
  ctx.beginPath()
  ctx.fillStyle = color
  ctx.shadowColor = color
  ctx.shadowBlur = size * 2
  ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
}

function drawAuroraParticle(ctx: CanvasRenderingContext2D, size: number, time: number) {
  const hue = (time * 0.05 + size * 20) % 360
  ctx.beginPath()
  ctx.fillStyle = `hsla(${hue}, 80%, 60%, 0.3)`
  ctx.shadowColor = `hsla(${hue}, 90%, 50%, 0.5)`
  ctx.shadowBlur = size * 4
  ctx.arc(0, 0, size, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
}

function drawAurora(ctx: CanvasRenderingContext2D, width: number, height: number, phase: number) {
  const gradient = ctx.createLinearGradient(0, 0, width, height * 0.5)
  
  // Animated aurora colors
  const hue1 = (phase * 20) % 360
  const hue2 = (hue1 + 60) % 360
  const hue3 = (hue1 + 120) % 360
  
  gradient.addColorStop(0, `hsla(${hue1}, 85%, 50%, 0)`)
  gradient.addColorStop(0.2, `hsla(${hue1}, 85%, 50%, 0.15)`)
  gradient.addColorStop(0.4, `hsla(${hue2}, 80%, 55%, 0.2)`)
  gradient.addColorStop(0.6, `hsla(${hue3}, 75%, 45%, 0.15)`)
  gradient.addColorStop(0.8, `hsla(${hue2}, 85%, 50%, 0.1)`)
  gradient.addColorStop(1, `hsla(${hue1}, 85%, 50%, 0)`)

  // Draw wavy aurora bands
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  
  for (let band = 0; band < 3; band++) {
    ctx.beginPath()
    ctx.moveTo(0, height * 0.1)
    
    for (let x = 0; x <= width; x += 10) {
      const waveY = Math.sin(x * 0.005 + phase + band) * 30 +
                    Math.sin(x * 0.008 + phase * 1.3 + band * 2) * 20
      ctx.lineTo(x, height * (0.1 + band * 0.08) + waveY)
    }
    
    ctx.lineTo(width, height * 0.5)
    ctx.lineTo(0, height * 0.5)
    ctx.closePath()
    
    ctx.fillStyle = gradient
    ctx.fill()
  }
  
  ctx.restore()
}
