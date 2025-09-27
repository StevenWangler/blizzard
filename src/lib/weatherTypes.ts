/**
 * Weather API Types and Interfaces
 * 
 * Comprehensive TypeScript interfaces for WeatherAPI.com responses
 * and processed weather data used by the snow day prediction system.
 */

// Base WeatherAPI.com response interfaces
export interface Location {
  name: string
  region: string
  country: string
  lat: number
  lon: number
  tz_id: string
  localtime_epoch: number
  localtime: string
}

export interface WeatherCondition {
  text: string
  icon: string
  code: number
}

export interface CurrentWeather {
  last_updated_epoch: number
  last_updated: string
  temp_c: number
  temp_f: number
  is_day: number
  condition: WeatherCondition
  wind_mph: number
  wind_kph: number
  wind_degree: number
  wind_dir: string
  pressure_mb: number
  pressure_in: number
  precip_mm: number
  precip_in: number
  humidity: number
  cloud: number
  feelslike_c: number
  feelslike_f: number
  windchill_c: number
  windchill_f: number
  heatindex_c: number
  heatindex_f: number
  dewpoint_c: number
  dewpoint_f: number
  vis_km: number
  vis_miles: number
  uv: number
  gust_mph: number
  gust_kph: number
}

export interface HourlyWeather {
  time_epoch: number
  time: string
  temp_c: number
  temp_f: number
  is_day: number
  condition: WeatherCondition
  wind_mph: number
  wind_kph: number
  wind_degree: number
  wind_dir: string
  pressure_mb: number
  pressure_in: number
  precip_mm: number
  precip_in: number
  snow_cm: number
  humidity: number
  cloud: number
  feelslike_c: number
  feelslike_f: number
  windchill_c: number
  windchill_f: number
  heatindex_c: number
  heatindex_f: number
  dewpoint_c: number
  dewpoint_f: number
  will_it_rain: number
  chance_of_rain: number
  will_it_snow: number
  chance_of_snow: number
  vis_km: number
  vis_miles: number
  gust_mph: number
  gust_kph: number
  uv: number
}

export interface DayWeather {
  maxtemp_c: number
  maxtemp_f: number
  mintemp_c: number
  mintemp_f: number
  avgtemp_c: number
  avgtemp_f: number
  maxwind_mph: number
  maxwind_kph: number
  totalprecip_mm: number
  totalprecip_in: number
  totalsnow_cm: number
  avgvis_km: number
  avgvis_miles: number
  avghumidity: number
  daily_will_it_rain: number
  daily_chance_of_rain: number
  daily_will_it_snow: number
  daily_chance_of_snow: number
  condition: WeatherCondition
  uv: number
}

export interface Astronomy {
  sunrise: string
  sunset: string
  moonrise: string
  moonset: string
  moon_phase: string
  moon_illumination: number
  is_moon_up: number
  is_sun_up: number
}

export interface WeatherAlert {
  headline: string
  msgtype: string
  severity: string
  urgency: string
  areas: string
  category: string
  certainty: string
  event: string
  note: string
  effective: string
  expires: string
  desc: string
  instruction: string
}

export interface AlertsResponse {
  alert: WeatherAlert[]
}

export interface ForecastDay {
  date: string
  date_epoch: number
  day: DayWeather
  astro: Astronomy
  hour: HourlyWeather[]
}

export interface ForecastResponse {
  forecastday: ForecastDay[]
}

// Main WeatherAPI.com API response interface
export interface WeatherApiResponse {
  location: Location
  current: CurrentWeather
  forecast: ForecastResponse
  alerts?: AlertsResponse
}

// Processed weather data interfaces for our application
export interface ProcessedHourlyData {
  [key: string]: number | string
}

export interface WeatherTrend {
  direction: 'increasing' | 'decreasing' | 'slightly increasing' | 'slightly decreasing' | 'steady'
  magnitude: number
}

export interface ProcessedWeatherData {
  // Time period metrics
  evening_data?: ProcessedHourlyData
  morning_data?: ProcessedHourlyData
  
  // Probability calculations
  average_snow_probability: number
  peak_snow_probability: number
  
  // Temperature analysis
  temp_trend: string
  temp_min: number
  temp_max: number
  avg_temperature: number
  windchill_min: number
  
  // Wind analysis
  wind_trend: string
  wind_peak: number
  avg_wind_speed: number
  wind_gust_max: number
  
  // Precipitation analysis
  total_precip: number
  total_snow_cm: number
  snow_accumulation_trend: string
  
  // Visibility analysis
  avg_visibility: number
  min_visibility: number
  visibility_trend: string
  
  // Weather alerts
  alerts: WeatherAlert[]
  alert_count: number
  
  // Location and time
  location: Location
  last_updated: string
  forecast_period: {
    start: string
    end: string
  }
}

// Configuration interfaces
export interface WeatherApiConfig {
  apiKey: string
  baseUrl: string
  zipCode: string
  timeout: number
}

export interface ProbabilityWeights {
  snow: number
  temperature: number
  wind: number
  visibility: number
  ground_conditions: number
}

export interface ThresholdValues {
  temperature: {
    critical: number  // Below this is very dangerous
    cold: number      // Below this affects travel
  }
  wind: {
    high: number      // Above this is dangerous
    moderate: number  // Above this affects travel
  }
  visibility: {
    poor: number      // Below this is dangerous
    moderate: number  // Below this affects travel
  }
  snow: {
    heavy: number     // Above this is heavy snow
    moderate: number  // Above this is moderate snow
  }
}

// Application-specific weather data (matching existing interface)
export interface WeatherData {
  temperature: number
  snowfall: number
  windSpeed: number
  visibility: number
  alerts: string[]
  modelProbability: number
  lastUpdated: string
}

// Error handling classes and interfaces
export class WeatherApiError extends Error {
  code: number
  type: 'NETWORK_ERROR' | 'API_ERROR' | 'VALIDATION_ERROR' | 'TIMEOUT_ERROR'

  constructor(
    code: number,
    message: string,
    type: 'NETWORK_ERROR' | 'API_ERROR' | 'VALIDATION_ERROR' | 'TIMEOUT_ERROR'
  ) {
    super(message)
    this.name = 'WeatherApiError'
    this.code = code
    this.type = type
  }
}

// Time period configuration for analysis
export interface TimePeriod {
  name: string
  start_hour: number
  end_hour: number
  description: string
}

export const DEFAULT_TIME_PERIODS: TimePeriod[] = [
  {
    name: 'evening',
    start_hour: 19,
    end_hour: 24,
    description: 'Evening commute and early evening hours'
  },
  {
    name: 'morning',
    start_hour: 0,
    end_hour: 8,
    description: 'Overnight and morning commute hours'
  },
  {
    name: 'school_hours',
    start_hour: 6,
    end_hour: 16,
    description: 'School day hours'
  }
]

export const DEFAULT_PROBABILITY_WEIGHTS: ProbabilityWeights = {
  snow: 0.35,
  temperature: 0.20,
  wind: 0.20,
  visibility: 0.15,
  ground_conditions: 0.10
}

export const DEFAULT_THRESHOLDS: ThresholdValues = {
  temperature: {
    critical: 20,
    cold: 32
  },
  wind: {
    high: 35,
    moderate: 20
  },
  visibility: {
    poor: 1,
    moderate: 5
  },
  snow: {
    heavy: 4,
    moderate: 1
  }
}