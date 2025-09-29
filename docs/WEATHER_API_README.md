# Weather API Implementation

This document provides comprehensive instructions for using the Weather API module in the Snow Day Predictor application. The implementation has been adapted from a Python-based system to work with the React + Vite architecture, providing real-time weather forecasting with specialized processing for snow day prediction.

## Overview

The Weather API implementation provides:
- Real-time weather data from WeatherAPI.com
- 48-hour weather forecasts with hourly detail
- Weather alerts and location validation
- Snow day probability calculations
- Comprehensive error handling and fallback systems
- Mock data support for development and testing

## Quick Start

### 1. Get a WeatherAPI Key

1. Sign up for a free account at [WeatherAPI.com](https://www.weatherapi.com/signup.aspx)
2. Get your API key from your [account dashboard](https://www.weatherapi.com/my/)
3. The free tier provides sufficient API calls for development and testing

### 2. Configure Environment Variables

Update your `.env` file in the project root:

```bash
# Required: Your WeatherAPI.com API key
VITE_WEATHER_API_KEY=your_actual_api_key_here

# Optional: Location (ZIP code for US, postal code for others)
VITE_ZIP_CODE=49341

# Optional: Environment setting
VITE_BLIZZARD_ENV=development
```

### 3. Restart Development Server

```bash
npm run dev
```

The application will automatically use real weather data when a valid API key is configured, or fall back to mock data for testing.

## Architecture

### Core Components

1. **WeatherAPI Class** (`src/lib/weatherApi.ts`)
   - Handles authentication and API communication
   - Provides methods for forecast, current weather, and alerts
   - Includes comprehensive error handling and validation

2. **Data Processing** (`src/lib/weatherProcessing.ts`)
   - Processes hourly forecast data for specific time periods
   - Calculates snow day probabilities using weighted factors
   - Analyzes weather trends and patterns

3. **Weather Service** (`src/lib/weather.ts`)
   - Main integration point with existing application
   - Provides unified interface for weather data
   - Handles fallback to mock data when needed

4. **Error Handling** (`src/lib/weatherErrorHandling.ts`)
   - Comprehensive error management and user-friendly messages
   - Configuration validation and retry logic
   - API response validation

5. **Type Definitions** (`src/lib/weatherTypes.ts`)
   - Complete TypeScript interfaces for all weather data
   - Configuration and error types
   - Default values and constants

## Usage Examples

### Basic Weather Data Fetch

```typescript
import { WeatherService } from '@/lib/weather'

// Get current weather forecast
const weatherData = await WeatherService.getCurrentForecast()

console.log(`Temperature: ${weatherData.temperature}°F`)
console.log(`Snow probability: ${weatherData.modelProbability}%`)
console.log(`Alerts: ${weatherData.alerts.length}`)
```

### Direct API Usage

```typescript
import { WeatherAPI } from '@/lib/weatherApi'

const weatherApi = new WeatherAPI()

// Get detailed forecast data
const forecast = await weatherApi.getForecast()

// Process alerts for specific location
const relevantAlerts = weatherApi.filterAlertsByLocation(
  forecast.alerts?.alert || [],
  forecast.location
)
```

### Advanced Data Processing

```typescript
import { getRelevantWeatherInformation } from '@/lib/weatherProcessing'

const forecast = await weatherApi.getForecast()
const processedData = getRelevantWeatherInformation(forecast)

console.log(`Average snow probability: ${processedData.average_snow_probability}%`)
console.log(`Temperature trend: ${processedData.temp_trend}`)
console.log(`Wind peak: ${processedData.wind_peak} mph`)
```

### Configuration Validation

```typescript
import { WeatherConfigValidator } from '@/lib/weatherErrorHandling'

const validation = WeatherConfigValidator.validateEnvironment()
if (!validation.isValid) {
  console.error('Configuration errors:', validation.errors)
}
```

## Configuration Options

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_WEATHER_API_KEY` | Yes | `your_weatherapi_key_here` | WeatherAPI.com API key |
| `VITE_ZIP_CODE` | No | `49341` | Location (ZIP/postal code) |
| `VITE_BLIZZARD_ENV` | No | `production` | Environment setting |

### Probability Weights

The system uses configurable weights for different weather factors in snow day calculations:

```typescript
const weights = {
  snow: 0.35,           // Snow probability and accumulation
  temperature: 0.20,    // Temperature and wind chill
  wind: 0.20,          // Wind speed and gusts
  visibility: 0.15,    // Visibility conditions
  ground_conditions: 0.10  // Humidity, pressure, etc.
}
```

### Threshold Values

```typescript
const thresholds = {
  temperature: {
    critical: 20,  // Below this is very dangerous (°F)
    cold: 32      // Below this affects travel (°F)
  },
  wind: {
    high: 35,      // Above this is dangerous (mph)
    moderate: 20   // Above this affects travel (mph)
  },
  visibility: {
    poor: 1,       // Below this is dangerous (miles)
    moderate: 5    // Below this affects travel (miles)
  }
}
```

## Error Handling

The system provides comprehensive error handling for various scenarios:

### API Errors

- **Invalid API Key**: Clear message with configuration instructions
- **Quota Exceeded**: Informative message about limits
- **Location Not Found**: Guidance on ZIP code configuration
- **Network Issues**: Automatic retry with exponential backoff

### Fallback Behavior

When the API is unavailable or not configured:
1. System logs the issue for debugging
2. Falls back to realistic mock data
3. User sees weather data without interruption
4. Debug panel shows configuration status

### Error Messages

```typescript
import { WeatherErrorHandler } from '@/lib/weatherErrorHandling'

try {
  const weather = await WeatherService.getCurrentForecast()
} catch (error) {
  const userError = WeatherErrorHandler.formatErrorForUser(error)
  console.log(userError.title, userError.message)
  
  if (userError.canRetry) {
    // Show retry button
  }
  
  if (userError.isConfigurationIssue) {
    // Show configuration help
  }
}
```

## Development and Testing

### Debug Panel

The application includes a debug panel (`WeatherDebugPanel` component) for testing:

1. Open the application at `http://localhost:5000`
2. Navigate to the "Accuracy" tab
3. Use the debug panel to:
   - Check configuration status
   - Run comprehensive tests
   - View detailed weather analysis
   - Test error handling

### Mock Data

When no API key is configured, the system uses realistic mock data:

```typescript
const mockScenarios = [
  {
    temperature: 18,
    snowfall: 6,
    windSpeed: 25,
    visibility: 0.5,
    alerts: ['Winter Storm Warning until 6 AM'],
    modelProbability: 85
  },
  // ... more scenarios
]
```

### Testing API Integration

```typescript
import { testWeatherAPI } from '@/lib/weatherTest'

// Run comprehensive test suite
await testWeatherAPI()
```

## API Reference

### WeatherAPI Class

#### Methods

- `getForecast()` - Get 2-day weather forecast with alerts
- `getCurrentWeather()` - Get current conditions only
- `getAlerts()` - Get weather alerts for location
- `searchLocations(query)` - Search for locations
- `validateApiKey()` - Test if API key is valid
- `filterAlertsByLocation(alerts, location)` - Filter relevant alerts

#### Configuration

```typescript
const config = {
  apiKey: 'your_api_key',
  baseUrl: 'https://api.weatherapi.com/v1',
  zipCode: '49341',
  timeout: 30000
}
```

### Data Processing Functions

- `getHourlyForecastData(hourlyData, startHour, endHour)` - Process hourly data for time periods
- `getRelevantWeatherInformation(forecastData)` - Main processing function
- `calculateTrend(values)` - Analyze data trends
- `categorizeSnowDayProbability(probability)` - Convert probability to categories

### Error Handling Utilities

- `WeatherErrorHandler.formatErrorForUser(error)` - User-friendly error messages
- `WeatherConfigValidator.validateEnvironment()` - Check configuration
- `WeatherRetryManager.executeWithRetry(operation)` - Retry with backoff
- `WeatherDataValidator.validateApiResponse(data)` - Validate API responses

## Integration with Existing Components

The weather API integrates seamlessly with existing components:

### PredictionView Component

```typescript
// Automatically uses WeatherService.getCurrentForecast()
// Updates weather theme based on conditions
// Shows real-time weather data and probabilities
```

### Weather Theme System

```typescript
// Automatically updates themes based on weather conditions
updateWeatherConditions(snowfall, windSpeed, visibility)
```

## Troubleshooting

### Common Issues

1. **"Weather API key not configured"**
   - Check `.env` file exists and has correct API key
   - Restart development server after changes

2. **"Invalid API key"**
   - Verify API key from WeatherAPI.com dashboard
   - Check for extra spaces or characters

3. **"Location not found"**
   - Verify ZIP code format (US: 12345, Canada: A1A 1A1)
   - Try using city name instead of ZIP code

4. **Network/timeout errors**
   - Check internet connection
   - WeatherAPI.com service status
   - Firewall/proxy settings

### Debug Information

Enable detailed logging by checking the browser console and the debug panel in the Accuracy tab.

### Getting Help

1. Check the debug panel for configuration status
2. Review browser console for detailed error messages
3. Verify WeatherAPI.com service status
4. Test with mock data to isolate issues

## Performance Considerations

- API calls are cached automatically by the browser
- Failed requests fall back to mock data immediately
- Retry logic prevents excessive API calls
- Hourly data processing is optimized for typical use cases

## Security Notes

- API keys are handled securely through environment variables
- No sensitive data is logged in production
- HTTPS is used for all API communications
- Location data is only used for weather requests

## Future Enhancements

Potential improvements for the weather API implementation:

1. **Caching Layer**: Add Redis or local storage caching for API responses
2. **Multiple Locations**: Support for multiple ZIP codes/locations
3. **Historical Data**: Integration with historical weather data
4. **Advanced Alerts**: More sophisticated alert filtering and processing
5. **Performance Monitoring**: Track API response times and success rates
6. **Offline Support**: Better offline functionality with cached data

## License and Attribution

This implementation uses data from WeatherAPI.com. Please ensure compliance with their terms of service and consider adding attribution as required by their free tier usage terms.

---

## Summary

The Weather API implementation provides a robust, production-ready system for integrating real weather data into the Snow Day Predictor application. It handles all aspects of weather data fetching, processing, and error management while maintaining compatibility with the existing application architecture.

Key benefits:
- ✅ Real-time weather data from a reliable API
- ✅ Sophisticated snow day probability calculations
- ✅ Comprehensive error handling and fallbacks
- ✅ Easy configuration and testing
- ✅ Full TypeScript support
- ✅ Production-ready architecture