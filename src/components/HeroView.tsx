import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { 
  Snowflake, 
  Warning
} from '@phosphor-icons/react'
import { useWeatherTheme } from '@/hooks/useWeatherTheme'
import { useNotifications } from '@/hooks/useNotifications'
import type { SavedForecast } from '@/hooks/useSavedForecast'
import { forecastFreshness } from '@/lib/forecastPresentation'
import { TodayForecast } from '@/components/TodayForecast'

interface HeroViewProps {
  onNavigateToDetails: () => void
  children?: ReactNode
  onNavigateToHistory: () => void
  forecast: SavedForecast
}

export function HeroView({ onNavigateToDetails, onNavigateToHistory, forecast, children }: HeroViewProps) {
  const reduceMotion = useReducedMotion()
  const { prediction, loading, error, reload } = forecast
  
  const { updateWeatherConditions } = useWeatherTheme()
  const { checkAndNotify } = useNotifications()
  const processed = useRef<typeof prediction>(null)

  useEffect(() => {
      const data = prediction
      if (!data || processed.current === data) return
      processed.current = data
      // Update weather theme
      if (data.meteorology?.precipitation_analysis && data.meteorology.wind_analysis && data.meteorology.visibility_analysis) {
        updateWeatherConditions(
          data.meteorology.precipitation_analysis.total_snowfall_inches,
          data.meteorology.wind_analysis.max_wind_speed_mph,
          data.meteorology.visibility_analysis.minimum_visibility_miles
        )
      }
      
      // Check notifications
      if (data.final?.snow_day_probability && forecastFreshness(data.timestamp, data.targetDate) === 'current') {
        checkAndNotify(data.final.snow_day_probability, data.location)
      }
  }, [prediction, updateWeatherConditions, checkAndNotify])

  if (loading) {
    return (
      <div className="forecast-status min-h-[56vh] sm:min-h-[70vh] flex flex-col items-center justify-center">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <motion.div
            animate={{ rotate: reduceMotion ? 0 : 360 }}
            transition={{ duration: reduceMotion ? 0 : 2, repeat: reduceMotion ? 0 : Infinity, ease: 'linear' }}
          >
            <Snowflake size={48} className="text-primary" weight="duotone" />
          </motion.div>
          <p className="text-muted-foreground">Loading the forecast…</p>
        </motion.div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="forecast-status min-h-[56vh] sm:min-h-[70vh] flex flex-col items-center justify-center gap-4">
        <Warning size={48} className="text-muted-foreground" />
        <p className="text-muted-foreground">{error}</p>
        <p className="max-w-xs text-center text-sm leading-6 text-muted-foreground">Check Rockford Public Schools for current school status.</p>
        <Button onClick={reload} variant="outline" className="min-h-11 px-5">
          Try Again
        </Button>
      </div>
    )
  }

  return <TodayForecast prediction={prediction} onNavigateToDetails={onNavigateToDetails} onNavigateToHistory={onNavigateToHistory}>{children}</TodayForecast>
}
