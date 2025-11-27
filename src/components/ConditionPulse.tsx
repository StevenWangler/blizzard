import { type ComponentType, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Brain, CloudSnow, Eye, Wind, Warning } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { WeatherService } from '@/services/weather'

interface PredictionPulseData {
  final?: {
    snow_day_probability?: number
    confidence_level?: string
    primary_factors?: string[]
  }
  meteorology?: {
    precipitation_analysis?: {
      total_snowfall_inches?: number
      precipitation_type?: string
    }
    wind_analysis?: {
      max_wind_speed_mph?: number
    }
    visibility_analysis?: {
      minimum_visibility_miles?: number
    }
    overall_conditions_summary?: string
  }
}

interface PulseItem {
  label: string
  value: string
  hint?: string
  icon: ComponentType<{ size?: number }>
}

export function ConditionPulse() {
  const [pulseItems, setPulseItems] = useState<PulseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadPulse()
  }, [])

  const loadPulse = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/data/prediction.json')
      if (!response.ok) throw new Error('AI prediction not available')

      const data: PredictionPulseData = await response.json()
      setPulseItems(buildItemsFromPrediction(data))
    } catch (predictionError) {
      try {
        const fallback = await WeatherService.getCurrentForecast()
        setPulseItems(buildItemsFromWeatherService(fallback))
      } catch (weatherError) {
        console.error('Condition pulse failed', predictionError, weatherError)
        setError('Live condition pulse unavailable')
      }
    } finally {
      setLoading(false)
    }
  }

  const buildItemsFromPrediction = (data: PredictionPulseData): PulseItem[] => {
    const probability = data.final?.snow_day_probability ?? null
    const primaryFactor = data.final?.primary_factors?.[0]
    const snowfall = data.meteorology?.precipitation_analysis?.total_snowfall_inches ?? null
    const wind = data.meteorology?.wind_analysis?.max_wind_speed_mph ?? null
    const visibility = data.meteorology?.visibility_analysis?.minimum_visibility_miles ?? null

    const items: PulseItem[] = []

    if (probability !== null) {
      items.push({
        label: 'AI Probability',
        value: `${probability}%`,
        hint: primaryFactor || 'Live agent consensus',
        icon: Brain
      })
    }

    if (snowfall !== null) {
      items.push({
        label: 'Projected Snow',
        value: `${snowfall}"`,
        hint: data.meteorology?.precipitation_analysis?.precipitation_type === 'none'
          ? 'No accumulation expected'
          : `Forecast favors ${data.meteorology?.precipitation_analysis?.precipitation_type}`,
        icon: CloudSnow
      })
    }

    if (wind !== null) {
      items.push({
        label: 'Wind Gusts',
        value: `${Math.round(wind)} mph`,
        hint: wind >= 25 ? 'Blowing snow risk' : 'Light to moderate gusts',
        icon: Wind
      })
    }

    if (visibility !== null) {
      items.push({
        label: 'Visibility Floor',
        value: `${visibility} mi`,
        hint: visibility <= 1 ? 'Expect whiteout pockets' : 'Mostly clear sightlines',
        icon: Eye
      })
    }

    return items.slice(0, 4)
  }

  const buildItemsFromWeatherService = (data: {
    temperature: number
    snowfall: number
    windSpeed: number
    visibility: number
    modelProbability: number
    alerts: string[]
  }): PulseItem[] => {
    return [
      {
        label: 'Model Probability',
        value: `${data.modelProbability}%`,
        hint: 'Weather API blend',
        icon: Brain
      },
      {
        label: 'Snowfall',
        value: `${data.snowfall}"`,
        hint: data.snowfall === 0 ? 'No accumulation expected' : 'Totals by dawn',
        icon: CloudSnow
      },
      {
        label: 'Wind Peak',
        value: `${data.windSpeed} mph`,
        hint: data.windSpeed >= 25 ? 'Secure loose items' : 'Breezy at most',
        icon: Wind
      },
      {
        label: 'Visibility',
        value: `${data.visibility} mi`,
        hint: data.visibility <= 1 ? 'Plan for low vis' : 'Clear travel window',
        icon: Eye
      }
    ]
  }

  return (
    <section className="mb-8">
      <div className="rounded-2xl border border-primary/10 bg-background/80 px-5 sm:px-6 py-5 sm:py-6 shadow-lg shadow-primary/5 backdrop-blur">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-primary font-semibold">Condition Pulse</p>
            <p className="text-sm text-muted-foreground">Live signals from today's model run</p>
          </div>
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/30">
            Live
          </Badge>
        </div>

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-xl border border-border/50 p-4 animate-pulse">
                <div className="h-3 w-20 bg-muted rounded mb-2" />
                <div className="h-5 w-16 bg-muted rounded" />
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Warning size={16} className="text-destructive" />
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {pulseItems.map((item, index) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="rounded-xl border border-border/60 bg-card/80 p-4 shadow-sm"
              >
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <item.icon size={16} />
                  {item.label}
                </div>
                <p className="text-xl font-semibold mt-1.5">
                  {item.value}
                </p>
                {item.hint && (
                  <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                    {item.hint}
                  </p>
                )}
              </motion.div>
            ))}

            {pulseItems.length === 0 && (
              <div className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground col-span-full">
                Waiting for the next agent sync.
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
