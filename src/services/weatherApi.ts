/**
 * Weather API Client
 * 
 * Handles authentication and communication with WeatherAPI.com service.
 * Provides methods for fetching weather forecasts with specialized processing
 * for critical time periods and location-specific alert filtering.
 */

import {
  WeatherApiResponse,
  WeatherApiConfig,
  WeatherApiError,
  Location,
  WeatherAlert
} from "@/types/weatherTypes"

export class WeatherAPI {
  private config: WeatherApiConfig

  constructor(apiKey?: string, zipCode?: string) {
    // Get configuration from environment variables
    const envApiKey = import.meta.env.VITE_WEATHER_API_KEY
    const envZipCode = import.meta.env.VITE_ZIP_CODE || '49341'

    if (!apiKey && !envApiKey) {
      throw new Error('Weather API key is required. Set VITE_WEATHER_API_KEY environment variable or pass as parameter.')
    }

    this.config = {
      apiKey: apiKey || envApiKey,
      baseUrl: 'https://api.weatherapi.com/v1',
      zipCode: zipCode || envZipCode,
      timeout: 30000
    }
  }

  /**
   * Fetch weather forecast for current day and next day.
   * 
   * @returns Promise containing forecast data with hourly forecasts, alerts, and current conditions
   * @throws WeatherApiError if request fails
   */
  async getForecast(): Promise<WeatherApiResponse> {
    try {
      const url = new URL(`${this.config.baseUrl}/forecast.json`)
      
      // Set query parameters
      url.searchParams.set('key', this.config.apiKey)
      url.searchParams.set('q', this.config.zipCode)
      url.searchParams.set('days', '2')
      url.searchParams.set('aqi', 'no')
      url.searchParams.set('alerts', 'yes')

      console.log(`Fetching weather forecast for ${this.config.zipCode}...`)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        await this.handleApiError(response)
      }

      const data: WeatherApiResponse = await response.json()
      
      console.log(`Weather forecast fetched successfully for ${data.location.name}, ${data.location.region}`)
      
      return data

    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw this.createError(408, 'Request timeout', 'TIMEOUT_ERROR')
        }
        if (error.message.includes('fetch')) {
          throw this.createError(0, 'Network error: Unable to connect to weather service', 'NETWORK_ERROR')
        }
      }
      throw error instanceof WeatherApiError ? error : this.createError(500, 'Unknown error occurred', 'API_ERROR')
    }
  }

  /**
   * Get current weather conditions only.
   * 
   * @returns Promise containing current weather data
   */
  async getCurrentWeather(): Promise<WeatherApiResponse> {
    try {
      const url = new URL(`${this.config.baseUrl}/current.json`)
      
      url.searchParams.set('key', this.config.apiKey)
      url.searchParams.set('q', this.config.zipCode)
      url.searchParams.set('aqi', 'no')

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        await this.handleApiError(response)
      }

      return await response.json()

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw this.createError(408, 'Request timeout', 'TIMEOUT_ERROR')
      }
      throw error instanceof WeatherApiError ? error : this.createError(500, 'Unknown error occurred', 'API_ERROR')
    }
  }

  /**
   * Get weather alerts for the location.
   * 
   * @returns Promise containing weather alerts
   */
  async getAlerts(): Promise<WeatherAlert[]> {
    try {
      const url = new URL(`${this.config.baseUrl}/alerts.json`)
      
      url.searchParams.set('key', this.config.apiKey)
      url.searchParams.set('q', this.config.zipCode)

      const response = await fetch(url.toString())
      
      if (!response.ok) {
        await this.handleApiError(response)
      }

      const data = await response.json()
      return data.alerts?.alert || []

    } catch (error) {
      console.warn('Failed to fetch weather alerts:', error)
      return [] // Return empty array if alerts fail - not critical
    }
  }

  /**
   * Search for locations matching a query.
   * 
   * @param query Location query (city name, ZIP code, coordinates, etc.)
   * @returns Promise containing array of matching locations
   */
  async searchLocations(query: string): Promise<Location[]> {
    try {
      const url = new URL(`${this.config.baseUrl}/search.json`)
      
      url.searchParams.set('key', this.config.apiKey)
      url.searchParams.set('q', query)

      const response = await fetch(url.toString())
      
      if (!response.ok) {
        await this.handleApiError(response)
      }

      return await response.json()

    } catch (error) {
      throw error instanceof WeatherApiError ? error : this.createError(500, 'Location search failed', 'API_ERROR')
    }
  }

  /**
   * Validate the API key by making a test request.
   * 
   * @returns Promise<boolean> true if API key is valid
   */
  async validateApiKey(): Promise<boolean> {
    try {
      await this.getCurrentWeather()
      return true
    } catch (error) {
      if (error instanceof WeatherApiError && error.code === 2006) {
        return false // Invalid API key
      }
      throw error
    }
  }

  /**
   * Filter weather alerts by location relevance.
   * 
   * @param alerts Array of weather alerts
   * @param location Location to filter by
   * @returns Filtered array of relevant alerts
   */
  filterAlertsByLocation(alerts: WeatherAlert[], location: Location): WeatherAlert[] {
    const county = location.region.toLowerCase()
    const city = location.name.toLowerCase()
    const state = location.country.toLowerCase()

    return alerts.filter(alert => {
      const alertAreas = alert.areas.toLowerCase()
      
      // Check location relevance
      return (
        alertAreas.includes(county) ||
        alertAreas.includes(city) ||
        alertAreas.includes(`${city}, ${state}`) ||
        alertAreas.includes(state)
      )
    }).map(alert => ({
      ...alert,
      // Simplify alert data for our application
      headline: alert.headline || alert.event,
      severity: alert.severity || 'Unknown',
      desc: alert.desc || alert.instruction || 'No description available'
    }))
  }

  /**
   * Update the ZIP code for weather requests.
   * 
   * @param zipCode New ZIP code
   */
  setZipCode(zipCode: string): void {
    this.config.zipCode = zipCode
  }

  /**
   * Get current configuration.
   */
  getConfig(): Omit<WeatherApiConfig, 'apiKey'> {
    return {
      baseUrl: this.config.baseUrl,
      zipCode: this.config.zipCode,
      timeout: this.config.timeout
    }
  }

  /**
   * Handle API error responses.
   */
  private async handleApiError(response: Response): Promise<never> {
    let errorData: any
    
    try {
      errorData = await response.json()
    } catch {
      throw this.createError(
        response.status,
        `HTTP ${response.status}: ${response.statusText}`,
        'API_ERROR'
      )
    }

    const error = errorData.error
    if (error) {
      throw this.createError(error.code || response.status, error.message, 'API_ERROR')
    }

    throw this.createError(
      response.status,
      `HTTP ${response.status}: ${response.statusText}`,
      'API_ERROR'
    )
  }

  /**
   * Create a standardized error object.
   */
  private createError(
    code: number,
    message: string,
    type: WeatherApiError['type']
  ): WeatherApiError {
    return new WeatherApiError(code, message, type)
  }
}

/**
 * Default WeatherAPI instance using environment variables.
 */
export const weatherApi = new WeatherAPI()

/**
 * Common WeatherAPI error codes for reference.
 */
export const WeatherApiErrorCodes = {
  API_KEY_NOT_PROVIDED: 1002,
  QUERY_NOT_PROVIDED: 1003,
  INVALID_URL: 1005,
  LOCATION_NOT_FOUND: 1006,
  INVALID_API_KEY: 2006,
  QUOTA_EXCEEDED: 2007,
  API_KEY_DISABLED: 2008,
  NO_ACCESS: 2009,
  INVALID_JSON: 9000,
  TOO_MANY_LOCATIONS: 9001,
  INTERNAL_ERROR: 9999
} as const