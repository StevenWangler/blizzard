/**
 * Weather API Test Script
 * 
 * Tests the weather API implementation with various scenarios
 * including mock data fallback, configuration validation, and error handling.
 */

import { WeatherService } from './weather'
import { WeatherAPI } from './weatherApi'
import { 
  WeatherConfigValidator, 
  WeatherErrorHandler, 
  WeatherDataValidator 
} from './weatherErrorHandling'

/**
 * Test the weather API configuration and basic functionality.
 */
export async function testWeatherAPI() {
  console.log('🌨️ Weather API Test Suite Starting...\n')

  // Test 1: Configuration Validation
  console.log('📋 Test 1: Configuration Validation')
  const configValidation = WeatherConfigValidator.validateEnvironment()
  console.log('Environment validation:', configValidation)
  
  if (!configValidation.isValid) {
    console.log('❌ Configuration issues found:', configValidation.errors)
    console.log('⚠️ Warnings:', configValidation.warnings)
  } else {
    console.log('✅ Configuration is valid')
    if (configValidation.warnings.length > 0) {
      console.log('⚠️ Warnings:', configValidation.warnings)
    }
  }
  console.log('')

  // Test 2: WeatherService Configuration Check
  console.log('🔧 Test 2: WeatherService Configuration Check')
  try {
    const serviceValidation = await WeatherService.validateConfiguration()
    console.log('Service validation:', serviceValidation)
    
    if (serviceValidation.isValid) {
      console.log('✅ Weather service is properly configured')
    } else {
      console.log('❌ Configuration issue:', serviceValidation.message)
    }
  } catch (error) {
    console.log('❌ Service validation failed:', error)
  }
  console.log('')

  // Test 3: Basic Weather Data Fetch
  console.log('🌦️ Test 3: Basic Weather Data Fetch')
  try {
    const startTime = Date.now()
    const weatherData = await WeatherService.getCurrentForecast()
    const endTime = Date.now()
    
    console.log('✅ Weather data fetched successfully in', endTime - startTime, 'ms')
    console.log('Weather summary:', {
      temperature: weatherData.temperature,
      snowfall: weatherData.snowfall,
      windSpeed: weatherData.windSpeed,
      visibility: weatherData.visibility,
      modelProbability: weatherData.modelProbability,
      alertCount: weatherData.alerts.length,
      lastUpdated: new Date(weatherData.lastUpdated).toLocaleString()
    })

    // Validate the returned data
    const dataValidation = WeatherDataValidator.validateProcessedData({
      average_snow_probability: weatherData.modelProbability,
      temp_min: weatherData.temperature - 5, // Estimate
      temp_max: weatherData.temperature + 5, // Estimate
      avg_temperature: weatherData.temperature,
      wind_peak: weatherData.windSpeed,
      avg_wind_speed: weatherData.windSpeed,
      alerts: weatherData.alerts
    })

    if (dataValidation.isValid) {
      console.log('✅ Returned data structure is valid')
    } else {
      console.log('❌ Data validation issues:', dataValidation.errors)
    }

  } catch (error) {
    console.log('❌ Weather data fetch failed:', error)
    const formattedError = WeatherErrorHandler.formatErrorForUser(error)
    console.log('User-friendly error:', formattedError)
  }
  console.log('')

  // Test 4: Direct browser access is intentionally unavailable.
  console.log('🌐 Test 4: Direct WeatherAPI Test')
  console.log('⏭️ Skipped: public clients never receive WeatherAPI credentials')
  console.log('')

  // Test 5: Error Handling Test
  console.log('🚨 Test 5: Error Handling Test')
  try {
    // Test with invalid API key
    const invalidWeatherAPI = new WeatherAPI('invalid_key_test', '00000')
    await invalidWeatherAPI.getForecast()
    console.log('❌ Should have failed with invalid API key')
  } catch (error) {
    console.log('✅ Error handling works correctly')
    const formattedError = WeatherErrorHandler.formatErrorForUser(error)
    console.log('Formatted error:', formattedError.title, '-', formattedError.message)
    console.log('Can retry:', formattedError.canRetry)
    console.log('Is config issue:', formattedError.isConfigurationIssue)
  }
  console.log('')

  console.log('🏁 Weather API Test Suite Complete!')
}

/**
 * Get detailed weather analysis for inspection.
 */
export async function getDetailedWeatherAnalysis() {
  try {
    console.log('📊 Fetching detailed weather analysis...')
    const analysis = await WeatherService.getDetailedWeatherAnalysis()
    console.log('Analysis complete. Keys available:', Object.keys(analysis))
    return analysis
  } catch (error) {
    console.log('❌ Failed to get detailed analysis:', error)
    return null
  }
}

// Export for use in other files
export { WeatherService, WeatherConfigValidator, WeatherErrorHandler }
