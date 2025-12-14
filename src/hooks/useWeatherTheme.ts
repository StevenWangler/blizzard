import { createContext, createElement, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'

// Safe wrapper for useKV that falls back to useState when Spark KV is unavailable
function useSafeKV<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(defaultValue)
  const [initialized, setInitialized] = useState(false)

  // Try to load from localStorage on mount as fallback
  useEffect(() => {
    if (initialized) return
    try {
      const stored = localStorage.getItem(`spark_kv_${key}`)
      if (stored) {
        setState(JSON.parse(stored))
      }
    } catch {
      // Ignore localStorage errors
    }
    setInitialized(true)
  }, [key, initialized])

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setState(prev => {
      const newValue = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value
      // Also persist to localStorage as backup
      try {
        localStorage.setItem(`spark_kv_${key}`, JSON.stringify(newValue))
      } catch {
        // Ignore localStorage errors
      }
      return newValue
    })
  }, [key])

  return [state, setValue]
}

export interface WeatherTheme {
  name: string
  emoji: string
  primary: string
  secondary: string
  accent: string
  background: string
  foreground: string
  card: string
  border: string
  muted: string
  // Enhanced atmospheric properties
  gradient?: string
  glowColor?: string
  particleColor?: string
  atmosphereIntensity?: number // 0-1 for overlay effects
  shimmer?: boolean
  pulseSpeed?: 'slow' | 'normal' | 'fast'
}

function clampOklchLightness(
  color: string,
  options: { minLightness?: number; maxLightness?: number; minChroma?: number }
): string {
  const match = color.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/i)
  if (!match) return color

  const [, lightness, chroma, hue] = match
  let l = Number.parseFloat(lightness)
  const c = Number.parseFloat(chroma)
  const h = Number.parseFloat(hue)

  if (Number.isNaN(l) || Number.isNaN(c) || Number.isNaN(h)) return color

  if (options.minLightness !== undefined && l < options.minLightness) {
    l = options.minLightness
  }
  if (options.maxLightness !== undefined && l > options.maxLightness) {
    l = options.maxLightness
  }

  const adjustedChroma = Math.max(c, options.minChroma ?? 0)
  return `oklch(${l.toFixed(3)} ${adjustedChroma.toFixed(3)} ${h.toFixed(3)})`
}

function applyDarkContrastSafety(theme: WeatherTheme): WeatherTheme {
  // Keep night palettes moody while enforcing a minimum contrast for legibility.
  return {
    ...theme,
    background: clampOklchLightness(theme.background, { minLightness: 0.14, minChroma: 0.04 }),
    card: clampOklchLightness(theme.card, { minLightness: 0.18, minChroma: 0.04 }),
    secondary: clampOklchLightness(theme.secondary, { minLightness: 0.2, minChroma: 0.04 }),
    muted: clampOklchLightness(theme.muted, { minLightness: 0.2, minChroma: 0.04 }),
    border: clampOklchLightness(theme.border, { minLightness: 0.32, minChroma: 0.04 }),
    primary: clampOklchLightness(theme.primary, { minLightness: 0.55, minChroma: 0.12 }),
    accent: clampOklchLightness(theme.accent, { minLightness: 0.58, minChroma: 0.12 }),
    foreground: clampOklchLightness(theme.foreground, { minLightness: 0.92, minChroma: 0.02 })
  }
}

export const weatherThemes: Record<string, WeatherTheme> = {
  clear: {
    name: 'Clear Skies',
    emoji: '☀️',
    primary: 'oklch(0.55 0.18 220)',      // Vibrant clear blue
    secondary: 'oklch(0.92 0.04 220)',    // Light blue-gray
    accent: 'oklch(0.75 0.18 65)',        // Warm sunny gold
    background: 'oklch(0.98 0.015 220)',  // Very light blue-white
    foreground: 'oklch(0.2 0.08 220)',    // Dark blue-gray
    card: 'oklch(1 0 0)',                 // Pure white
    border: 'oklch(0.88 0.03 220)',       // Light blue-gray border
    muted: 'oklch(0.92 0.03 220)',        // Muted blue-gray
    gradient: 'linear-gradient(135deg, oklch(0.95 0.03 200) 0%, oklch(0.98 0.02 60) 100%)',
    glowColor: 'oklch(0.8 0.15 65)',
    particleColor: 'rgba(255, 215, 0, 0.3)',
    atmosphereIntensity: 0.1,
    shimmer: true,
    pulseSpeed: 'slow'
  },
  partly_cloudy: {
    name: 'Partly Cloudy',
    emoji: '⛅',
    primary: 'oklch(0.5 0.12 215)',       // Muted sky blue
    secondary: 'oklch(0.88 0.03 210)',    // Soft cloud gray
    accent: 'oklch(0.7 0.1 55)',          // Peeking sun gold
    background: 'oklch(0.96 0.02 215)',   // Light cloudy white
    foreground: 'oklch(0.22 0.06 215)',   // Dark blue-gray
    card: 'oklch(0.995 0.005 215)',       // Almost white
    border: 'oklch(0.86 0.025 215)',      // Cloud border
    muted: 'oklch(0.9 0.02 215)',         // Cloud muted
    gradient: 'linear-gradient(180deg, oklch(0.9 0.04 215) 0%, oklch(0.97 0.02 210) 60%, oklch(0.95 0.03 55) 100%)',
    glowColor: 'oklch(0.85 0.08 55)',
    particleColor: 'rgba(200, 200, 210, 0.2)',
    atmosphereIntensity: 0.15,
    shimmer: false,
    pulseSpeed: 'slow'
  },
  overcast: {
    name: 'Overcast',
    emoji: '☁️',
    primary: 'oklch(0.45 0.06 230)',      // Flat gray-blue
    secondary: 'oklch(0.82 0.03 230)',    // Heavy cloud gray
    accent: 'oklch(0.55 0.08 230)',       // Muted accent
    background: 'oklch(0.94 0.015 230)',  // Overcast white
    foreground: 'oklch(0.25 0.05 230)',   // Dark gray
    card: 'oklch(0.97 0.01 230)',         // Cloud white
    border: 'oklch(0.82 0.02 230)',       // Gray border
    muted: 'oklch(0.87 0.02 230)',        // Overcast muted
    gradient: 'linear-gradient(180deg, oklch(0.85 0.02 230) 0%, oklch(0.92 0.015 230) 100%)',
    glowColor: 'oklch(0.7 0.04 230)',
    particleColor: 'rgba(180, 185, 195, 0.15)',
    atmosphereIntensity: 0.2,
    shimmer: false,
    pulseSpeed: 'slow'
  },
  light_snow: {
    name: 'Light Snow',
    emoji: '🌨️',
    primary: 'oklch(0.5 0.14 245)',       // Soft winter blue
    secondary: 'oklch(0.88 0.045 245)',   // Light snow gray
    accent: 'oklch(0.78 0.12 195)',       // Icy cyan sparkle
    background: 'oklch(0.97 0.025 245)',  // Snow white with blue hint
    foreground: 'oklch(0.22 0.08 245)',   // Dark winter blue
    card: 'oklch(0.99 0.015 245)',        // Snow white
    border: 'oklch(0.85 0.04 245)',       // Soft gray border
    muted: 'oklch(0.9 0.035 245)',        // Light winter gray
    gradient: 'linear-gradient(180deg, oklch(0.92 0.04 250) 0%, oklch(0.97 0.025 245) 50%, oklch(0.99 0.01 240) 100%)',
    glowColor: 'oklch(0.85 0.1 200)',
    particleColor: 'rgba(255, 255, 255, 0.9)',
    atmosphereIntensity: 0.25,
    shimmer: true,
    pulseSpeed: 'normal'
  },
  snow_flurries: {
    name: 'Snow Flurries',
    emoji: '❄️',
    primary: 'oklch(0.52 0.13 250)',      // Dancing blue
    secondary: 'oklch(0.86 0.05 250)',    // Flurry gray
    accent: 'oklch(0.8 0.1 190)',         // Sparkle cyan
    background: 'oklch(0.965 0.03 250)',  // Flurry white
    foreground: 'oklch(0.23 0.08 250)',   // Winter blue-gray
    card: 'oklch(0.985 0.02 250)',        // Crisp white
    border: 'oklch(0.84 0.045 250)',      // Flurry border
    muted: 'oklch(0.89 0.04 250)',        // Flurry muted
    gradient: 'linear-gradient(135deg, oklch(0.93 0.045 255) 0%, oklch(0.97 0.03 245) 50%, oklch(0.96 0.035 250) 100%)',
    glowColor: 'oklch(0.88 0.08 195)',
    particleColor: 'rgba(230, 240, 255, 0.95)',
    atmosphereIntensity: 0.3,
    shimmer: true,
    pulseSpeed: 'fast'
  },
  heavy_snow: {
    name: 'Heavy Snow',
    emoji: '🌨️',
    primary: 'oklch(0.42 0.16 265)',      // Deep winter blue
    secondary: 'oklch(0.8 0.07 265)',     // Storm gray
    accent: 'oklch(0.68 0.14 210)',       // Ice blue
    background: 'oklch(0.94 0.04 265)',   // Storm-tinted white
    foreground: 'oklch(0.18 0.1 265)',    // Dark storm blue
    card: 'oklch(0.975 0.025 265)',       // Cold white
    border: 'oklch(0.78 0.06 265)',       // Storm border
    muted: 'oklch(0.85 0.05 265)',        // Storm gray
    gradient: 'linear-gradient(180deg, oklch(0.85 0.07 270) 0%, oklch(0.92 0.05 265) 40%, oklch(0.95 0.035 260) 100%)',
    glowColor: 'oklch(0.7 0.12 215)',
    particleColor: 'rgba(255, 255, 255, 0.95)',
    atmosphereIntensity: 0.4,
    shimmer: true,
    pulseSpeed: 'normal'
  },
  blizzard: {
    name: 'Blizzard',
    emoji: '🌀',
    primary: 'oklch(0.38 0.2 285)',       // Intense storm blue
    secondary: 'oklch(0.72 0.1 285)',     // Heavy storm gray
    accent: 'oklch(0.58 0.18 330)',       // Fierce purple-magenta
    background: 'oklch(0.9 0.055 285)',   // Storm-darkened white
    foreground: 'oklch(0.12 0.12 285)',   // Very dark storm
    card: 'oklch(0.94 0.04 285)',         // Blizzard white
    border: 'oklch(0.72 0.08 285)',       // Strong storm border
    muted: 'oklch(0.8 0.06 285)',         // Blizzard gray
    gradient: 'linear-gradient(135deg, oklch(0.78 0.1 290) 0%, oklch(0.88 0.07 280) 50%, oklch(0.85 0.08 320) 100%)',
    glowColor: 'oklch(0.6 0.15 320)',
    particleColor: 'rgba(255, 255, 255, 1)',
    atmosphereIntensity: 0.55,
    shimmer: true,
    pulseSpeed: 'fast'
  },
  ice_storm: {
    name: 'Ice Storm',
    emoji: '🧊',
    primary: 'oklch(0.48 0.12 200)',      // Crystalline teal
    secondary: 'oklch(0.78 0.08 200)',    // Ice gray
    accent: 'oklch(0.72 0.15 180)',       // Frozen cyan
    background: 'oklch(0.95 0.035 200)',  // Icy white
    foreground: 'oklch(0.2 0.08 200)',    // Dark ice blue
    card: 'oklch(0.98 0.025 200)',        // Crystal white
    border: 'oklch(0.8 0.06 200)',        // Ice border
    muted: 'oklch(0.86 0.05 200)',        // Frozen muted
    gradient: 'linear-gradient(180deg, oklch(0.88 0.08 190) 0%, oklch(0.95 0.04 205) 50%, oklch(0.92 0.06 195) 100%)',
    glowColor: 'oklch(0.75 0.12 185)',
    particleColor: 'rgba(200, 245, 255, 0.8)',
    atmosphereIntensity: 0.45,
    shimmer: true,
    pulseSpeed: 'normal'
  },
  freezing_rain: {
    name: 'Freezing Rain',
    emoji: '🌧️',
    primary: 'oklch(0.45 0.1 220)',       // Cold rain blue
    secondary: 'oklch(0.76 0.06 220)',    // Wet gray
    accent: 'oklch(0.6 0.12 195)',        // Slick teal
    background: 'oklch(0.93 0.03 220)',   // Wet pavement gray
    foreground: 'oklch(0.18 0.08 220)',   // Dark wet blue
    card: 'oklch(0.96 0.02 220)',         // Wet white
    border: 'oklch(0.75 0.05 220)',       // Wet border
    muted: 'oklch(0.83 0.04 220)',        // Rain muted
    gradient: 'linear-gradient(180deg, oklch(0.82 0.06 225) 0%, oklch(0.9 0.04 220) 60%, oklch(0.85 0.05 215) 100%)',
    glowColor: 'oklch(0.65 0.1 200)',
    particleColor: 'rgba(180, 200, 220, 0.7)',
    atmosphereIntensity: 0.35,
    shimmer: false,
    pulseSpeed: 'normal'
  },
  sleet: {
    name: 'Sleet',
    emoji: '🌨️',
    primary: 'oklch(0.47 0.11 235)',      // Mixed precipitation blue
    secondary: 'oklch(0.8 0.05 235)',     // Sleet gray
    accent: 'oklch(0.65 0.12 190)',       // Icy mix
    background: 'oklch(0.94 0.03 235)',   // Slushy white
    foreground: 'oklch(0.2 0.08 235)',    // Dark sleet
    card: 'oklch(0.97 0.02 235)',         // Cold white
    border: 'oklch(0.78 0.05 235)',       // Sleet border
    muted: 'oklch(0.85 0.04 235)',        // Sleet muted
    gradient: 'linear-gradient(180deg, oklch(0.84 0.06 240) 0%, oklch(0.92 0.04 232) 50%, oklch(0.88 0.05 228) 100%)',
    glowColor: 'oklch(0.7 0.1 195)',
    particleColor: 'rgba(220, 230, 245, 0.85)',
    atmosphereIntensity: 0.38,
    shimmer: false,
    pulseSpeed: 'normal'
  },
  whiteout: {
    name: 'Whiteout',
    emoji: '⬜',
    primary: 'oklch(0.35 0.12 270)',      // Barely visible blue
    secondary: 'oklch(0.88 0.04 270)',    // Near-white gray
    accent: 'oklch(0.5 0.1 270)',         // Muted accent
    background: 'oklch(0.98 0.02 270)',   // Near white
    foreground: 'oklch(0.3 0.06 270)',    // Faded text
    card: 'oklch(0.995 0.01 270)',        // Almost invisible
    border: 'oklch(0.92 0.02 270)',       // Faint border
    muted: 'oklch(0.94 0.02 270)',        // Very muted
    gradient: 'linear-gradient(180deg, oklch(0.97 0.02 275) 0%, oklch(0.99 0.01 270) 50%, oklch(0.98 0.015 265) 100%)',
    glowColor: 'oklch(0.95 0.03 270)',
    particleColor: 'rgba(255, 255, 255, 1)',
    atmosphereIntensity: 0.7,
    shimmer: true,
    pulseSpeed: 'fast'
  },
  aurora: {
    name: 'Aurora Night',
    emoji: '🌌',
    primary: 'oklch(0.55 0.2 160)',       // Aurora green
    secondary: 'oklch(0.35 0.1 280)',     // Deep night purple
    accent: 'oklch(0.6 0.22 310)',        // Magenta aurora
    background: 'oklch(0.96 0.025 180)',  // Night-kissed white
    foreground: 'oklch(0.2 0.1 200)',     // Dark teal
    card: 'oklch(0.98 0.02 180)',         // Aurora white
    border: 'oklch(0.85 0.06 180)',       // Aurora border
    muted: 'oklch(0.88 0.05 200)',        // Aurora muted
    gradient: 'linear-gradient(135deg, oklch(0.92 0.06 160) 0%, oklch(0.95 0.04 200) 33%, oklch(0.93 0.06 280) 66%, oklch(0.94 0.05 320) 100%)',
    glowColor: 'oklch(0.65 0.2 160)',
    particleColor: 'rgba(100, 255, 180, 0.4)',
    atmosphereIntensity: 0.35,
    shimmer: true,
    pulseSpeed: 'slow'
  },
  polar_dawn: {
    name: 'Polar Dawn',
    emoji: '🌅',
    primary: 'oklch(0.62 0.16 25)',       // Sunrise amber
    secondary: 'oklch(0.92 0.045 250)',   // Frosted lavender sky
    accent: 'oklch(0.75 0.17 340)',       // Pink glow
    background: 'oklch(0.985 0.02 255)',  // Snowfield white
    foreground: 'oklch(0.25 0.06 250)',   // Cool text
    card: 'oklch(0.995 0.015 255)',       // Crisp card
    border: 'oklch(0.9 0.03 250)',        // Soft edge
    muted: 'oklch(0.93 0.025 255)',       // Gentle muted
    gradient: 'linear-gradient(140deg, oklch(0.96 0.05 25) 0%, oklch(0.97 0.04 330) 40%, oklch(0.99 0.015 255) 100%)',
    glowColor: 'oklch(0.8 0.14 20)',
    particleColor: 'rgba(255, 225, 240, 0.8)',
    atmosphereIntensity: 0.28,
    shimmer: true,
    pulseSpeed: 'slow'
  },
  frosted_pine: {
    name: 'Frosted Pines',
    emoji: '🌲',
    primary: 'oklch(0.5 0.14 150)',       // Evergreen
    secondary: 'oklch(0.9 0.03 150)',     // Snowy needles
    accent: 'oklch(0.7 0.14 50)',         // Lantern glow
    background: 'oklch(0.97 0.02 150)',   // Powder backdrop
    foreground: 'oklch(0.24 0.07 150)',   // Pine bark text
    card: 'oklch(0.99 0.015 150)',        // Soft white card
    border: 'oklch(0.88 0.025 150)',      // Pine mist border
    muted: 'oklch(0.92 0.02 150)',        // Muted frost
    gradient: 'linear-gradient(155deg, oklch(0.9 0.035 150) 0%, oklch(0.95 0.025 120) 50%, oklch(0.98 0.02 60) 100%)',
    glowColor: 'oklch(0.76 0.12 55)',
    particleColor: 'rgba(225, 245, 235, 0.9)',
    atmosphereIntensity: 0.32,
    shimmer: false,
    pulseSpeed: 'normal'
  },
  glacial_lagoon: {
    name: 'Glacial Lagoon',
    emoji: '🧊',
    primary: 'oklch(0.53 0.16 220)',      // Arctic teal
    secondary: 'oklch(0.88 0.05 230)',    // Misty fjord
    accent: 'oklch(0.72 0.16 255)',       // Ice sparkle
    background: 'oklch(0.96 0.03 225)',   // Pale aqua
    foreground: 'oklch(0.2 0.07 230)',    // Deep water text
    card: 'oklch(0.99 0.02 225)',         // Frost glass
    border: 'oklch(0.86 0.04 225)',       // Lagoon edge
    muted: 'oklch(0.9 0.035 225)',        // Mist muted
    gradient: 'linear-gradient(150deg, oklch(0.9 0.055 220) 0%, oklch(0.94 0.045 240) 50%, oklch(0.97 0.03 200) 100%)',
    glowColor: 'oklch(0.72 0.18 250)',
    particleColor: 'rgba(205, 240, 255, 0.9)',
    atmosphereIntensity: 0.36,
    shimmer: true,
    pulseSpeed: 'normal'
  },
  cabin_glow: {
    name: 'Cabin Glow',
    emoji: '🏔️',
    primary: 'oklch(0.56 0.13 35)',       // Warm cabin light
    secondary: 'oklch(0.9 0.02 80)',      // Snowy roof
    accent: 'oklch(0.72 0.16 55)',        // Candlelit accent
    background: 'oklch(0.975 0.015 80)',  // Frosty dusk
    foreground: 'oklch(0.22 0.06 40)',    // Cabin timber
    card: 'oklch(0.99 0.01 80)',          // Snowy card
    border: 'oklch(0.9 0.02 70)',         // Gentle outline
    muted: 'oklch(0.93 0.02 80)',         // Soft muted
    gradient: 'linear-gradient(165deg, oklch(0.96 0.025 80) 0%, oklch(0.95 0.04 40) 45%, oklch(0.98 0.015 220) 100%)',
    glowColor: 'oklch(0.78 0.14 55)',
    particleColor: 'rgba(255, 225, 200, 0.65)',
    atmosphereIntensity: 0.3,
    shimmer: false,
    pulseSpeed: 'slow'
  },
  ice_palace: {
    name: 'Ice Palace',
    emoji: '🏰',
    primary: 'oklch(0.5 0.2 270)',        // Regal violet ice
    secondary: 'oklch(0.86 0.05 270)',    // Frosted lilac
    accent: 'oklch(0.74 0.2 320)',        // Neon magenta
    background: 'oklch(0.95 0.035 285)',  // Glacial mist
    foreground: 'oklch(0.2 0.1 270)',     // Deep plum
    card: 'oklch(0.985 0.02 280)',        // Palace white
    border: 'oklch(0.86 0.04 280)',       // Cool edge
    muted: 'oklch(0.9 0.03 280)',         // Frozen hush
    gradient: 'linear-gradient(135deg, oklch(0.9 0.08 285) 0%, oklch(0.94 0.07 300) 45%, oklch(0.97 0.035 250) 100%)',
    glowColor: 'oklch(0.76 0.2 320)',
    particleColor: 'rgba(230, 220, 255, 0.9)',
    atmosphereIntensity: 0.42,
    shimmer: true,
    pulseSpeed: 'fast'
  }
}

// Dark mode variants for each weather theme
export const darkWeatherThemes: Record<string, WeatherTheme> = {
  clear: {
    name: 'Clear Night',
    emoji: '🌙',
    primary: 'oklch(0.62 0.18 220)',      // Bright night blue
    secondary: 'oklch(0.18 0.06 220)',    // Dark night blue
    accent: 'oklch(0.82 0.18 55)',        // Moonlight gold
    background: 'oklch(0.1 0.04 230)',    // Deep night blue
    foreground: 'oklch(0.92 0.02 220)',   // Light blue-white
    card: 'oklch(0.14 0.05 225)',         // Night card
    border: 'oklch(0.25 0.06 220)',       // Night border
    muted: 'oklch(0.17 0.05 220)',        // Night muted
    gradient: 'linear-gradient(180deg, oklch(0.08 0.06 240) 0%, oklch(0.12 0.04 220) 60%, oklch(0.15 0.05 200) 100%)',
    glowColor: 'oklch(0.7 0.15 55)',
    particleColor: 'rgba(255, 255, 200, 0.15)',
    atmosphereIntensity: 0.15,
    shimmer: true,
    pulseSpeed: 'slow'
  },
  partly_cloudy: {
    name: 'Partly Cloudy Night',
    emoji: '🌥️',
    primary: 'oklch(0.55 0.1 215)',       // Night cloud blue
    secondary: 'oklch(0.2 0.04 215)',     // Dark cloud
    accent: 'oklch(0.65 0.08 50)',        // Dim moonlight
    background: 'oklch(0.11 0.04 220)',   // Cloudy night
    foreground: 'oklch(0.88 0.02 215)',   // Light text
    card: 'oklch(0.15 0.04 218)',         // Night cloud card
    border: 'oklch(0.26 0.04 215)',       // Cloud border
    muted: 'oklch(0.18 0.04 215)',        // Cloud muted
    gradient: 'linear-gradient(180deg, oklch(0.12 0.05 220) 0%, oklch(0.14 0.04 215) 100%)',
    glowColor: 'oklch(0.5 0.06 50)',
    particleColor: 'rgba(150, 160, 180, 0.1)',
    atmosphereIntensity: 0.2,
    shimmer: false,
    pulseSpeed: 'slow'
  },
  overcast: {
    name: 'Overcast Night',
    emoji: '☁️',
    primary: 'oklch(0.5 0.06 230)',       // Flat gray night
    secondary: 'oklch(0.22 0.04 230)',    // Heavy night cloud
    accent: 'oklch(0.45 0.06 230)',       // Muted night accent
    background: 'oklch(0.1 0.03 230)',    // Dark overcast
    foreground: 'oklch(0.85 0.02 230)',   // Light gray
    card: 'oklch(0.14 0.035 230)',        // Night cloud card
    border: 'oklch(0.24 0.04 230)',       // Gray border
    muted: 'oklch(0.17 0.035 230)',       // Overcast muted
    gradient: 'linear-gradient(180deg, oklch(0.11 0.04 235) 0%, oklch(0.13 0.03 228) 100%)',
    glowColor: 'oklch(0.4 0.04 230)',
    particleColor: 'rgba(100, 110, 130, 0.1)',
    atmosphereIntensity: 0.25,
    shimmer: false,
    pulseSpeed: 'slow'
  },
  light_snow: {
    name: 'Snowy Night',
    emoji: '❄️',
    primary: 'oklch(0.58 0.14 250)',      // Snowy night blue
    secondary: 'oklch(0.2 0.05 250)',     // Dark snow gray
    accent: 'oklch(0.78 0.12 195)',       // Icy night cyan
    background: 'oklch(0.12 0.045 250)',  // Snowy night
    foreground: 'oklch(0.9 0.02 250)',    // Snow white text
    card: 'oklch(0.16 0.05 250)',         // Snowy night card
    border: 'oklch(0.28 0.05 250)',       // Snowy border
    muted: 'oklch(0.19 0.045 250)',       // Snowy muted
    gradient: 'linear-gradient(180deg, oklch(0.14 0.06 255) 0%, oklch(0.11 0.05 248) 100%)',
    glowColor: 'oklch(0.7 0.1 200)',
    particleColor: 'rgba(255, 255, 255, 0.8)',
    atmosphereIntensity: 0.3,
    shimmer: true,
    pulseSpeed: 'normal'
  },
  snow_flurries: {
    name: 'Flurries Night',
    emoji: '✨',
    primary: 'oklch(0.56 0.12 255)',      // Dancing night blue
    secondary: 'oklch(0.21 0.05 255)',    // Dark flurry
    accent: 'oklch(0.75 0.1 190)',        // Night sparkle
    background: 'oklch(0.11 0.05 255)',   // Flurry night
    foreground: 'oklch(0.88 0.02 255)',   // Light text
    card: 'oklch(0.15 0.05 255)',         // Night flurry card
    border: 'oklch(0.27 0.05 255)',       // Flurry border
    muted: 'oklch(0.18 0.045 255)',       // Flurry muted
    gradient: 'linear-gradient(135deg, oklch(0.12 0.06 260) 0%, oklch(0.1 0.05 250) 100%)',
    glowColor: 'oklch(0.7 0.08 195)',
    particleColor: 'rgba(220, 235, 255, 0.85)',
    atmosphereIntensity: 0.35,
    shimmer: true,
    pulseSpeed: 'fast'
  },
  heavy_snow: {
    name: 'Storm Night',
    emoji: '🌨️',
    primary: 'oklch(0.52 0.16 265)',      // Storm night blue
    secondary: 'oklch(0.24 0.07 265)',    // Dark storm
    accent: 'oklch(0.7 0.14 210)',        // Storm ice blue
    background: 'oklch(0.09 0.055 265)',  // Deep storm night
    foreground: 'oklch(0.87 0.03 265)',   // Storm white
    card: 'oklch(0.12 0.06 265)',         // Storm card
    border: 'oklch(0.24 0.06 265)',       // Storm border
    muted: 'oklch(0.15 0.055 265)',       // Storm muted
    gradient: 'linear-gradient(180deg, oklch(0.1 0.07 270) 0%, oklch(0.08 0.055 262) 100%)',
    glowColor: 'oklch(0.55 0.12 215)',
    particleColor: 'rgba(255, 255, 255, 0.9)',
    atmosphereIntensity: 0.45,
    shimmer: true,
    pulseSpeed: 'normal'
  },
  blizzard: {
    name: 'Blizzard Night',
    emoji: '🌀',
    primary: 'oklch(0.48 0.2 285)',       // Fierce night storm
    secondary: 'oklch(0.28 0.1 285)',     // Dark blizzard
    accent: 'oklch(0.62 0.18 330)',       // Fierce night purple
    background: 'oklch(0.07 0.065 285)',  // Deep blizzard night
    foreground: 'oklch(0.84 0.04 285)',   // Blizzard white
    card: 'oklch(0.1 0.07 285)',          // Blizzard card
    border: 'oklch(0.22 0.07 285)',       // Blizzard border
    muted: 'oklch(0.13 0.065 285)',       // Blizzard muted
    gradient: 'linear-gradient(135deg, oklch(0.08 0.08 290) 0%, oklch(0.06 0.07 280) 50%, oklch(0.09 0.09 320) 100%)',
    glowColor: 'oklch(0.5 0.15 320)',
    particleColor: 'rgba(255, 255, 255, 1)',
    atmosphereIntensity: 0.6,
    shimmer: true,
    pulseSpeed: 'fast'
  },
  ice_storm: {
    name: 'Ice Storm Night',
    emoji: '🧊',
    primary: 'oklch(0.52 0.14 200)',      // Night crystalline
    secondary: 'oklch(0.22 0.08 200)',    // Dark ice
    accent: 'oklch(0.72 0.15 180)',       // Frozen night cyan
    background: 'oklch(0.08 0.05 200)',   // Deep ice night
    foreground: 'oklch(0.88 0.03 200)',   // Ice white
    card: 'oklch(0.11 0.06 200)',         // Ice card
    border: 'oklch(0.23 0.06 200)',       // Ice border
    muted: 'oklch(0.14 0.055 200)',       // Ice muted
    gradient: 'linear-gradient(180deg, oklch(0.1 0.08 195) 0%, oklch(0.07 0.06 205) 100%)',
    glowColor: 'oklch(0.6 0.12 185)',
    particleColor: 'rgba(180, 235, 255, 0.7)',
    atmosphereIntensity: 0.5,
    shimmer: true,
    pulseSpeed: 'normal'
  },
  freezing_rain: {
    name: 'Freezing Rain Night',
    emoji: '🌧️',
    primary: 'oklch(0.5 0.1 220)',        // Cold rain night
    secondary: 'oklch(0.2 0.06 220)',     // Wet dark
    accent: 'oklch(0.58 0.12 195)',       // Night slick teal
    background: 'oklch(0.08 0.04 220)',   // Wet night
    foreground: 'oklch(0.85 0.03 220)',   // Light text
    card: 'oklch(0.11 0.05 220)',         // Wet night card
    border: 'oklch(0.22 0.05 220)',       // Wet border
    muted: 'oklch(0.14 0.045 220)',       // Rain muted
    gradient: 'linear-gradient(180deg, oklch(0.1 0.06 225) 0%, oklch(0.07 0.04 218) 100%)',
    glowColor: 'oklch(0.5 0.1 200)',
    particleColor: 'rgba(150, 180, 210, 0.5)',
    atmosphereIntensity: 0.4,
    shimmer: false,
    pulseSpeed: 'normal'
  },
  sleet: {
    name: 'Sleet Night',
    emoji: '🌨️',
    primary: 'oklch(0.52 0.12 235)',      // Mixed night
    secondary: 'oklch(0.22 0.06 235)',    // Dark sleet
    accent: 'oklch(0.65 0.12 190)',       // Night icy mix
    background: 'oklch(0.09 0.045 235)',  // Slushy night
    foreground: 'oklch(0.86 0.02 235)',   // Light text
    card: 'oklch(0.12 0.05 235)',         // Sleet card
    border: 'oklch(0.24 0.05 235)',       // Sleet border
    muted: 'oklch(0.15 0.045 235)',       // Sleet muted
    gradient: 'linear-gradient(180deg, oklch(0.1 0.06 240) 0%, oklch(0.08 0.045 230) 100%)',
    glowColor: 'oklch(0.55 0.1 195)',
    particleColor: 'rgba(200, 220, 240, 0.7)',
    atmosphereIntensity: 0.42,
    shimmer: false,
    pulseSpeed: 'normal'
  },
  whiteout: {
    name: 'Whiteout Night',
    emoji: '⬜',
    primary: 'oklch(0.45 0.1 270)',       // Night barely visible
    secondary: 'oklch(0.35 0.05 270)',    // Faded gray
    accent: 'oklch(0.55 0.08 270)',       // Muted night accent
    background: 'oklch(0.25 0.04 270)',   // Night near-white (bright for whiteout effect)
    foreground: 'oklch(0.7 0.03 270)',    // Faded night text
    card: 'oklch(0.3 0.035 270)',         // Night whiteout card
    border: 'oklch(0.38 0.04 270)',       // Faint night border
    muted: 'oklch(0.32 0.035 270)',       // Night muted
    gradient: 'linear-gradient(180deg, oklch(0.28 0.04 275) 0%, oklch(0.22 0.035 268) 100%)',
    glowColor: 'oklch(0.5 0.05 270)',
    particleColor: 'rgba(255, 255, 255, 0.95)',
    atmosphereIntensity: 0.75,
    shimmer: true,
    pulseSpeed: 'fast'
  },
  aurora: {
    name: 'Aurora Borealis',
    emoji: '🌌',
    primary: 'oklch(0.6 0.25 155)',       // Vibrant aurora green
    secondary: 'oklch(0.15 0.12 280)',    // Deep space purple
    accent: 'oklch(0.65 0.25 310)',       // Bright magenta aurora
    background: 'oklch(0.06 0.08 260)',   // Deep space
    foreground: 'oklch(0.9 0.03 180)',    // Aurora-lit text
    card: 'oklch(0.09 0.08 265)',         // Space card
    border: 'oklch(0.2 0.1 180)',         // Aurora border
    muted: 'oklch(0.12 0.08 260)',        // Space muted
    gradient: 'linear-gradient(135deg, oklch(0.08 0.12 150) 0%, oklch(0.06 0.1 260) 40%, oklch(0.08 0.12 310) 70%, oklch(0.07 0.1 280) 100%)',
    glowColor: 'oklch(0.65 0.25 155)',
    particleColor: 'rgba(100, 255, 180, 0.5)',
    atmosphereIntensity: 0.5,
    shimmer: true,
    pulseSpeed: 'slow'
  },
  polar_dawn: {
    name: 'Polar Midnight',
    emoji: '🌌',
    primary: 'oklch(0.64 0.18 25)',       // Midnight amber
    secondary: 'oklch(0.2 0.08 255)',     // Indigo shadow
    accent: 'oklch(0.75 0.18 340)',       // Aurora blush
    background: 'oklch(0.1 0.06 255)',    // Night snow
    foreground: 'oklch(0.9 0.03 245)',    // Moonlit text
    card: 'oklch(0.14 0.055 250)',        // Polar card
    border: 'oklch(0.24 0.06 250)',       // Frost line
    muted: 'oklch(0.18 0.05 250)',        // Soft haze
    gradient: 'linear-gradient(145deg, oklch(0.12 0.08 20) 0%, oklch(0.1 0.07 320) 45%, oklch(0.08 0.06 250) 100%)',
    glowColor: 'oklch(0.7 0.14 350)',
    particleColor: 'rgba(255, 210, 235, 0.55)',
    atmosphereIntensity: 0.38,
    shimmer: true,
    pulseSpeed: 'slow'
  },
  frosted_pine: {
    name: 'Evergreen Night',
    emoji: '🌲',
    primary: 'oklch(0.58 0.16 150)',      // Luminous pine
    secondary: 'oklch(0.18 0.06 150)',    // Forest shadow
    accent: 'oklch(0.74 0.16 50)',        // Firelight gold
    background: 'oklch(0.11 0.05 150)',   // Moonless grove
    foreground: 'oklch(0.9 0.03 140)',    // Frostbite text
    card: 'oklch(0.15 0.055 150)',        // Dark frost card
    border: 'oklch(0.26 0.06 150)',       // Pine outline
    muted: 'oklch(0.19 0.05 150)',        // Quiet needles
    gradient: 'linear-gradient(160deg, oklch(0.13 0.06 150) 0%, oklch(0.1 0.05 120) 40%, oklch(0.09 0.045 55) 100%)',
    glowColor: 'oklch(0.68 0.12 55)',
    particleColor: 'rgba(200, 230, 215, 0.65)',
    atmosphereIntensity: 0.42,
    shimmer: false,
    pulseSpeed: 'normal'
  },
  glacial_lagoon: {
    name: 'Midnight Fjord',
    emoji: '🧊',
    primary: 'oklch(0.6 0.18 220)',       // Arctic teal neon
    secondary: 'oklch(0.2 0.07 230)',     // Deep water
    accent: 'oklch(0.78 0.18 255)',       // Electric ice
    background: 'oklch(0.08 0.06 235)',   // Night fjord
    foreground: 'oklch(0.88 0.025 225)',  // Frost text
    card: 'oklch(0.12 0.06 235)',         // Glassy card
    border: 'oklch(0.24 0.065 235)',      // Waterline
    muted: 'oklch(0.17 0.055 235)',       // Mist muted
    gradient: 'linear-gradient(150deg, oklch(0.1 0.08 225) 0%, oklch(0.08 0.07 245) 45%, oklch(0.09 0.065 205) 100%)',
    glowColor: 'oklch(0.68 0.2 255)',
    particleColor: 'rgba(180, 225, 245, 0.7)',
    atmosphereIntensity: 0.5,
    shimmer: true,
    pulseSpeed: 'normal'
  },
  cabin_glow: {
    name: 'Hearthlight',
    emoji: '🏔️',
    primary: 'oklch(0.6 0.14 45)',        // Hearth amber
    secondary: 'oklch(0.22 0.05 80)',     // Night snowcap
    accent: 'oklch(0.74 0.16 60)',        // Candle glow
    background: 'oklch(0.12 0.06 40)',    // Cabin dusk
    foreground: 'oklch(0.9 0.03 70)',     // Warm text
    card: 'oklch(0.16 0.06 55)',          // Cozy card
    border: 'oklch(0.26 0.06 60)',        // Soft outline
    muted: 'oklch(0.2 0.05 60)',          // Muted haze
    gradient: 'linear-gradient(170deg, oklch(0.14 0.06 60) 0%, oklch(0.12 0.06 20) 45%, oklch(0.1 0.05 230) 100%)',
    glowColor: 'oklch(0.72 0.16 55)',
    particleColor: 'rgba(255, 205, 175, 0.55)',
    atmosphereIntensity: 0.44,
    shimmer: false,
    pulseSpeed: 'slow'
  },
  ice_palace: {
    name: 'Crystal Citadel',
    emoji: '🏰',
    primary: 'oklch(0.56 0.22 280)',      // Luminous violet ice
    secondary: 'oklch(0.22 0.08 280)',    // Shadowed frost
    accent: 'oklch(0.78 0.22 320)',       // Neon magenta
    background: 'oklch(0.07 0.08 285)',   // Midnight frost
    foreground: 'oklch(0.86 0.04 275)',   // Glimmer text
    card: 'oklch(0.12 0.075 285)',        // Crystal card
    border: 'oklch(0.23 0.075 285)',      // Facet edge
    muted: 'oklch(0.16 0.065 285)',       // Cold muted
    gradient: 'linear-gradient(135deg, oklch(0.08 0.1 285) 0%, oklch(0.07 0.1 305) 45%, oklch(0.09 0.08 250) 100%)',
    glowColor: 'oklch(0.74 0.22 320)',
    particleColor: 'rgba(210, 205, 255, 0.8)',
    atmosphereIntensity: 0.55,
    shimmer: true,
    pulseSpeed: 'fast'
  }
}

// Curated rotation of cozy/winter themes that work in light and dark mode
export const winterRotationThemes = [
  'polar_dawn',
  'frosted_pine',
  'glacial_lagoon',
  'cabin_glow',
  'ice_palace',
  'aurora',
  'snow_flurries'
] as const

export function getWeatherThemeFromConditions(snowfall: number, windSpeed: number, visibility: number, isDark: boolean = false): string {
  // Enhanced weather condition detection with more granular themes
  
  // Aurora is a special case - only appears in dark mode with very clear conditions
  if (isDark && snowfall < 0.1 && visibility > 8 && windSpeed < 5) {
    // Rare aurora conditions: clear, still, excellent visibility at night
    return 'aurora'
  }
  
  // Whiteout conditions: extreme low visibility regardless of snowfall
  if (visibility <= 0.1) {
    return 'whiteout'
  }
  
  // Blizzard: heavy snow + high winds OR extreme snowfall
  if (snowfall >= 6 || (snowfall >= 3 && windSpeed >= 25) || visibility <= 0.25) {
    return 'blizzard'
  }
  
  // Ice storm: moderate precipitation + freezing temps (simulated by specific combo)
  if (snowfall >= 0.5 && snowfall < 2 && windSpeed >= 15 && windSpeed < 25 && visibility <= 2) {
    return 'ice_storm'
  }
  
  // Freezing rain: light precipitation + moderate wind
  if (snowfall >= 0.2 && snowfall < 1 && windSpeed >= 10 && visibility <= 3) {
    return 'freezing_rain'
  }
  
  // Sleet: mixed precipitation conditions
  if (snowfall >= 0.5 && snowfall < 1.5 && windSpeed >= 8 && visibility <= 4) {
    return 'sleet'
  }
  
  // Heavy snow: significant accumulation
  if (snowfall >= 2 || (snowfall >= 1 && windSpeed >= 15) || visibility <= 1) {
    return 'heavy_snow'
  }
  
  // Snow flurries: light, gusty snow
  if (snowfall >= 0.3 && snowfall < 1 && windSpeed >= 5) {
    return 'snow_flurries'
  }
  
  // Light snow: minimal accumulation
  if (snowfall >= 0.5 || visibility <= 3) {
    return 'light_snow'
  }
  
  // Overcast: no snow, reduced visibility
  if (visibility <= 5 && snowfall < 0.2) {
    return 'overcast'
  }
  
  // Partly cloudy: slight visibility reduction
  if (visibility <= 7 && snowfall < 0.1) {
    return 'partly_cloudy'
  }
  
  // Default: clear conditions
  return 'clear'
}

interface WeatherThemeContextValue {
  currentTheme: string
  getCurrentTheme: () => WeatherTheme | undefined
  updateWeatherConditions: (snowfall: number, windSpeed: number, visibility: number) => void
  isDarkMode: boolean
  toggleDarkMode: () => void
  setManualTheme: (themeKey: string | null) => void
  manualThemeKey: string | null
  isRotationEnabled: boolean
  toggleRotation: () => void
  weatherConditions: { snowfall: number, windSpeed: number, visibility: number } | null
}

const WeatherThemeContext = createContext<WeatherThemeContextValue | null>(null)

function useProvideWeatherTheme(): WeatherThemeContextValue {
  const [weatherConditions, setWeatherConditions] = useSafeKV<{snowfall: number, windSpeed: number, visibility: number} | null>('weather-conditions', null)
  const [isDarkMode, setIsDarkMode] = useSafeKV<boolean>('dark-mode', false)
  const [autoTheme, setAutoTheme] = useState<string>('clear')
  const [manualThemeKey, setManualThemeKey] = useSafeKV<string | null>('manual-weather-theme', null)
  const [isRotationEnabled, setRotationEnabled] = useSafeKV<boolean>('weather-theme-rotation', false)

  useEffect(() => {
    if (weatherConditions) {
      const themeKey = getWeatherThemeFromConditions(
        weatherConditions.snowfall,
        weatherConditions.windSpeed, 
        weatherConditions.visibility,
        isDarkMode
      )
      setAutoTheme(themeKey)
    }
  }, [weatherConditions, isDarkMode])

  const updateWeatherConditions = (snowfall: number, windSpeed: number, visibility: number) => {
    setWeatherConditions({ snowfall, windSpeed, visibility })
  }

  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev)
  }

  const setManualTheme = (themeKey: string | null) => {
    setRotationEnabled(false)
    setManualThemeKey(themeKey)
  }

  const toggleRotation = () => {
    setRotationEnabled(prev => {
      const next = !prev
      if (!next) {
        setManualThemeKey(null)
      }
      return next
    })
  }

  // Automatically cycle through curated winter themes when enabled
  useEffect(() => {
    if (!isRotationEnabled) return

    const sequence = winterRotationThemes.map(String)
    if (!sequence.length) return

    let index = manualThemeKey ? sequence.indexOf(manualThemeKey) : Math.floor(Math.random() * sequence.length)
    if (index < 0) index = 0

    const advanceTheme = () => {
      const nextTheme = sequence[index % sequence.length]
      setManualThemeKey(nextTheme)
      index = (index + 1) % sequence.length
    }

    advanceTheme()
    const interval = window.setInterval(advanceTheme, 16000)
    return () => window.clearInterval(interval)
  }, [isRotationEnabled, manualThemeKey, setManualThemeKey])

  const activeTheme = manualThemeKey ?? autoTheme

  const applyTheme = (themeKey: string) => {
    const themes = isDarkMode ? darkWeatherThemes : weatherThemes
    const selectedTheme = themes[themeKey]
    const theme = selectedTheme
      ? isDarkMode
        ? applyDarkContrastSafety(selectedTheme)
        : selectedTheme
      : undefined
    
    if (theme) {
      const root = document.documentElement
      
      // Core color variables
      root.style.setProperty('--primary', theme.primary)
      root.style.setProperty('--secondary', theme.secondary)
      root.style.setProperty('--accent', theme.accent)
      root.style.setProperty('--background', theme.background)
      root.style.setProperty('--foreground', theme.foreground)
      root.style.setProperty('--card', theme.card)
      root.style.setProperty('--border', theme.border)
      root.style.setProperty('--muted', theme.muted)
      
      // Enhanced atmospheric variables
      root.style.setProperty('--weather-gradient', theme.gradient || 'none')
      root.style.setProperty('--weather-glow', theme.glowColor || 'transparent')
      root.style.setProperty('--weather-particle-color', theme.particleColor || 'rgba(255,255,255,0.5)')
      root.style.setProperty('--weather-atmosphere-intensity', String(theme.atmosphereIntensity || 0))
      root.style.setProperty('--weather-shimmer', theme.shimmer ? '1' : '0')
      
      // Pulse animation speed
      const pulseSpeed = theme.pulseSpeed === 'fast' ? '1.5s' : theme.pulseSpeed === 'slow' ? '4s' : '2.5s'
      root.style.setProperty('--weather-pulse-speed', pulseSpeed)
      
      // Theme name for CSS targeting
      root.setAttribute('data-weather-theme', themeKey)
      
      // Update class for dark mode detection
      if (isDarkMode) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }
  }

  // Apply theme whenever it changes
  useEffect(() => {
    applyTheme(activeTheme)
  }, [activeTheme, isDarkMode])

  const getCurrentTheme = () => {
    const themes = isDarkMode ? darkWeatherThemes : weatherThemes
    return themes[activeTheme]
  }

  return {
    currentTheme: activeTheme,
    getCurrentTheme,
    updateWeatherConditions,
    isDarkMode,
    toggleDarkMode,
    setManualTheme,
    manualThemeKey,
    isRotationEnabled,
    toggleRotation,
    weatherConditions
  }
}

export function WeatherThemeProvider({ children }: { children: ReactNode }) {
  const value = useProvideWeatherTheme()
  return createElement(WeatherThemeContext.Provider, { value }, children)
}

export function useWeatherTheme() {
  const context = useContext(WeatherThemeContext)
  if (!context) {
    throw new Error('useWeatherTheme must be used within a WeatherThemeProvider')
  }
  return context
}
