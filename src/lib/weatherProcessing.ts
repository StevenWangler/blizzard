/**
 * Weather Data Processing Functions
 * 
 * Processes weather forecast data for snow day analysis.
 * Extracts data for critical time periods, calculates probabilities,
 * and analyzes weather patterns and trends.
 */

import {
  HourlyWeather,
  WeatherApiResponse,
  ProcessedWeatherData,
  ProcessedHourlyData,
  ProbabilityWeights,
  ThresholdValues,
  DEFAULT_PROBABILITY_WEIGHTS,
  DEFAULT_THRESHOLDS,
  TimePeriod,
  DEFAULT_TIME_PERIODS,
  WeatherAlert
} from './weatherTypes'

/**
 * Extract relevant weather metrics for specific hours.
 * 
 * @param hourlyData List of hourly weather data from API
 * @param startHour Starting hour (24-hour format, e.g., 19 for 7 PM)
 * @param endHour Ending hour (24-hour format, e.g., 8 for 8 AM)
 * @param weights Probability weights for different weather factors
 * @param thresholds Threshold values for weather conditions
 * @returns Processed weather data with probability calculations
 */
export function getHourlyForecastData(
  hourlyData: HourlyWeather[],
  startHour: number,
  endHour: number,
  weights: ProbabilityWeights = DEFAULT_PROBABILITY_WEIGHTS,
  thresholds: ThresholdValues = DEFAULT_THRESHOLDS
): ProcessedHourlyData {
  const relevantData: ProcessedHourlyData = {}
  const tempTrend: number[] = []
  const precipTrend: number[] = []
  const windTrend: number[] = []
  const visibilityTrend: number[] = []
  const snowProbabilities: number[] = []

  let totalSnowProbability = 0
  let totalHours = 0

  for (const hour of hourlyData) {
    const hourOfDay = parseInt(hour.time.split(' ')[1].split(':')[0])
    
    // Handle overnight periods (e.g., 19-24 and 0-8)
    const isInTimeRange = startHour <= endHour 
      ? (hourOfDay >= startHour && hourOfDay < endHour)
      : (hourOfDay >= startHour || hourOfDay < endHour)

    if (isInTimeRange) {
      totalHours++

      // Calculate weighted probability factors
      const snowFactor = Math.min(1.0, 
        (hour.chance_of_snow / 100.0) * 
        Math.min(1.0, (hour.snow_cm / 2.54) / 3.0)
      )

      const tempFactor = hour.temp_f < thresholds.temperature.critical 
        ? 1.0 
        : Math.max(0, (thresholds.temperature.cold - hour.temp_f) / 12)

      const windFactor = Math.min(1.0, hour.wind_mph / thresholds.wind.high)

      const visFactor = Math.max(0, 1.0 - (hour.vis_miles / 10.0))

      // Ground conditions factor (humidity, pressure, etc.)
      const groundFactor = (hour.humidity / 100.0) * 0.5 + 
                          Math.max(0, (1020 - hour.pressure_mb) / 50) * 0.5

      // Calculate overall hour probability
      const hourProbability = (
        snowFactor * weights.snow +
        tempFactor * weights.temperature +
        windFactor * weights.wind +
        visFactor * weights.visibility +
        groundFactor * weights.ground_conditions
      )

      totalSnowProbability += hourProbability
      snowProbabilities.push(hourProbability * 100)

      // Store detailed hourly metrics
      relevantData[`hour_${hourOfDay}_probability`] = Math.round(hourProbability * 100 * 100) / 100
      relevantData[`hour_${hourOfDay}_temp_f`] = hour.temp_f
      relevantData[`hour_${hourOfDay}_feelslike_f`] = hour.feelslike_f
      relevantData[`hour_${hourOfDay}_windchill_f`] = hour.windchill_f
      relevantData[`hour_${hourOfDay}_chance_of_snow`] = hour.chance_of_snow
      relevantData[`hour_${hourOfDay}_snow_cm`] = hour.snow_cm
      relevantData[`hour_${hourOfDay}_wind_mph`] = hour.wind_mph
      relevantData[`hour_${hourOfDay}_gust_mph`] = hour.gust_mph
      relevantData[`hour_${hourOfDay}_visibility_miles`] = hour.vis_miles
      relevantData[`hour_${hourOfDay}_condition`] = hour.condition.text
      relevantData[`hour_${hourOfDay}_humidity`] = hour.humidity

      // Build trend arrays
      tempTrend.push(hour.temp_f)
      precipTrend.push(hour.precip_mm)
      windTrend.push(hour.wind_mph)
      visibilityTrend.push(hour.vis_miles)
    }
  }

  // Calculate trends and summaries
  if (tempTrend.length > 0) {
    relevantData.temp_trend = calculateTrend(tempTrend)
    relevantData.wind_trend = calculateTrend(windTrend)
    relevantData.visibility_trend = calculateTrend(visibilityTrend)
    relevantData.temp_min = Math.min(...tempTrend)
    relevantData.temp_max = Math.max(...tempTrend)
    relevantData.wind_peak = Math.max(...windTrend)
    relevantData.total_precip = precipTrend.reduce((sum, val) => sum + val, 0)
    relevantData.avg_visibility = visibilityTrend.reduce((sum, val) => sum + val, 0) / visibilityTrend.length
    relevantData.min_visibility = Math.min(...visibilityTrend)
  }

  // Add probability metrics
  if (totalHours > 0) {
    relevantData.average_snow_probability = Math.round((totalSnowProbability / totalHours) * 100 * 100) / 100
    relevantData.peak_snow_probability = Math.max(...snowProbabilities, 0)
  }

  relevantData.total_hours_analyzed = totalHours

  return relevantData
}

/**
 * Calculate trend direction and magnitude from a series of values.
 */
export function calculateTrend(values: number[]): string {
  if (!values || values.length < 2) {
    return 'steady'
  }

  const firstHalf = values.slice(0, Math.floor(values.length / 2))
  const secondHalf = values.slice(Math.floor(values.length / 2))

  const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length
  const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length

  const diff = secondAvg - firstAvg

  if (Math.abs(diff) < 0.5) {
    return 'steady'
  } else if (diff > 0) {
    return diff > 2 ? 'increasing' : 'slightly increasing'
  } else {
    return diff < -2 ? 'decreasing' : 'slightly decreasing'
  }
}

/**
 * Process weather forecast data for analysis.
 * 
 * Extracts data for critical time periods and processes weather alerts.
 * 
 * @param forecastData Raw forecast data from WeatherAPI
 * @param timePeriods Time periods to analyze (defaults to evening and morning)
 * @param weights Probability weights for different factors
 * @param thresholds Threshold values for conditions
 * @returns Processed weather data for analysis
 */
export function getRelevantWeatherInformation(
  forecastData: WeatherApiResponse,
  timePeriods: TimePeriod[] = DEFAULT_TIME_PERIODS,
  weights: ProbabilityWeights = DEFAULT_PROBABILITY_WEIGHTS,
  thresholds: ThresholdValues = DEFAULT_THRESHOLDS
): ProcessedWeatherData {
  const weatherData: any = {}

  try {
    // Process weather alerts
    const alerts = forecastData.alerts?.alert || []
    weatherData.alerts = alerts
    weatherData.alert_count = alerts.length

    // Initialize accumulative metrics
    let totalSnowProbability = 0
    let peakSnowProbability = 0
    let totalSnowCm = 0
    let allTemperatures: number[] = []
    let allWindSpeeds: number[] = []
    let allVisibilities: number[] = []

    // Process each time period
    for (const period of timePeriods) {
      const dayIndex = period.start_hour >= 19 ? 0 : 1 // Evening data from today, morning from tomorrow
      
      if (forecastData.forecast.forecastday[dayIndex]) {
        const hourlyData = forecastData.forecast.forecastday[dayIndex].hour
        const periodData = getHourlyForecastData(
          hourlyData, 
          period.start_hour, 
          period.end_hour, 
          weights, 
          thresholds
        )

        // Store period-specific data
        weatherData[`${period.name}_data`] = periodData

        // Accumulate overall metrics
        if (typeof periodData.average_snow_probability === 'number') {
          totalSnowProbability += periodData.average_snow_probability
        }
        if (typeof periodData.peak_snow_probability === 'number') {
          peakSnowProbability = Math.max(peakSnowProbability, periodData.peak_snow_probability)
        }

        // Collect all temperatures, wind speeds, visibilities for overall analysis
        hourlyData
          .filter(hour => {
            const hourOfDay = parseInt(hour.time.split(' ')[1].split(':')[0])
            return period.start_hour <= period.end_hour 
              ? (hourOfDay >= period.start_hour && hourOfDay < period.end_hour)
              : (hourOfDay >= period.start_hour || hourOfDay < period.end_hour)
          })
          .forEach(hour => {
            allTemperatures.push(hour.temp_f)
            allWindSpeeds.push(hour.wind_mph)
            allVisibilities.push(hour.vis_miles)
            totalSnowCm += hour.snow_cm
          })
      }
    }

    // Calculate overall metrics
    weatherData.average_snow_probability = Math.round((totalSnowProbability / timePeriods.length) * 100) / 100
    weatherData.peak_snow_probability = Math.round(peakSnowProbability * 100) / 100
    weatherData.total_snow_cm = Math.round(totalSnowCm * 100) / 100

    // Temperature analysis
    if (allTemperatures.length > 0) {
      weatherData.temp_min = Math.min(...allTemperatures)
      weatherData.temp_max = Math.max(...allTemperatures)
      weatherData.avg_temperature = Math.round((allTemperatures.reduce((sum, val) => sum + val, 0) / allTemperatures.length) * 100) / 100
      weatherData.temp_trend = calculateTrend(allTemperatures)
      
      // Calculate windchill minimum
      const windchillTemps = allTemperatures.map((temp, index) => 
        calculateWindChill(temp, allWindSpeeds[index] || 0)
      )
      weatherData.windchill_min = Math.min(...windchillTemps)
    }

    // Wind analysis
    if (allWindSpeeds.length > 0) {
      weatherData.wind_peak = Math.max(...allWindSpeeds)
      weatherData.avg_wind_speed = Math.round((allWindSpeeds.reduce((sum, val) => sum + val, 0) / allWindSpeeds.length) * 100) / 100
      weatherData.wind_trend = calculateTrend(allWindSpeeds)
      
      // Calculate max gust from all periods
      let maxGust = 0
      forecastData.forecast.forecastday.forEach(day => {
        day.hour.forEach(hour => {
          maxGust = Math.max(maxGust, hour.gust_mph)
        })
      })
      weatherData.wind_gust_max = maxGust
    }

    // Visibility analysis
    if (allVisibilities.length > 0) {
      weatherData.avg_visibility = Math.round((allVisibilities.reduce((sum, val) => sum + val, 0) / allVisibilities.length) * 100) / 100
      weatherData.min_visibility = Math.min(...allVisibilities)
      weatherData.visibility_trend = calculateTrend(allVisibilities)
    }

    // Precipitation and snow analysis
    let totalPrecip = 0
    forecastData.forecast.forecastday.forEach(day => {
      totalPrecip += day.day.totalprecip_mm
    })
    weatherData.total_precip = Math.round(totalPrecip * 100) / 100

    // Snow accumulation trend
    const snowAccumulations = forecastData.forecast.forecastday.map(day => day.day.totalsnow_cm)
    weatherData.snow_accumulation_trend = calculateTrend(snowAccumulations)

    // Location and timing information
    weatherData.location = forecastData.location
    weatherData.last_updated = forecastData.current.last_updated
    weatherData.forecast_period = {
      start: forecastData.forecast.forecastday[0].date,
      end: forecastData.forecast.forecastday[forecastData.forecast.forecastday.length - 1].date
    }

    return weatherData as ProcessedWeatherData

  } catch (error) {
    console.error('Error processing weather data:', error)
    throw new Error(`Failed to process weather data: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Calculate wind chill temperature.
 * 
 * @param tempF Temperature in Fahrenheit
 * @param windMph Wind speed in MPH
 * @returns Wind chill temperature in Fahrenheit
 */
export function calculateWindChill(tempF: number, windMph: number): number {
  if (tempF > 50 || windMph < 3) {
    return tempF // Wind chill not applicable
  }

  // Wind chill formula (new formula used by NWS)
  return Math.round(
    35.74 + (0.6215 * tempF) - (35.75 * Math.pow(windMph, 0.16)) + (0.4275 * tempF * Math.pow(windMph, 0.16))
  )
}

/**
 * Calculate heat index temperature.
 * 
 * @param tempF Temperature in Fahrenheit
 * @param humidity Humidity percentage
 * @returns Heat index temperature in Fahrenheit
 */
export function calculateHeatIndex(tempF: number, humidity: number): number {
  if (tempF < 80) {
    return tempF // Heat index not applicable
  }

  // Simplified heat index formula
  const HI = -42.379 + 2.04901523 * tempF + 10.14333127 * humidity -
             .22475541 * tempF * humidity - .00683783 * tempF * tempF -
             .05481717 * humidity * humidity + .00122874 * tempF * tempF * humidity +
             .00085282 * tempF * humidity * humidity - .00000199 * tempF * tempF * humidity * humidity

  return Math.round(HI)
}

/**
 * Categorize snow day probability based on calculated percentage.
 * 
 * @param probability Snow day probability percentage
 * @returns Object with category and description
 */
export function categorizeSnowDayProbability(probability: number): {
  category: string
  description: string
  confidence: 'low' | 'medium' | 'high'
} {
  if (probability >= 80) {
    return {
      category: 'Very High',
      description: 'Snow day highly likely - significant accumulation and dangerous conditions expected',
      confidence: 'high'
    }
  } else if (probability >= 60) {
    return {
      category: 'High',
      description: 'Snow day likely - substantial snow and travel impacts expected',
      confidence: 'high'
    }
  } else if (probability >= 40) {
    return {
      category: 'Moderate',
      description: 'Snow day possible - weather conditions may impact travel and schools',
      confidence: 'medium'
    }
  } else if (probability >= 20) {
    return {
      category: 'Low',
      description: 'Snow day unlikely but possible - minor weather impacts expected',
      confidence: 'medium'
    }
  } else {
    return {
      category: 'Very Low',
      description: 'Snow day very unlikely - minimal weather impacts expected',
      confidence: 'low'
    }
  }
}