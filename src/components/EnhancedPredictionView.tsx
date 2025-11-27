import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SnowfallCanvas } from '@/components/SnowfallCanvas'
import { AnimatedProbability } from '@/components/AnimatedProbability'
import { NarrativeSummary } from '@/components/NarrativeSummary'
import { ConditionPulse } from '@/components/ConditionPulse'
import { 
  CloudSnow, 
  Thermometer, 
  Wind, 
  Eye, 
  Warning, 
  Clock,
  Users,
  Brain,
  TrendUp,
  ShieldCheck,
  ChartBar,
  Sparkle,
  Info,
  ArrowUpRight,
  ArrowDownRight
} from '@phosphor-icons/react'
import { WeatherService } from '@/services/weather'
import { useWeatherTheme } from '@/hooks/useWeatherTheme'
import { WeatherThemeIndicator } from '@/components/WeatherThemeIndicator'
import { useNotifications } from '@/hooks/useNotifications'
import { toast } from 'sonner'
import { buildOutcomeStats, fetchOutcomeLedger } from '@/services/outcomes'
import { fetchData } from '@/lib/dataPath'
import type { OutcomeStats, SnowDayOutcome } from '@/services/outcomes'
import type { AgentPrediction } from '@/types/agentPrediction'


// Fallback weather data interface for compatibility
interface WeatherData {
  temperature: number
  snowfall: number
  windSpeed: number
  visibility: number
  alerts: string[]
  modelProbability: number
  lastUpdated: string
}

const STALE_THRESHOLD_MS = 3 * 60 * 60 * 1000 // three hours

export function EnhancedPredictionView() {
  const [prediction, setPrediction] = useState<AgentPrediction | null>(null)
  const [fallbackWeather, setFallbackWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [outcomeStats, setOutcomeStats] = useState<OutcomeStats | null>(null)
  const [recentAverage, setRecentAverage] = useState<number | null>(null)
  const [trendError, setTrendError] = useState<string | null>(null)
  const [trendLoading, setTrendLoading] = useState(true)
  const [lastUpdateMeta, setLastUpdateMeta] = useState<{ formatted: string; stale: boolean }>({
    formatted: '',
    stale: false
  })
  
  const { updateWeatherConditions, getCurrentTheme } = useWeatherTheme()
  const { checkAndNotify } = useNotifications()

  useEffect(() => {
    loadPredictionData()
  }, [])

  useEffect(() => {
    loadOutcomeInsights()
  }, [prediction]) // Reload insights when prediction changes

  const loadPredictionData = async () => {
    try {
      setLoading(true)
      
      // Try to load AI agent prediction first
      try {
        const data = await fetchData<AgentPrediction>('prediction.json')
        setPrediction(data)
          
        // Update weather theme based on agent analysis
        if (data.meteorology) {
          updateWeatherConditions(
            data.meteorology.precipitation_analysis.total_snowfall_inches,
            data.meteorology.wind_analysis.max_wind_speed_mph,
            data.meteorology.visibility_analysis.minimum_visibility_miles
          )
        }
        
        // Check if we should send notification
        if (data.final?.snow_day_probability) {
          checkAndNotify(data.final.snow_day_probability, data.location)
        }
        
        return
      } catch (error) {
        console.log('Agent prediction not available, falling back to legacy weather service')
      }
      
      // Fallback to legacy weather service
      const data = await WeatherService.getCurrentForecast()
      setFallbackWeather(data)
      updateWeatherConditions(data.snowfall, data.windSpeed, data.visibility)
      
      // Check if we should send notification
      if (data.modelProbability) {
        checkAndNotify(data.modelProbability)
      }
      
    } catch (error) {
      toast.error('Failed to load prediction data')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const loadOutcomeInsights = async () => {
    try {
      setTrendLoading(true)
      setTrendError(null)
      const ledger: SnowDayOutcome[] = await fetchOutcomeLedger()
      if (ledger.length) {
        setOutcomeStats(buildOutcomeStats(ledger))
        const recent = ledger
          .filter(entry => typeof entry.modelProbability === 'number')
          .slice(-7)

        if (recent.length) {
          const avg = Math.round(
            recent.reduce((sum, entry) => sum + (entry.modelProbability || 0), 0) / recent.length
          )
          setRecentAverage(avg)
        } else {
          setRecentAverage(null)
        }
      } else {
        setOutcomeStats(null)
        setRecentAverage(null)
      }
    } catch (error) {
      console.error('Failed to load outcome ledger', error)
      setTrendError('Historical trend temporarily unavailable')
    } finally {
      setTrendLoading(false)
    }
  }

  const getSnowDayVerdict = (probability: number) => {
    if (probability >= 70) return { text: 'Very Likely', color: 'bg-destructive' }
    if (probability >= 50) return { text: 'Likely', color: 'bg-accent' }
    if (probability >= 30) return { text: 'Possible', color: 'bg-muted' }
    return { text: 'Unlikely', color: 'bg-secondary' }
  }

  const generateFallbackRationale = (weather: WeatherData): string => {
    const parts: string[] = []
    
    if (weather.snowfall >= 6) {
      parts.push(`Heavy snowfall of ${weather.snowfall}" expected`)
    } else if (weather.snowfall >= 3) {
      parts.push(`Moderate snowfall of ${weather.snowfall}" forecasted`)
    } else if (weather.snowfall > 0) {
      parts.push(`Light snow accumulation of ${weather.snowfall}" expected`)
    } else {
      parts.push('No significant snowfall forecasted')
    }

    if (weather.windSpeed >= 25) {
      parts.push(`high winds up to ${weather.windSpeed} mph`)
    } else if (weather.windSpeed >= 15) {
      parts.push(`moderate winds around ${weather.windSpeed} mph`)
    }

    if (weather.visibility <= 0.25) {
      parts.push('extremely poor visibility')
    } else if (weather.visibility <= 0.5) {
      parts.push('very limited visibility')
    } else if (weather.visibility <= 1) {
      parts.push('reduced visibility conditions')
    }

    if (weather.temperature <= 20) {
      parts.push('dangerously cold temperatures')
    } else if (weather.temperature <= 28) {
      parts.push('freezing conditions ideal for ice formation')
    }

    if (weather.alerts.length > 0) {
      parts.push(`${weather.alerts.length} active weather alert${weather.alerts.length > 1 ? 's' : ''}`)
    }

    const verdict = getSnowDayVerdict(weather.modelProbability)
    const conclusion = weather.modelProbability >= 50 
      ? 'These conditions significantly increase the likelihood of school closures'
      : weather.modelProbability >= 30
        ? 'Conditions may warrant monitoring for potential delays or closures'
        : 'Current conditions suggest normal school operations'

    return `${parts.join(', ')}. ${conclusion}.`
  }

  const getConfidenceBadge = (confidence: string) => {
    const colors = {
      'very_high': 'bg-green-500',
      'high': 'bg-green-400',
      'moderate': 'bg-yellow-500',
      'low': 'bg-orange-500',
      'very_low': 'bg-red-500'
    }
    return colors[confidence as keyof typeof colors] || 'bg-gray-500'
  }

  const getRiskColor = (risk: string) => {
    const colors = {
      'low': 'text-green-600',
      'moderate': 'text-yellow-600',
      'high': 'text-orange-600',
      'severe': 'text-red-600'
    }
    return colors[risk as keyof typeof colors] || 'text-gray-600'
  }

  // Derive timeline + probability metadata up front so hooks stay stable
  const probability = prediction?.final?.snow_day_probability ?? fallbackWeather?.modelProbability ?? 0
  const verdict = getSnowDayVerdict(probability)
  const lastUpdateInfo = useMemo(() => {
    if (prediction) {
      return { label: 'AI analysis generated', date: new Date(prediction.timestamp) }
    }
    if (fallbackWeather) {
      return { label: 'Last updated', date: new Date(fallbackWeather.lastUpdated) }
    }
    return null
  }, [prediction, fallbackWeather])
  const lastUpdateTime = lastUpdateInfo ? lastUpdateInfo.date.getTime() : null

  useEffect(() => {
    if (!lastUpdateTime) {
      setLastUpdateMeta({ formatted: '', stale: false })
      return
    }

    const updateMeta = () => {
      setLastUpdateMeta({
        formatted: new Date(lastUpdateTime).toLocaleString(),
        stale: Date.now() - lastUpdateTime > STALE_THRESHOLD_MS
      })
    }

    updateMeta()
    const interval = setInterval(updateMeta, 60_000)
    return () => clearInterval(interval)
  }, [lastUpdateTime])

  const timestampToShow = lastUpdateMeta.formatted || (lastUpdateInfo ? lastUpdateInfo.date.toLocaleString() : '')
  const staleWarning = lastUpdateInfo && lastUpdateMeta.stale
    ? 'This update is over 3 hours old — refresh for the latest conditions.'
    : null

  // Get snowfall data for canvas animation
  const snowfallIntensity = prediction?.meteorology?.precipitation_analysis?.total_snowfall_inches 
    ?? fallbackWeather?.snowfall 
    ?? 0
  const windSpeed = prediction?.meteorology?.wind_analysis?.max_wind_speed_mph 
    ?? fallbackWeather?.windSpeed 
    ?? 0
  const baselineProbability = recentAverage ?? outcomeStats?.avgProbability ?? null
  const probabilityDelta = baselineProbability !== null ? probability - baselineProbability : null

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Brain size={32} className="animate-spin text-primary sm:w-12 sm:h-12" />
            <span className="text-base sm:text-lg">AI agents analyzing conditions...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!prediction && !fallbackWeather) {
    return (
      <Alert>
        <Warning size={16} />
        <AlertDescription>
          Unable to load prediction data. <Button variant="link" onClick={loadPredictionData} className="p-0 h-auto">Try again</Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <>
      {/* Snowfall animation overlay */}
      <SnowfallCanvas 
        intensity={snowfallIntensity} 
        windSpeed={windSpeed}
        respectReducedMotion={true}
      />
      
      <motion.div 
        className="space-y-6 sm:space-y-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        {/* Weather theme indicator */}
        <div className="text-center space-y-2">
        <WeatherThemeIndicator />
        {lastUpdateInfo && (
          <>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {lastUpdateInfo.label}: {timestampToShow}
            </p>
            {staleWarning && (
              <p className="text-xs sm:text-sm text-amber-600 flex items-center justify-center gap-1">
                <Warning size={12} />
                {staleWarning}
              </p>
            )}
          </>
        )}
      </div>
      
      {/* Main prediction card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card className="text-center border-2 shadow-xl hover:shadow-2xl transition-shadow duration-300 bg-gradient-to-br from-card via-card to-primary/5">
          <CardHeader className="pb-6">
            <CardTitle className="text-xl sm:text-2xl flex items-center justify-center gap-3">
              {prediction ? <Brain size={24} className="text-primary" /> : <CloudSnow size={24} className="text-primary" />}
              Tomorrow's Snow Day Probability
            </CardTitle>
            <p className="text-muted-foreground text-sm sm:text-base">
              {prediction ? `AI Analysis for ${prediction.location}` : 'Based on weather conditions for Rockford, MI'}
            </p>
          </CardHeader>
        <CardContent className="space-y-6 sm:space-y-8">
          <div className="space-y-4 sm:space-y-5">
            <AnimatedProbability value={probability} />
            <div className="flex items-center justify-center gap-3">
              <Badge className={`${verdict.color} text-white text-base sm:text-lg px-3 sm:px-4 py-1.5 sm:py-2`}>
                {verdict.text}
              </Badge>
              {prediction?.final?.confidence_level && (
                <Badge className={`${getConfidenceBadge(prediction.final.confidence_level)} text-white px-2 py-1`}>
                  {prediction.final.confidence_level.replace('_', ' ')} confidence
                </Badge>
              )}
            </div>
            <Progress value={probability} className="h-2 sm:h-3" />
          </div>

          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-lg p-5 sm:p-6 text-left border border-primary/20 mt-6">
            <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Brain size={16} className="text-primary" />
              {prediction ? 'AI Decision Rationale' : 'Weather Analysis'}
            </h4>
            <p className="text-sm text-muted-foreground">
              {prediction 
                ? (prediction.final?.decision_rationale ?? 'No rationale available')
                : fallbackWeather 
                  ? generateFallbackRationale(fallbackWeather)
                  : 'No rationale available'}
            </p>
          </div>
        </CardContent>
      </Card>
      </motion.div>

      <ConditionPulse />

      {prediction && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-primary/0 to-primary/10">
            <CardHeader className="space-y-3 p-6 sm:p-8 pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkle size={18} className="text-primary" />
                AI Spotlight
              </CardTitle>
              {prediction.meteorology?.overall_conditions_summary && (
                <p className="text-sm text-muted-foreground">
                  {prediction.meteorology.overall_conditions_summary}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-6 px-6 sm:px-8 pb-6 sm:pb-8 pt-0">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top drivers</p>
                <ul className="mt-3 space-y-2">
                  {prediction.final?.primary_factors?.slice(0, 3).map((factor, index) => (
                    <li key={index} className="flex items-start gap-2.5 text-sm">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{factor}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-primary/20 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Season shift</p>
                  <p className="text-2xl font-semibold">
                    {(prediction.history?.seasonal_context?.seasonal_probability_adjustment ?? 0) >= 0 ? '+' : ''}
                    {prediction.history?.seasonal_context?.seasonal_probability_adjustment ?? 0}
                    <span className="text-sm font-medium ml-1">pts</span>
                  </p>
                  <p className="text-xs text-muted-foreground">vs typical mid-season odds</p>
                </div>
                <div className="rounded-xl border border-primary/20 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Confidence</p>
                  <p className="text-lg font-semibold capitalize">{prediction.final?.confidence_level?.replace('_', ' ') ?? 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground">Next update by {prediction.final?.next_evaluation_time ?? 'TBD'}</p>
                </div>
              </div>

              {(prediction.history?.seasonal_context?.unusual_factors?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-2.5">
                  {prediction.history?.seasonal_context?.unusual_factors?.slice(0, 3).map((factor, index) => (
                    <span
                      key={index}
                      className="rounded-full bg-primary/10 text-primary text-xs px-3.5 py-1.5"
                    >
                      {factor}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-primary/10">
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendUp size={18} />
                Today vs Season Trend
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                How today's call stacks against the ledger
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {trendLoading ? (
                <div className="space-y-3">
                  <div className="h-4 bg-muted rounded animate-pulse" />
                  <div className="h-8 bg-muted rounded animate-pulse" />
                  <div className="h-3 bg-muted rounded animate-pulse" />
                </div>
              ) : trendError ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Info size={16} />
                  {trendError}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Today</p>
                      <p className="text-3xl font-semibold">{probability}%</p>
                    </div>
                    {baselineProbability !== null && (
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Baseline</p>
                        <p className="text-xl font-semibold">{baselineProbability}%</p>
                        {probabilityDelta !== null && (
                          <p className={`text-xs flex items-center gap-1 ${probabilityDelta >= 0 ? 'text-emerald-500' : 'text-orange-500'}`}>
                            {probabilityDelta >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                            {Math.abs(probabilityDelta)} pts vs recent trend
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>0%</span>
                      <span>100%</span>
                    </div>
                    <Progress value={probability} className="h-2" />
                    {baselineProbability !== null && (
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span className="inline-flex h-2 w-2 rounded-full bg-primary" />
                        Today vs <span className="font-medium">{recentAverage ? '7-day mean' : 'season mean'}</span>
                      </div>
                    )}
                  </div>

                  {outcomeStats && (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="rounded-lg border border-border/60 p-4">
                        <p className="text-xs uppercase text-muted-foreground">Directional accuracy</p>
                        <p className="text-xl font-semibold mt-1">{outcomeStats.directionalAccuracy}%</p>
                        <p className="text-xs text-muted-foreground mt-1">Based on ledgered days</p>
                      </div>
                      <div className="rounded-lg border border-border/60 p-4">
                        <p className="text-xs uppercase text-muted-foreground">Avg probability</p>
                        <p className="text-xl font-semibold mt-1">{outcomeStats.avgProbability}%</p>
                        <p className="text-xs text-muted-foreground mt-1">Season-to-date</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* AI-generated narrative summary */}
      {prediction && <NarrativeSummary prediction={prediction} />}

      {/* Detailed analysis tabs (only show if we have agent prediction) */}
      {prediction && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChartBar size={20} />
              Expert Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="weather" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-2">
                <TabsTrigger value="weather">Weather</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
                <TabsTrigger value="safety">Safety</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>
              
              <TabsContent value="weather" className="space-y-5 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-3.5">
                    <h4 className="font-semibold flex items-center gap-2.5.5">
                      <Thermometer size={16} />
                      Temperature Analysis
                    </h4>
                    <div className="space-y-2.5 text-sm">
                      <div className="flex justify-between">
                        <span>Current:</span>
                        <span>{prediction.meteorology.temperature_analysis.current_temp_f}°F</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Overnight Low:</span>
                        <span>{prediction.meteorology.temperature_analysis.overnight_low_f}°F</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Morning High:</span>
                        <span>{prediction.meteorology.temperature_analysis.morning_high_f}°F</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Trend:</span>
                        <span className="capitalize">{prediction.meteorology.temperature_analysis.temperature_trend}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3.5">
                    <h4 className="font-semibold flex items-center gap-2.5">
                      <CloudSnow size={16} />
                      Precipitation
                    </h4>
                    <div className="space-y-2.5 text-sm">
                      <div className="flex justify-between">
                        <span>Total Snow:</span>
                        <span>{prediction.meteorology.precipitation_analysis.total_snowfall_inches}"</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Type:</span>
                        <span className="capitalize">{prediction.meteorology.precipitation_analysis.precipitation_type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Morning Chance:</span>
                        <span>{prediction.meteorology.precipitation_analysis.snow_probability_morning}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3.5">
                    <h4 className="font-semibold flex items-center gap-2.5">
                      <Wind size={16} />
                      Wind Conditions
                    </h4>
                    <div className="space-y-2.5 text-sm">
                      <div className="flex justify-between">
                        <span>Max Speed:</span>
                        <span>{prediction.meteorology.wind_analysis.max_wind_speed_mph} mph</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Direction:</span>
                        <span>{prediction.meteorology.wind_analysis.wind_direction}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Wind Chill:</span>
                        <span>{prediction.meteorology.wind_analysis.wind_chill_impact ? 'Yes' : 'No'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Eye size={16} />
                      Visibility
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Minimum:</span>
                        <span>{prediction.meteorology.visibility_analysis.minimum_visibility_miles} mi</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Average:</span>
                        <span>{prediction.meteorology.visibility_analysis.avg_visibility_miles} mi</span>
                      </div>
                    </div>
                  </div>
                </div>

                {prediction.meteorology.alert_summary.length > 0 && (
                  <Alert>
                    <Warning size={16} />
                    <AlertDescription>
                      <div className="space-y-1">
                        {prediction.meteorology.alert_summary.map((alert, index) => (
                          <div key={index} className="text-sm">
                            <span className="font-medium">{alert.type}:</span> {alert.description}
                          </div>
                        ))}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>
              
              <TabsContent value="history" className="space-y-4">
                {prediction.history?.error ? (
                  <div className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg">
                    Historical analysis temporarily unavailable: {prediction.history.error}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Similar Weather Patterns</h4>
                      <div className="space-y-2">
                        {prediction.history?.similar_weather_patterns?.map((pattern, index) => (
                          <div key={index} className="border rounded-lg p-3">
                            <div className="flex justify-between items-start mb-1">
                              <p className="text-sm font-medium">{pattern.pattern_description}</p>
                              <Badge variant="outline" className={pattern.confidence_level === 'high' ? 'border-green-500' : pattern.confidence_level === 'medium' ? 'border-yellow-500' : 'border-red-500'}>
                                {pattern.confidence_level}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">Historical snow day rate: {pattern.historical_snow_day_rate}%</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">Seasonal Context</h4>
                      <p className="text-sm mb-2">{prediction.history?.seasonal_context?.typical_conditions_for_date ?? 'No seasonal context available'}</p>
                      {(prediction.history?.seasonal_context?.unusual_factors?.length ?? 0) > 0 && (
                        <div>
                          <p className="text-sm font-medium mb-1">Unusual factors:</p>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            {prediction.history?.seasonal_context?.unusual_factors?.map((factor, index) => (
                              <li key={index}>• {factor}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="safety" className="space-y-4">
                {prediction.safety?.error ? (
                  <div className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg">
                    Safety analysis temporarily unavailable: {prediction.safety.error}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <h4 className="font-semibold flex items-center gap-2">
                          <ShieldCheck size={16} />
                          Road Conditions
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Primary Roads:</span>
                            <span>{prediction.safety?.road_conditions?.primary_roads_score ?? '—'}/10</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Secondary Roads:</span>
                            <span>{prediction.safety?.road_conditions?.secondary_roads_score ?? '—'}/10</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Ice Risk:</span>
                            <span className={getRiskColor(prediction.safety?.road_conditions?.ice_formation_risk ?? '')}>
                              {prediction.safety?.road_conditions?.ice_formation_risk ?? '—'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h4 className="font-semibold">Travel Safety</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Walking:</span>
                            <span>{prediction.safety?.travel_safety?.walking_conditions_score ?? '—'}/10</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Driving:</span>
                            <span>{prediction.safety?.travel_safety?.driving_conditions_score ?? '—'}/10</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Overall Risk:</span>
                            <span className={getRiskColor(prediction.safety?.risk_level ?? '')}>
                              {prediction.safety?.risk_level ?? '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {(prediction.safety?.safety_recommendations?.length ?? 0) > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2">Safety Recommendations</h4>
                        <ul className="text-sm space-y-1">
                          {prediction.safety?.safety_recommendations?.map((rec, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <span className="text-primary">•</span>
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>
              
              <TabsContent value="timeline" className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock size={20} />
                    <h4 className="font-semibold">Event Timeline</h4>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                      <span className="font-medium">Conditions Start:</span>
                      <span>{prediction.final?.timeline?.conditions_start ?? '—'}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                      <span className="font-medium">Peak Impact:</span>
                      <span>{prediction.final?.timeline?.peak_impact_time ?? '—'}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                      <span className="font-medium">Conditions Improve:</span>
                      <span>{prediction.final?.timeline?.conditions_improve ?? '—'}</span>
                    </div>
                  </div>

                  {!prediction.safety?.error && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                      <div>
                        <h5 className="font-semibold mb-2">Morning Commute Impact</h5>
                        <Badge className={getRiskColor(prediction.safety?.timing_analysis?.morning_commute_impact ?? '')}>
                          {prediction.safety?.timing_analysis?.morning_commute_impact ?? '—'}
                        </Badge>
                      </div>
                      <div>
                        <h5 className="font-semibold mb-2">Afternoon Impact</h5>
                        <Badge className={getRiskColor(prediction.safety?.timing_analysis?.afternoon_impact ?? '')}>
                          {prediction.safety?.timing_analysis?.afternoon_impact ?? '—'}
                        </Badge>
                      </div>
                    </div>
                  )}

                  {(prediction.final?.alternative_scenarios?.length ?? 0) > 0 && (
                    <div className="mt-6">
                      <h5 className="font-semibold mb-2">Alternative Scenarios</h5>
                      <div className="space-y-2">
                        {prediction.final?.alternative_scenarios?.map((scenario, index) => (
                          <div key={index} className="border rounded-lg p-3">
                            <div className="flex justify-between items-start mb-1">
                              <p className="text-sm font-medium">{scenario.scenario}</p>
                              <span className="text-xs text-muted-foreground">{scenario.probability}%</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{scenario.impact}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Recommendations section */}
      {prediction && prediction.final?.recommendations && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users size={20} />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="schools" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="schools">Schools</TabsTrigger>
                <TabsTrigger value="residents">Residents</TabsTrigger>
                <TabsTrigger value="authorities">Authorities</TabsTrigger>
              </TabsList>
              
              <TabsContent value="schools" className="mt-5">
                <ul className="space-y-2.5">
                  {prediction.final?.recommendations?.for_schools?.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <span className="text-primary">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </TabsContent>
              
              <TabsContent value="residents" className="mt-5">
                <ul className="space-y-2.5">
                  {prediction.final?.recommendations?.for_residents?.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2.5 text-sm">
                      <span className="text-primary">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </TabsContent>
              
              <TabsContent value="authorities" className="mt-5">
                <ul className="space-y-2.5">
                  {prediction.final?.recommendations?.for_authorities?.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2.5 text-sm">
                      <span className="text-primary">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      </motion.div>
    </>
  )
}
