import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HeroProbabilityDisplay } from '@/components/HeroProbabilityDisplay'
import { SnowfallCanvas } from '@/components/SnowfallCanvas'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  ArrowRight, 
  Snowflake, 
  Calendar,
  Clock,
  Brain,
  Warning
} from '@phosphor-icons/react'
import { fetchData } from '@/lib/dataPath'
import { useWeatherTheme } from '@/hooks/useWeatherTheme'
import { useNotifications } from '@/hooks/useNotifications'
import { normalizeProbability } from '@/services/outcomes'
import type { AgentPrediction } from '@/types/agentPrediction'

interface HeroViewProps {
  onNavigateToDetails: () => void
}

// GitHub Actions schedule: 9 AM, 1 PM, 6 PM EST
const REFRESH_TIMES_UTC = [14, 18, 23]

function getNextRefreshTime(): Date {
  const now = new Date()
  const currentUTCHour = now.getUTCHours()
  const currentUTCMinutes = now.getUTCMinutes()
  
  for (const hour of REFRESH_TIMES_UTC) {
    if (currentUTCHour < hour || (currentUTCHour === hour && currentUTCMinutes === 0)) {
      const next = new Date(now)
      next.setUTCHours(hour, 0, 0, 0)
      return next
    }
  }
  
  const tomorrow = new Date(now)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  tomorrow.setUTCHours(REFRESH_TIMES_UTC[0], 0, 0, 0)
  return tomorrow
}

function formatTimeUntil(targetDate: Date): string {
  const now = new Date()
  const diffMs = targetDate.getTime() - now.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMins / 60)
  const remainingMins = diffMins % 60
  
  if (diffHours > 0) {
    return `${diffHours}h ${remainingMins}m`
  }
  return `${remainingMins}m`
}

export function HeroView({ onNavigateToDetails }: HeroViewProps) {
  const [prediction, setPrediction] = useState<AgentPrediction | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nextRefresh, setNextRefresh] = useState('')
  
  const { updateWeatherConditions, getCurrentTheme, isDarkMode } = useWeatherTheme()
  const { checkAndNotify } = useNotifications()

  useEffect(() => {
    loadPrediction()
  }, [])

  useEffect(() => {
    const updateRefresh = () => {
      setNextRefresh(formatTimeUntil(getNextRefreshTime()))
    }
    
    updateRefresh()
    const interval = setInterval(updateRefresh, 60000)
    return () => clearInterval(interval)
  }, [])

  const loadPrediction = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const data = await fetchData<AgentPrediction>('prediction.json')
      setPrediction(data)
      
      // Update weather theme
      if (data.meteorology) {
        updateWeatherConditions(
          data.meteorology.precipitation_analysis.total_snowfall_inches,
          data.meteorology.wind_analysis.max_wind_speed_mph,
          data.meteorology.visibility_analysis.minimum_visibility_miles
        )
      }
      
      // Check notifications
      if (data.final?.snow_day_probability) {
        checkAndNotify(data.final.snow_day_probability, data.location)
      }
    } catch (err) {
      console.error('Failed to load prediction:', err)
      setError('Unable to load prediction data')
    } finally {
      setLoading(false)
    }
  }

  const rawProbability = prediction?.final?.snow_day_probability ?? 0
  const probability = normalizeProbability(rawProbability)
  
  const getVerdict = (prob: number) => {
    // Use explicit colors with good contrast in both light and dark modes
    // These colors are hardcoded to ensure visibility on any theme background
    if (prob >= 70) return { 
      text: 'SNOW DAY LIKELY!', 
      color: 'bg-cyan-500', 
      lightColor: '#0e7490', // cyan-700
      darkColor: '#67e8f9'   // cyan-300
    }
    if (prob >= 50) return { 
      text: 'Looking Possible', 
      color: 'bg-indigo-500', 
      lightColor: '#4338ca', // indigo-700
      darkColor: '#a5b4fc'   // indigo-300
    }
    if (prob >= 30) return { 
      text: 'Maybe...', 
      color: 'bg-blue-500', 
      lightColor: '#1d4ed8', // blue-700
      darkColor: '#93c5fd'   // blue-300
    }
    return { 
      text: 'Probably Not', 
      color: 'bg-slate-500', 
      lightColor: '#1e293b', // slate-800
      darkColor: '#cbd5e1'   // slate-300
    }
  }
  
  const verdict = getVerdict(probability)
  
  // Calculate snowfall intensity for reactive effects
  const snowfallIntensity = prediction?.meteorology?.precipitation_analysis?.total_snowfall_inches ?? 0
  const windSpeed = prediction?.meteorology?.wind_analysis?.max_wind_speed_mph ?? 0
  
  // Determine snow theme based on probability for hero effect
  const getSnowTheme = () => {
    if (probability >= 80) return 'blizzard'
    if (probability >= 60) return 'heavy_snow'
    if (probability >= 40) return 'snow_flurries'
    return 'light_snow'
  }

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <Snowflake size={48} className="text-primary" weight="duotone" />
          </motion.div>
          <p className="text-muted-foreground flex items-center gap-2">
            <Brain size={20} />
            AI agents analyzing conditions...
          </p>
        </motion.div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
        <Warning size={48} className="text-muted-foreground" />
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={loadPrediction} variant="outline">
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className="relative min-h-[75vh] flex flex-col items-center justify-center px-4">
      {/* Subtle backdrop that works in both light and dark modes */}
      <div 
        className="absolute inset-0 pointer-events-none dark:bg-black/20"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 30%, var(--color-bg) 100%)',
        }}
      />
      
      {/* Probability-reactive snowfall overlay */}
      <SnowfallCanvas 
        intensity={Math.max(snowfallIntensity, probability / 10)} 
        windSpeed={windSpeed}
        theme={getSnowTheme()}
        respectReducedMotion={true}
      />
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 flex flex-col items-center text-center w-full max-w-4xl"
      >
        {/* Target date badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mb-2 sm:mb-4"
        >
          <Badge 
            variant="outline" 
            className="px-4 py-2 text-sm backdrop-blur-md bg-background/50 dark:bg-black/30 border-border dark:border-white/20"
          >
            <Calendar size={14} className="mr-2" />
            {prediction?.targetDayName 
              ? `${prediction.targetDayName}'s Forecast`
              : "Tomorrow's Forecast"}
            {prediction?.targetDate && (
              <span className="ml-2 opacity-70">
                • {new Date(prediction.targetDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </Badge>
        </motion.div>

        {/* AI Orb probability display */}
        <div className="relative w-full max-w-[400px] sm:max-w-[450px] md:max-w-[500px] mx-auto py-4">
          <HeroProbabilityDisplay value={probability} duration={2.5} />
        </div>

        {/* Verdict */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="mt-2 mb-6"
        >
          <motion.h2 
            className="text-2xl sm:text-3xl md:text-4xl font-bold drop-shadow-lg"
            style={{ color: isDarkMode ? verdict.darkColor : verdict.lightColor }}
            animate={probability >= 70 ? {
              textShadow: [
                '0 0 10px currentColor',
                '0 0 20px currentColor',
                '0 0 10px currentColor',
              ]
            } : {}}
            transition={probability >= 70 ? {
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut'
            } : {}}
          >
            {verdict.text}
          </motion.h2>
        </motion.div>

        {/* Location & confidence */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-3 mb-8"
        >
          <span className="text-sm text-muted-foreground">
            {prediction?.location ?? 'Rockford, MI'}
          </span>
          {prediction?.final?.confidence_level && (
            <>
              <span className="text-muted-foreground/50">•</span>
              <Badge variant="secondary" className="text-xs">
                {prediction.final.confidence_level.replace('_', ' ')} confidence
              </Badge>
            </>
          )}
        </motion.div>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.5 }}
        >
          <Button
            size="lg"
            onClick={onNavigateToDetails}
            className="group px-8 py-6 text-lg font-semibold rounded-full bg-primary/90 hover:bg-primary dark:bg-white/10 dark:hover:bg-white/20 backdrop-blur-md border border-primary/20 dark:border-white/20 text-primary-foreground dark:text-white shadow-lg shadow-primary/20 dark:shadow-black/20 hover:shadow-xl transition-all duration-300"
          >
            See Why
            <ArrowRight 
              size={20} 
              className="ml-2 transition-transform group-hover:translate-x-1" 
            />
          </Button>
        </motion.div>

        {/* Next update indicator */}
        {nextRefresh && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 0.5 }}
            className="mt-8 text-xs text-muted-foreground/60 flex items-center gap-1.5"
          >
            <Clock size={12} />
            Next update in {nextRefresh}
          </motion.p>
        )}
      </motion.div>

      {/* Subtle scroll hint for mobile */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        transition={{ delay: 2, duration: 1 }}
        className="absolute bottom-4 left-1/2 -translate-x-1/2 sm:hidden"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="text-muted-foreground/50 text-xs flex flex-col items-center gap-1"
        >
          <span>Swipe up for details</span>
          <span className="text-lg">↓</span>
        </motion.div>
      </motion.div>
    </div>
  )
}
