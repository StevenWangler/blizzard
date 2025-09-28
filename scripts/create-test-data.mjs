#!/usr/bin/env node

/**
 * Test Script for Snow Day Agent System
 * 
 * Creates mock data to test the frontend components and system integration
 * without requiring actual API keys.
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

// Mock agent prediction data
const mockPrediction = {
  meteorology: {
    temperature_analysis: {
      current_temp_f: 28,
      overnight_low_f: 22,
      morning_high_f: 31,
      freezing_hours: 12,
      temperature_trend: "rising",
      windchill_factor: 15
    },
    precipitation_analysis: {
      snow_probability_overnight: 85,
      snow_probability_morning: 70,
      total_snowfall_inches: 4.2,
      snowfall_rate_peak: 1.5,
      precipitation_type: "snow"
    },
    wind_analysis: {
      max_wind_speed_mph: 25,
      wind_direction: "NW",
      sustained_winds_mph: 18,
      wind_chill_impact: true
    },
    visibility_analysis: {
      minimum_visibility_miles: 0.5,
      avg_visibility_miles: 1.2,
      visibility_factors: ["Heavy snow", "Blowing snow", "Reduced daylight"]
    },
    alert_summary: [
      {
        type: "Winter Storm Warning",
        severity: "High",
        description: "Heavy snow expected with 4-6 inches accumulation"
      },
      {
        type: "Wind Chill Advisory",
        severity: "Moderate", 
        description: "Wind chill values as low as -5°F"
      }
    ],
    overall_conditions_summary: "A significant winter storm is approaching with heavy snow, strong winds, and dangerous wind chills. Travel will become increasingly difficult through the evening and overnight hours."
  },
  history: {
    similar_weather_patterns: [
      {
        pattern_description: "February 2019 winter storm with similar temperature and wind patterns",
        historical_snow_day_rate: 92,
        confidence_level: "high"
      },
      {
        pattern_description: "January 2021 storm with comparable snowfall amounts",
        historical_snow_day_rate: 88,
        confidence_level: "high"
      }
    ],
    seasonal_context: {
      typical_conditions_for_date: "Mid-winter conditions are typical for this time of year with temperatures in the 20s-30s",
      unusual_factors: ["Storm intensity above average", "Extended duration of snowfall"],
      seasonal_probability_adjustment: 5
    },
    location_specific_factors: {
      local_microclimates: ["Lake effect enhancement possible", "Urban heat island minimal impact"],
      infrastructure_considerations: ["School bus routes include rural roads", "Several hills on main transportation routes"],
      elevation_impact: "Slight elevation differences may result in 0.5-1 inch additional accumulation in higher areas"
    },
    confidence_assessment: "High confidence based on similar historical patterns and strong meteorological signals"
  },
  safety: {
    road_conditions: {
      primary_roads_score: 4,
      secondary_roads_score: 2,
      parking_lots_score: 3,
      ice_formation_risk: "high"
    },
    travel_safety: {
      walking_conditions_score: 3,
      driving_conditions_score: 2,
      public_transport_impact: "significant",
      emergency_access_concern: true
    },
    timing_analysis: {
      worst_conditions_start_time: "10:00 PM tonight",
      worst_conditions_end_time: "8:00 AM tomorrow",
      morning_commute_impact: "severe",
      afternoon_impact: "moderate"
    },
    safety_recommendations: [
      "Avoid all non-essential travel during overnight hours",
      "Allow extra time for morning commute if travel is necessary",
      "Ensure emergency supplies are available",
      "Check on elderly neighbors and relatives",
      "Keep vehicles fueled and winter emergency kit stocked"
    ],
    risk_level: "high"
  },
  final: {
    snow_day_probability: 88,
    confidence_level: "high",
    primary_factors: [
      "4+ inches of snow accumulation expected",
      "Strong winds creating blowing/drifting snow",
      "Dangerous wind chill values",
      "Peak impact during morning commute hours",
      "Secondary road conditions will be poor"
    ],
    timeline: {
      conditions_start: "9:00 PM tonight",
      peak_impact_time: "3:00 AM - 7:00 AM tomorrow",
      conditions_improve: "10:00 AM tomorrow"
    },
    decision_rationale: "The combination of heavy snowfall (4+ inches), strong winds causing blowing snow, dangerous wind chills, and the timing of worst conditions during the morning commute creates a high-risk situation for school transportation. Historical patterns with similar conditions have resulted in snow days 88-92% of the time. The safety risks for students, staff, and bus drivers outweigh the educational benefits of remaining open.",
    alternative_scenarios: [
      {
        scenario: "Storm tracks further south - reduced snowfall",
        probability: 20,
        impact: "Would reduce snow day probability to 60-70%"
      },
      {
        scenario: "Wind speeds lower than forecast",
        probability: 25,
        impact: "Would improve visibility but still likely snow day due to accumulation"
      }
    ],
    recommendations: {
      for_schools: [
        "Make snow day decision by 8:00 PM tonight",
        "Notify families and staff as early as possible",
        "Prepare remote learning materials if policy requires",
        "Coordinate with transportation department on bus route assessments",
        "Monitor conditions for potential early dismissal Wednesday if storm lingers"
      ],
      for_residents: [
        "Complete any necessary errands before 9:00 PM tonight",
        "Prepare for potential power outages",
        "Ensure adequate food, water, and medication supplies",
        "Charge electronic devices and have backup lighting ready",
        "Plan to stay home tomorrow morning unless absolutely necessary"
      ],
      for_authorities: [
        "Pre-position snow removal equipment",
        "Coordinate with emergency services for potential increased call volume",
        "Issue travel advisories for tomorrow morning",
        "Prepare warming centers if extended power outages occur",
        "Monitor road conditions and adjust plowing priorities"
      ]
    },
    updates_needed: true,
    next_evaluation_time: "6:00 AM tomorrow for potential early dismissal assessment"
  },
  timestamp: "2024-01-15T18:30:00.000Z",
  location: "Rockford, Michigan",
  raw_weather_data: {
    location: {
      name: "Rockford",
      region: "Michigan",
      country: "United States",
      lat: 43.12,
      lon: -85.69,
      tz_id: "America/Detroit",
      localtime_epoch: 1705345800,
      localtime: "2024-01-15 13:30"
    },
    current: {
      temp_f: 28,
      condition: {
        text: "Light Snow",
        icon: "//cdn.weatherapi.com/weather/64x64/day/326.png",
        code: 1213
      },
      wind_mph: 12,
      precip_in: 0.1,
      humidity: 78,
      cloud: 90
    }
  }
}

const mockSummary = {
  probability: mockPrediction.final.snow_day_probability,
  confidence: mockPrediction.final.confidence_level,
  primary_factors: mockPrediction.final.primary_factors,
  decision_rationale: mockPrediction.final.decision_rationale,
  timestamp: mockPrediction.timestamp,
  location: mockPrediction.location
}

console.log('🧪 Creating test prediction data...')

// Ensure output directory exists
const outputDir = join(projectRoot, 'public', 'data')
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true })
  console.log(`📁 Created output directory: ${outputDir}`)
}

// Write mock data
const predictionPath = join(outputDir, 'prediction.json')
const summaryPath = join(outputDir, 'summary.json')

writeFileSync(predictionPath, JSON.stringify(mockPrediction, null, 2))
writeFileSync(summaryPath, JSON.stringify(mockSummary, null, 2))

console.log('✅ Test prediction data created successfully!')
console.log(`📄 Prediction saved to: ${predictionPath}`)
console.log(`📊 Summary saved to: ${summaryPath}`)
console.log(`🎯 Snow day probability: ${mockPrediction.final.snow_day_probability}%`)
console.log(`🔍 Confidence: ${mockPrediction.final.confidence_level}`)
console.log(`📍 Location: ${mockPrediction.location}`)
console.log('')
console.log('🚀 You can now run the development server to test the frontend:')
console.log('   npm run dev')
console.log('')
console.log('The EnhancedPredictionView will display the AI agent analysis!')