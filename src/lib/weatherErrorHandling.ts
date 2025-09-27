/**
 * Weather API Error Handling and Validation
 * 
 * Provides comprehensive error handling, API key validation,
 * and network error management for the weather API implementation.
 */

import { WeatherApiError, WeatherApiConfig } from './weatherTypes'

export class WeatherErrorHandler {
  /**
   * Handle and format API errors for user display.
   */
  static formatErrorForUser(error: unknown): {
    title: string
    message: string
    canRetry: boolean
    isConfigurationIssue: boolean
  } {
    if (error instanceof WeatherApiError) {
      switch (error.code) {
        case 1002:
          return {
            title: 'Configuration Error',
            message: 'Weather API key is missing. Please configure your API key.',
            canRetry: false,
            isConfigurationIssue: true
          }

        case 2006:
          return {
            title: 'Invalid API Key',
            message: 'The provided Weather API key is invalid. Please check your configuration.',
            canRetry: false,
            isConfigurationIssue: true
          }

        case 2007:
          return {
            title: 'API Quota Exceeded',
            message: 'Daily API call limit exceeded. Please try again tomorrow or upgrade your plan.',
            canRetry: false,
            isConfigurationIssue: false
          }

        case 2008:
          return {
            title: 'API Key Disabled',
            message: 'Your Weather API key has been disabled. Please contact support.',
            canRetry: false,
            isConfigurationIssue: true
          }

        case 1006:
          return {
            title: 'Location Not Found',
            message: 'The specified location could not be found. Please check your ZIP code configuration.',
            canRetry: true,
            isConfigurationIssue: true
          }

        case 1005:
          return {
            title: 'Invalid Request',
            message: 'The weather API request is malformed. This may be a temporary issue.',
            canRetry: true,
            isConfigurationIssue: false
          }

        default:
          if (error.type === 'NETWORK_ERROR') {
            return {
              title: 'Network Error',
              message: 'Unable to connect to weather service. Please check your internet connection.',
              canRetry: true,
              isConfigurationIssue: false
            }
          }

          if (error.type === 'TIMEOUT_ERROR') {
            return {
              title: 'Request Timeout',
              message: 'Weather service request timed out. Please try again.',
              canRetry: true,
              isConfigurationIssue: false
            }
          }

          return {
            title: 'Weather Service Error',
            message: error.message || 'An unexpected error occurred while fetching weather data.',
            canRetry: true,
            isConfigurationIssue: false
          }
      }
    }

    // Handle generic errors
    return {
      title: 'Unexpected Error',
      message: error instanceof Error ? error.message : 'An unknown error occurred.',
      canRetry: true,
      isConfigurationIssue: false
    }
  }

  /**
   * Log errors with appropriate detail level.
   */
  static logError(error: unknown, context: string): void {
    const timestamp = new Date().toISOString()
    const logEntry = {
      timestamp,
      context,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error
    }

    if (error instanceof WeatherApiError) {
      console.error(`[WeatherAPI Error] ${context}:`, {
        ...logEntry,
        code: error.code,
        type: error.type
      })
    } else {
      console.error(`[Weather Error] ${context}:`, logEntry)
    }
  }

  /**
   * Determine if an error is retryable.
   */
  static isRetryableError(error: unknown): boolean {
    if (error instanceof WeatherApiError) {
      // Don't retry configuration or quota issues
      const nonRetryableCodes = [1002, 2006, 2007, 2008]
      return !nonRetryableCodes.includes(error.code)
    }

    // Network and timeout errors are generally retryable
    return true
  }
}

export class WeatherConfigValidator {
  /**
   * Validate environment configuration for weather API.
   */
  static validateEnvironment(): {
    isValid: boolean
    errors: string[]
    warnings: string[]
  } {
    const errors: string[] = []
    const warnings: string[] = []

    // Check API key
    const apiKey = import.meta.env.VITE_WEATHER_API_KEY
    if (!apiKey) {
      errors.push('VITE_WEATHER_API_KEY environment variable is not set')
    } else if (apiKey === 'your_weatherapi_key_here') {
      errors.push('VITE_WEATHER_API_KEY is set to the default placeholder value')
    } else if (apiKey.length < 20) {
      warnings.push('VITE_WEATHER_API_KEY appears to be too short for a valid API key')
    }

    // Check ZIP code
    const zipCode = import.meta.env.VITE_ZIP_CODE
    if (!zipCode) {
      warnings.push('VITE_ZIP_CODE not set, using default location (49341)')
    } else if (!/^\d{5}(-\d{4})?$/.test(zipCode) && !/^[A-Z]\d[A-Z] \d[A-Z]\d$/.test(zipCode)) {
      warnings.push('VITE_ZIP_CODE format may not be valid (expected US ZIP or Canadian postal code)')
    }

    // Check environment setting
    const env = import.meta.env.VITE_BLIZZARD_ENV
    if (env && !['development', 'staging', 'production'].includes(env)) {
      warnings.push('VITE_BLIZZARD_ENV has unexpected value')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Validate API configuration object.
   */
  static validateConfig(config: Partial<WeatherApiConfig>): {
    isValid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    if (!config.apiKey) {
      errors.push('API key is required')
    }

    if (!config.baseUrl) {
      errors.push('Base URL is required')
    } else if (!config.baseUrl.startsWith('http')) {
      errors.push('Base URL must be a valid HTTP/HTTPS URL')
    }

    if (!config.zipCode) {
      errors.push('ZIP code is required')
    }

    if (config.timeout && (config.timeout < 1000 || config.timeout > 60000)) {
      errors.push('Timeout must be between 1000ms and 60000ms')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }
}

export class WeatherRetryManager {
  private static readonly MAX_RETRIES = 3
  private static readonly INITIAL_DELAY = 1000 // 1 second
  private static readonly MAX_DELAY = 10000 // 10 seconds

  /**
   * Execute a function with exponential backoff retry logic.
   */
  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: string = 'Weather API operation'
  ): Promise<T> {
    let lastError: unknown
    
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error
        
        WeatherErrorHandler.logError(error, `${context} (attempt ${attempt}/${this.MAX_RETRIES})`)

        // Don't retry if it's not a retryable error
        if (!WeatherErrorHandler.isRetryableError(error)) {
          throw error
        }

        // Don't wait after the last attempt
        if (attempt === this.MAX_RETRIES) {
          break
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.INITIAL_DELAY * Math.pow(2, attempt - 1),
          this.MAX_DELAY
        )

        console.log(`Retrying ${context} in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    // All retries failed
    throw lastError
  }
}

export class WeatherDataValidator {
  /**
   * Validate weather API response data.
   */
  static validateApiResponse(data: any): {
    isValid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    if (!data) {
      errors.push('Response data is null or undefined')
      return { isValid: false, errors }
    }

    // Check location data
    if (!data.location) {
      errors.push('Location data is missing')
    } else {
      if (!data.location.name) errors.push('Location name is missing')
      if (typeof data.location.lat !== 'number') errors.push('Location latitude is invalid')
      if (typeof data.location.lon !== 'number') errors.push('Location longitude is invalid')
    }

    // Check current weather data
    if (!data.current) {
      errors.push('Current weather data is missing')
    } else {
      if (typeof data.current.temp_f !== 'number') errors.push('Current temperature is invalid')
      if (typeof data.current.wind_mph !== 'number') errors.push('Current wind speed is invalid')
      if (typeof data.current.vis_miles !== 'number') errors.push('Current visibility is invalid')
    }

    // Check forecast data
    if (!data.forecast || !data.forecast.forecastday || !Array.isArray(data.forecast.forecastday)) {
      errors.push('Forecast data is missing or invalid')
    } else if (data.forecast.forecastday.length === 0) {
      errors.push('Forecast data is empty')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Validate processed weather data.
   */
  static validateProcessedData(data: any): {
    isValid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    if (!data) {
      errors.push('Processed data is null or undefined')
      return { isValid: false, errors }
    }

    // Check required numeric fields
    const requiredNumbers = [
      'average_snow_probability',
      'temp_min',
      'temp_max',
      'avg_temperature',
      'wind_peak',
      'avg_wind_speed'
    ]

    for (const field of requiredNumbers) {
      if (typeof data[field] !== 'number' || isNaN(data[field])) {
        errors.push(`Field '${field}' is missing or not a valid number`)
      }
    }

    // Check probability ranges
    if (data.average_snow_probability < 0 || data.average_snow_probability > 100) {
      errors.push('Average snow probability must be between 0 and 100')
    }

    // Check temperature reasonableness (for continental US)
    if (data.temp_min < -50 || data.temp_min > 120) {
      errors.push('Minimum temperature is outside reasonable range')
    }

    if (data.temp_max < -50 || data.temp_max > 120) {
      errors.push('Maximum temperature is outside reasonable range')
    }

    // Check alerts format
    if (data.alerts && !Array.isArray(data.alerts)) {
      errors.push('Alerts must be an array')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }
}

/**
 * Default error messages for common scenarios.
 */
export const DEFAULT_ERROR_MESSAGES = {
  NETWORK_UNAVAILABLE: 'Weather service is currently unavailable. Using cached data.',
  API_KEY_INVALID: 'Weather API key is invalid. Please check your configuration.',
  LOCATION_INVALID: 'Location not found. Please check your ZIP code setting.',
  QUOTA_EXCEEDED: 'Daily weather API limit reached. Service may be limited.',
  GENERIC_ERROR: 'Unable to fetch current weather data. Using fallback information.'
} as const