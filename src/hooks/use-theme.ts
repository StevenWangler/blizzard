import { useEffect, useState, useCallback } from 'react'

export type Theme = 'light' | 'dark' | 'system'

// Safe wrapper for useKV that falls back to localStorage when Spark KV is unavailable
function useSafeKV<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(`spark_kv_${key}`)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch {
      // Ignore localStorage errors
    }
    return defaultValue
  })

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

export function useTheme() {
  const [theme, setTheme] = useSafeKV<Theme>('theme-preference', 'dark')

  useEffect(() => {
    const root = window.document.documentElement
    
    // Remove existing theme classes
    root.classList.remove('light', 'dark')
    
    let resolvedTheme: 'light' | 'dark'
    
    if (theme === 'system') {
      // Check system preference
      resolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    } else {
      // Default to dark if theme is null/undefined
      resolvedTheme = theme || 'dark'
    }
    
    root.classList.add(resolvedTheme)
    
    // Listen for system theme changes when in system mode
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (theme === 'system') {
        root.classList.remove('light', 'dark')
        root.classList.add(mediaQuery.matches ? 'dark' : 'light')
      }
    }
    
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  return {
    theme: theme || 'dark',
    setTheme,
  }
}