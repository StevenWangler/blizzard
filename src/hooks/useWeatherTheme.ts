import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react'
import { useKV } from '@github/spark/hooks'

export interface WeatherTheme {
  name: string
  primary: string
  secondary: string
  accent: string
  background: string
  foreground: string
  card: string
  border: string
  muted: string
}

export const weatherThemes: Record<string, WeatherTheme> = {
  clear: {
    name: 'Clear Skies',
    primary: 'oklch(0.5 0.15 220)',      // Clear blue
    secondary: 'oklch(0.9 0.05 220)',    // Light blue-gray
    accent: 'oklch(0.7 0.15 60)',        // Sunny yellow
    background: 'oklch(0.98 0.02 220)',  // Very light blue-white
    foreground: 'oklch(0.2 0.08 220)',   // Dark blue-gray
    card: 'oklch(1 0 0)',                // Pure white
    border: 'oklch(0.88 0.03 220)',      // Light blue-gray border
    muted: 'oklch(0.92 0.03 220)'        // Muted blue-gray
  },
  light_snow: {
    name: 'Light Snow',
    primary: 'oklch(0.45 0.12 240)',     // Soft winter blue
    secondary: 'oklch(0.88 0.04 240)',   // Light snow gray
    accent: 'oklch(0.75 0.1 180)',       // Icy cyan
    background: 'oklch(0.97 0.02 240)',  // Snow white with blue hint
    foreground: 'oklch(0.25 0.08 240)',  // Dark winter blue
    card: 'oklch(0.99 0.01 240)',        // Snow white
    border: 'oklch(0.85 0.04 240)',      // Soft gray border
    muted: 'oklch(0.9 0.03 240)'         // Light winter gray
  },
  heavy_snow: {
    name: 'Heavy Snow',
    primary: 'oklch(0.4 0.15 260)',      // Deep winter blue
    secondary: 'oklch(0.82 0.06 260)',   // Storm gray
    accent: 'oklch(0.7 0.12 200)',       // Ice blue
    background: 'oklch(0.95 0.03 260)',  // Storm-tinted white
    foreground: 'oklch(0.2 0.1 260)',    // Dark storm blue
    card: 'oklch(0.98 0.02 260)',        // Cold white
    border: 'oklch(0.8 0.05 260)',       // Storm border
    muted: 'oklch(0.87 0.04 260)'        // Storm gray
  },
  blizzard: {
    name: 'Blizzard',
    primary: 'oklch(0.35 0.18 280)',     // Intense storm blue
    secondary: 'oklch(0.75 0.08 280)',   // Heavy storm gray
    accent: 'oklch(0.6 0.15 320)',       // Fierce purple-blue
    background: 'oklch(0.92 0.04 280)',  // Storm-darkened white
    foreground: 'oklch(0.15 0.12 280)',  // Very dark storm
    card: 'oklch(0.96 0.03 280)',        // Blizzard white
    border: 'oklch(0.75 0.06 280)',      // Strong storm border
    muted: 'oklch(0.82 0.05 280)'        // Blizzard gray
  }
}

// Dark mode variants for each weather theme
export const darkWeatherThemes: Record<string, WeatherTheme> = {
  clear: {
    name: 'Clear Night',
    primary: 'oklch(0.6 0.15 220)',      // Bright night blue
    secondary: 'oklch(0.2 0.05 220)',    // Dark night blue
    accent: 'oklch(0.8 0.15 60)',        // Moonlight yellow
    background: 'oklch(0.12 0.05 220)',  // Deep night blue
    foreground: 'oklch(0.9 0.02 220)',   // Light blue-white
    card: 'oklch(0.15 0.05 220)',        // Night card
    border: 'oklch(0.25 0.05 220)',      // Night border
    muted: 'oklch(0.18 0.05 220)'        // Night muted
  },
  light_snow: {
    name: 'Snowy Night',
    primary: 'oklch(0.55 0.12 240)',     // Snowy night blue
    secondary: 'oklch(0.22 0.04 240)',   // Dark snow gray
    accent: 'oklch(0.75 0.1 180)',       // Icy night cyan
    background: 'oklch(0.14 0.04 240)',  // Snowy night
    foreground: 'oklch(0.88 0.02 240)',  // Snow white text
    card: 'oklch(0.17 0.04 240)',        // Snowy night card
    border: 'oklch(0.27 0.04 240)',      // Snowy border
    muted: 'oklch(0.2 0.04 240)'         // Snowy muted
  },
  heavy_snow: {
    name: 'Storm Night',
    primary: 'oklch(0.5 0.15 260)',      // Storm night blue
    secondary: 'oklch(0.25 0.06 260)',   // Dark storm
    accent: 'oklch(0.7 0.12 200)',       // Storm ice blue
    background: 'oklch(0.1 0.05 260)',   // Deep storm night
    foreground: 'oklch(0.85 0.03 260)',  // Storm white
    card: 'oklch(0.13 0.05 260)',        // Storm card
    border: 'oklch(0.23 0.05 260)',      // Storm border
    muted: 'oklch(0.16 0.05 260)'        // Storm muted
  },
  blizzard: {
    name: 'Blizzard Night',
    primary: 'oklch(0.45 0.18 280)',     // Fierce night storm
    secondary: 'oklch(0.28 0.08 280)',   // Dark blizzard
    accent: 'oklch(0.65 0.15 320)',      // Fierce night purple
    background: 'oklch(0.08 0.06 280)',  // Deep blizzard night
    foreground: 'oklch(0.82 0.04 280)',  // Blizzard white
    card: 'oklch(0.11 0.06 280)',        // Blizzard card
    border: 'oklch(0.21 0.06 280)',      // Blizzard border
    muted: 'oklch(0.14 0.06 280)'        // Blizzard muted
  }
}

export function getWeatherThemeFromConditions(snowfall: number, windSpeed: number, visibility: number, isDark: boolean = false): string {
  // Determine weather condition based on parameters
  if (snowfall >= 6 || (snowfall >= 3 && windSpeed >= 25) || visibility <= 0.25) {
    return isDark ? 'blizzard' : 'blizzard'
  } else if (snowfall >= 2 || (snowfall >= 1 && windSpeed >= 15) || visibility <= 1) {
    return isDark ? 'heavy_snow' : 'heavy_snow'
  } else if (snowfall >= 0.5 || visibility <= 3) {
    return isDark ? 'light_snow' : 'light_snow'
  } else {
    return isDark ? 'clear' : 'clear'
  }
}

interface WeatherThemeContextValue {
  currentTheme: string
  getCurrentTheme: () => WeatherTheme | undefined
  updateWeatherConditions: (snowfall: number, windSpeed: number, visibility: number) => void
  isDarkMode: boolean
  toggleDarkMode: () => void
  weatherConditions: { snowfall: number, windSpeed: number, visibility: number } | null
}

const WeatherThemeContext = createContext<WeatherThemeContextValue | null>(null)

function useProvideWeatherTheme(): WeatherThemeContextValue {
  const [weatherConditions, setWeatherConditions] = useKV<{snowfall: number, windSpeed: number, visibility: number} | null>('weather-conditions', null)
  const [isDarkMode, setIsDarkMode] = useKV<boolean>('dark-mode', false)
  const [currentTheme, setCurrentTheme] = useState<string>('clear')

  useEffect(() => {
    if (weatherConditions) {
      const themeKey = getWeatherThemeFromConditions(
        weatherConditions.snowfall,
        weatherConditions.windSpeed, 
        weatherConditions.visibility,
        isDarkMode
      )
      setCurrentTheme(themeKey)
    }
  }, [weatherConditions, isDarkMode])

  const updateWeatherConditions = (snowfall: number, windSpeed: number, visibility: number) => {
    setWeatherConditions({ snowfall, windSpeed, visibility })
  }

  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev)
  }

  const applyTheme = (themeKey: string) => {
    const themes = isDarkMode ? darkWeatherThemes : weatherThemes
    const theme = themes[themeKey]
    
    if (theme) {
      const root = document.documentElement
      root.style.setProperty('--primary', theme.primary)
      root.style.setProperty('--secondary', theme.secondary)
      root.style.setProperty('--accent', theme.accent)
      root.style.setProperty('--background', theme.background)
      root.style.setProperty('--foreground', theme.foreground)
      root.style.setProperty('--card', theme.card)
      root.style.setProperty('--border', theme.border)
      root.style.setProperty('--muted', theme.muted)
      
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
    applyTheme(currentTheme)
  }, [currentTheme, isDarkMode])

  const getCurrentTheme = () => {
    const themes = isDarkMode ? darkWeatherThemes : weatherThemes
    return themes[currentTheme]
  }

  return {
    currentTheme,
    getCurrentTheme,
    updateWeatherConditions,
    isDarkMode,
    toggleDarkMode,
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