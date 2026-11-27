import { WeatherAPI, isWeatherApiKeyConfigured } from './weatherApi'
import { getRelevantWeatherInformation, categorizeSnowDayProbability } from './weatherProcessing'
import { WeatherApiError } from "@/types/weatherTypes"

interface WeatherData {
  temperature: number
  snowfall: number
  windSpeed: number
  visibility: number
  alerts: string[]
  modelProbability: number
  lastUpdated: string
}

export class WeatherService {
  private static weatherApi = new WeatherAPI()

  /**
   * Get current weather forecast using real WeatherAPI data.
   *
   * The public client intentionally has no vendor API key. Callers must handle
   * an unavailable live-weather source rather than displaying invented data.
   */
  static async getCurrentForecast(): Promise<WeatherData> {
    try {
      // Check if API key is configured
      if (!isWeatherApiKeyConfigured()) {
        throw new Error('Live weather is unavailable because this public client has no server-side weather source.')
      }

      // Fetch real weather data
      console.log('Fetching real weather data from WeatherAPI...')
      const forecastData = await this.weatherApi.getForecast()
      
      // Process the weather data
      const processedData = getRelevantWeatherInformation(forecastData)
      
      // Filter alerts to get relevant ones for the location
      const filteredAlerts = this.weatherApi.filterAlertsByLocation(
        processedData.alerts, 
        processedData.location
      )

      // Convert to our application format
      const weatherData: WeatherData = {
        temperature: Math.round(processedData.avg_temperature || forecastData.current.temp_f),
        snowfall: Math.round((processedData.total_snow_cm / 2.54) * 100) / 100, // Convert cm to inches
        windSpeed: Math.round(processedData.wind_peak || forecastData.current.wind_mph),
        visibility: Math.round((processedData.min_visibility || forecastData.current.vis_miles) * 100) / 100,
        alerts: filteredAlerts.map(alert => alert.headline || alert.event),
        modelProbability: Math.round(processedData.average_snow_probability),
        lastUpdated: new Date().toISOString()
      }

      console.log('Weather data processed successfully:', {
        location: `${processedData.location.name}, ${processedData.location.region}`,
        probability: weatherData.modelProbability,
        temperature: weatherData.temperature,
        snowfall: weatherData.snowfall
      })

      return weatherData

    } catch (error) {
      console.error('Failed to fetch real weather data:', error)
      
      // If it's an API error, provide more specific feedback
      if (error instanceof WeatherApiError) {
        console.error(`Weather API Error (${error.code}): ${error.message}`)
        
        // For certain errors, we might want to show the user
        if (error.code === 2006) {
          console.error('Invalid API key provided')
        } else if (error.code === 2007) {
          console.error('API quota exceeded')
        } else if (error.code === 1006) {
          console.error('Location not found')
        }
      }

      throw error
    }
  }

  /**
   * Validate the weather API configuration.
   */
  static async validateConfiguration(): Promise<{
    isValid: boolean
    message: string
  }> {
    try {
      if (!isWeatherApiKeyConfigured()) {
        return {
          isValid: false,
          message: 'Live browser weather is intentionally disabled until a server-side weather endpoint is available.'
        }
      }

      const isValid = await this.weatherApi.validateApiKey()
      return {
        isValid,
        message: isValid ? 'Weather API configured correctly' : 'Invalid Weather API key'
      }
    } catch (error) {
      return {
        isValid: false,
        message: `Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Get detailed weather analysis for debugging/admin purposes.
   */
  static async getDetailedWeatherAnalysis(): Promise<any> {
    try {
      const forecastData = await this.weatherApi.getForecast()
      return getRelevantWeatherInformation(forecastData)
    } catch (error) {
      console.error('Failed to get detailed weather analysis:', error)
      throw error
    }
  }
}
