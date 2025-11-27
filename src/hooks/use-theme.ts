import { useKV } from '@github/spark/hooks'
import { useEffect } from 'react'

export type Theme = 'light' | 'dark' | 'system'

export function useTheme() {
  const [theme, setTheme] = useKV<Theme>('theme-preference', 'dark')

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