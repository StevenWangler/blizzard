import { useState, useEffect } from 'react'
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
  ChartBar
} from '@phosphor-icons/react'
import { WeatherService } from '@/services/weather'
import { useWeatherTheme } from '@/hooks/useWeatherTheme'
import { WeatherThemeIndicator } from '@/components/WeatherThemeIndicator'
import { useNotifications } from '@/hooks/useNotifications'
import { toast } from 'sonner'

// Updated interface to match agent predictions
interface AgentPrediction {
  meteorology: {
    temperature_analysis: {
      current_temp_f: number
      overnight_low_f: number
      morning_high_f: number
      freezing_hours: number
      temperature_trend: 'rising' | 'falling' | 'steady'
      windchill_factor: number
    }
    precipitation_analysis: {
      snow_probability_overnight: number
      snow_probability_morning: number
      total_snowfall_inches: number
      snowfall_rate_peak: number
      precipitation_type: 'snow' | 'freezing_rain' | 'sleet' | 'rain' | 'mixed'
    }
    wind_analysis: {
      max_wind_speed_mph: number
      wind_direction: string
      sustained_winds_mph: number
      wind_chill_impact: boolean
    }
    visibility_analysis: {
      minimum_visibility_miles: number
      avg_visibility_miles: number
      visibility_factors: string[]
    }
    alert_summary: Array<{
      type: string
      severity: string
      description: string
    }>
    overall_conditions_summary: string
  }
  history: {
    similar_weather_patterns: Array<{
      pattern_description: string
      historical_snow_day_rate: number
      confidence_level: 'high' | 'medium' | 'low'
    }>
    seasonal_context: {
      typical_conditions_for_date: string
      unusual_factors: string[]
      seasonal_probability_adjustment: number
    }
    location_specific_factors: {
      local_microclimates: string[]
      infrastructure_considerations: string[]
      elevation_impact: string
    }
    confidence_assessment: string
  }
  safety: {
    road_conditions: {
      primary_roads_score: number
      secondary_roads_score: number
      parking_lots_score: number
      ice_formation_risk: 'low' | 'moderate' | 'high' | 'severe'
    }
    travel_safety: {
      walking_conditions_score: number
      driving_conditions_score: number
      public_transport_impact: 'minimal' | 'moderate' | 'significant' | 'severe'
      emergency_access_concern: boolean
    }
    timing_analysis: {
      worst_conditions_start_time: string
      worst_conditions_end_time: string
      morning_commute_impact: 'minimal' | 'moderate' | 'significant' | 'severe'
      afternoon_impact: 'minimal' | 'moderate' | 'significant' | 'severe'
    }
    safety_recommendations: string[]
    risk_level: 'low' | 'moderate' | 'high' | 'severe'
  }
  final: {
    snow_day_probability: number
    confidence_level: 'very_low' | 'low' | 'moderate' | 'high' | 'very_high'
    primary_factors: string[]
    timeline: {
      conditions_start: string
      peak_impact_time: string
      conditions_improve: string
    }
    decision_rationale: string
    alternative_scenarios: Array<{
      scenario: string
      probability: number
      impact: string
    }>
    recommendations: {
      for_schools: string[]
      for_residents: string[]
      for_authorities: string[]
    }
    updates_needed: boolean
    next_evaluation_time: string
  }
  timestamp: string
  location: string
}

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
  
  const { updateWeatherConditions, getCurrentTheme } = useWeatherTheme()
  const { checkAndNotify } = useNotifications()

  useEffect(() => {
    loadPredictionData()
  }, [])

  const loadPredictionData = async () => {
    try {
      setLoading(true)
      
      // Try to load AI agent prediction first
      try {
        const response = await fetch('/data/prediction.json')
        if (response.ok) {
          const data = await response.json()
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
        }
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

  const getSnowDayVerdict = (probability: number) => {
    if (probability >= 70) return { text: 'Very Likely', color: 'bg-destructive' }
    if (probability >= 50) return { text: 'Likely', color: 'bg-accent' }
    if (probability >= 30) return { text: 'Possible', color: 'bg-muted' }
    return { text: 'Unlikely', color: 'bg-secondary' }
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

  // If we have agent prediction, use it; otherwise use fallback
  const probability = prediction?.final?.snow_day_probability ?? fallbackWeather?.modelProbability ?? 0
  const verdict = getSnowDayVerdict(probability)
  const lastUpdateInfo = prediction
    ? { label: 'AI analysis generated', date: new Date(prediction.timestamp) }
    : fallbackWeather
      ? { label: 'Last updated', date: new Date(fallbackWeather.lastUpdated) }
      : null
  const formattedLastUpdate = lastUpdateInfo ? lastUpdateInfo.date.toLocaleString() : ''
  const isStale = lastUpdateInfo
    ? Date.now() - lastUpdateInfo.date.getTime() > STALE_THRESHOLD_MS
    : false
  const staleWarning = isStale ? 'This update is over 3 hours old — refresh for the latest conditions.' : null

  // Get snowfall data for canvas animation
  const snowfallIntensity = prediction?.meteorology?.precipitation_analysis?.total_snowfall_inches 
    ?? fallbackWeather?.snowfall 
    ?? 0
  const windSpeed = prediction?.meteorology?.wind_analysis?.max_wind_speed_mph 
    ?? fallbackWeather?.windSpeed 
    ?? 0

  return (
    <>
      {/* Snowfall animation overlay */}
      <SnowfallCanvas 
        intensity={snowfallIntensity} 
        windSpeed={windSpeed}
        respectReducedMotion={true}
      />
      
      <motion.div 
        className="space-y-4 sm:space-y-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        {/* Weather theme indicator */}
        <div className="text-center space-y-1">
        <WeatherThemeIndicator />
        {lastUpdateInfo && (
          <>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {lastUpdateInfo.label}: {formattedLastUpdate}
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
          <CardHeader className="pb-4">
            <CardTitle className="text-xl sm:text-2xl flex items-center justify-center gap-2">
              {prediction ? <Brain size={24} className="text-primary" /> : <CloudSnow size={24} className="text-primary" />}
              Tomorrow's Snow Day Probability
            </CardTitle>
            <p className="text-muted-foreground text-sm sm:text-base">
              {prediction ? `AI Analysis for ${prediction.location}` : 'Based on weather conditions for Rockford, MI'}
            </p>
          </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6">
          <div className="space-y-3 sm:space-y-4">
            <AnimatedProbability value={probability} />
            <div className="flex items-center justify-center gap-2">
              <Badge className={`${verdict.color} text-white text-base sm:text-lg px-3 sm:px-4 py-1.5 sm:py-2`}>
                {verdict.text}
              </Badge>
              {prediction && (
                <Badge className={`${getConfidenceBadge(prediction.final.confidence_level)} text-white px-2 py-1`}>
                  {prediction.final.confidence_level.replace('_', ' ')} confidence
                </Badge>
              )}
            </div>
            <Progress value={probability} className="h-2 sm:h-3" />
          </div>

          {prediction && (
            <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-lg p-4 text-left border border-primary/20">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Brain size={16} className="text-primary" />
                AI Decision Rationale
              </h4>
              <p className="text-sm text-muted-foreground">{prediction.final.decision_rationale}</p>
            </div>
          )}
        </CardContent>
      </Card>
      </motion.div>

      <Alert>
        <Warning size={16} />
        <AlertDescription>
          Crowd voting, leaderboards, and other community features are disabled until we have server-side infrastructure. 
          The probabilities shown here come directly from the AI agents and weather models.
        </AlertDescription>
      </Alert>

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
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="weather">Weather</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
                <TabsTrigger value="safety">Safety</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>
              
              <TabsContent value="weather" className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Thermometer size={16} />
                      Temperature Analysis
                    </h4>
                    <div className="space-y-2 text-sm">
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

                  <div className="space-y-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <CloudSnow size={16} />
                      Precipitation
                    </h4>
                    <div className="space-y-2 text-sm">
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

                  <div className="space-y-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Wind size={16} />
                      Wind Conditions
                    </h4>
                    <div className="space-y-2 text-sm">
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
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Similar Weather Patterns</h4>
                    <div className="space-y-2">
                      {prediction.history.similar_weather_patterns.map((pattern, index) => (
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
                    <p className="text-sm mb-2">{prediction.history.seasonal_context.typical_conditions_for_date}</p>
                    {prediction.history.seasonal_context.unusual_factors.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-1">Unusual factors:</p>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {prediction.history.seasonal_context.unusual_factors.map((factor, index) => (
                            <li key={index}>• {factor}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="safety" className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <ShieldCheck size={16} />
                      Road Conditions
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Primary Roads:</span>
                        <span>{prediction.safety.road_conditions.primary_roads_score}/10</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Secondary Roads:</span>
                        <span>{prediction.safety.road_conditions.secondary_roads_score}/10</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Ice Risk:</span>
                        <span className={getRiskColor(prediction.safety.road_conditions.ice_formation_risk)}>
                          {prediction.safety.road_conditions.ice_formation_risk}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold">Travel Safety</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Walking:</span>
                        <span>{prediction.safety.travel_safety.walking_conditions_score}/10</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Driving:</span>
                        <span>{prediction.safety.travel_safety.driving_conditions_score}/10</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Overall Risk:</span>
                        <span className={getRiskColor(prediction.safety.risk_level)}>
                          {prediction.safety.risk_level}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {prediction.safety.safety_recommendations.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Safety Recommendations</h4>
                    <ul className="text-sm space-y-1">
                      {prediction.safety.safety_recommendations.map((rec, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-primary">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
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
                      <span>{prediction.final.timeline.conditions_start}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                      <span className="font-medium">Peak Impact:</span>
                      <span>{prediction.final.timeline.peak_impact_time}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-muted/50 rounded-lg">
                      <span className="font-medium">Conditions Improve:</span>
                      <span>{prediction.final.timeline.conditions_improve}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                    <div>
                      <h5 className="font-semibold mb-2">Morning Commute Impact</h5>
                      <Badge className={getRiskColor(prediction.safety.timing_analysis.morning_commute_impact)}>
                        {prediction.safety.timing_analysis.morning_commute_impact}
                      </Badge>
                    </div>
                    <div>
                      <h5 className="font-semibold mb-2">Afternoon Impact</h5>
                      <Badge className={getRiskColor(prediction.safety.timing_analysis.afternoon_impact)}>
                        {prediction.safety.timing_analysis.afternoon_impact}
                      </Badge>
                    </div>
                  </div>

                  {prediction.final.alternative_scenarios.length > 0 && (
                    <div className="mt-6">
                      <h5 className="font-semibold mb-2">Alternative Scenarios</h5>
                      <div className="space-y-2">
                        {prediction.final.alternative_scenarios.map((scenario, index) => (
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

      {/* Legacy weather conditions card (fallback or simplified view) */}
      {!prediction && fallbackWeather && (
        <div className="flex flex-col gap-4 sm:gap-6 lg:grid lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <CloudSnow size={18} className="sm:w-5 sm:h-5" />
                Weather Drivers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="flex items-center gap-3">
                  <CloudSnow size={20} className="text-primary sm:w-6 sm:h-6" />
                  <div>
                    <p className="font-medium text-sm sm:text-base">{fallbackWeather.snowfall}"</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">Expected snow</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Thermometer size={20} className="text-blue-500 sm:w-6 sm:h-6" />
                  <div>
                    <p className="font-medium text-sm sm:text-base">{fallbackWeather.temperature}°F</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">Temperature</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Wind size={20} className="text-slate-500 sm:w-6 sm:h-6" />
                  <div>
                    <p className="font-medium text-sm sm:text-base">{fallbackWeather.windSpeed} mph</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">Wind speed</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Eye size={20} className="text-gray-500 sm:w-6 sm:h-6" />
                  <div>
                    <p className="font-medium text-sm sm:text-base">{fallbackWeather.visibility} mi</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">Visibility</p>
                  </div>
                </div>
              </div>

              {fallbackWeather.alerts.length > 0 && (
                <div className="mt-4">
                  <Alert>
                    <Warning size={16} />
                    <AlertDescription>
                      <div className="space-y-1">
                        {fallbackWeather.alerts.map((alert, index) => (
                          <p key={index} className="text-sm">{alert}</p>
                        ))}
                      </div>
                    </AlertDescription>
                  </Alert>
                </div>
              )}

            <p className="text-xs text-muted-foreground mt-3 sm:mt-4">
              Last updated: {new Date(fallbackWeather.lastUpdated).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        </div>
      )}

      {/* Recommendations section */}
      {prediction && (
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
              
              <TabsContent value="schools" className="mt-4">
                <ul className="space-y-2">
                  {prediction.final.recommendations.for_schools.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <span className="text-primary">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </TabsContent>
              
              <TabsContent value="residents" className="mt-4">
                <ul className="space-y-2">
                  {prediction.final.recommendations.for_residents.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <span className="text-primary">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </TabsContent>
              
              <TabsContent value="authorities" className="mt-4">
                <ul className="space-y-2">
                  {prediction.final.recommendations.for_authorities.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
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

      {/* Last update info */}
      <div className="text-center text-xs text-muted-foreground space-y-1">
        {lastUpdateInfo && (
          <span>
            {lastUpdateInfo.label}: {formattedLastUpdate}
          </span>
        )}
        {staleWarning && (
          <span className="text-amber-600 font-medium flex items-center justify-center gap-1">
            <Warning size={12} />
            {staleWarning}
          </span>
        )}
        {prediction?.final.updates_needed && (
          <div className="text-yellow-600 flex items-center justify-center gap-1">
            <Warning size={12} />
            Conditions changing - next update: {prediction.final.next_evaluation_time}
          </div>
        )})
      </div>
      </motion.div>
    </>
  )
}
