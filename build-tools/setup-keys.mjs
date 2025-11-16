#!/usr/bin/env node

/**
 * API Keys Setup Helper
 * 
 * This script helps you get and configure the API keys needed for the
 * AI agent snow day prediction system.
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

console.log('🔑 AI Agent System - API Keys Setup\n')

console.log('You need 2 API keys to run the AI agent system locally:\n')

console.log('1️⃣  OpenAI API Key (for AI agents)')
console.log('   • Go to: https://platform.openai.com/api-keys')
console.log('   • Sign up or log in to your OpenAI account')
console.log('   • Click "Create API key"')
console.log('   • Copy the key (starts with sk-)')
console.log('   • Cost: ~$0.01-0.10 per prediction\n')

console.log('2️⃣  WeatherAPI.com Key (for weather data)')
console.log('   • Go to: https://www.weatherapi.com/signup.aspx')
console.log('   • Sign up for a free account')
console.log('   • Get your API key from the dashboard')
console.log('   • Free tier: 1 million calls per month\n')

console.log('📝 How to add your keys:')
console.log('   1. Open the .env file in your project root')
console.log('   2. Replace "your_openai_api_key_here" with your OpenAI key')
console.log('   3. Replace "your_weatherapi_key_here" with your WeatherAPI key')
console.log('   4. Save the file\n')

// Check current .env status
try {
  const envPath = join(projectRoot, '.env')
  const envContent = readFileSync(envPath, 'utf8')
  
  const hasOpenAI = envContent.includes('OPENAI_API_KEY=') && !envContent.includes('your_openai_api_key_here')
  const hasWeather = envContent.includes('VITE_WEATHER_API_KEY=') && !envContent.includes('your_weatherapi_key_here')
  
  console.log('📊 Current Status:')
  console.log(`   OpenAI API Key: ${hasOpenAI ? '✅ Configured' : '❌ Not set'}`)
  console.log(`   Weather API Key: ${hasWeather ? '✅ Configured' : '❌ Not set'}`)
  
  if (hasOpenAI && hasWeather) {
    console.log('\n🎉 All API keys are configured!')
    console.log('\n🚀 You can now run real AI predictions:')
    console.log('   node build-tools/generate-prediction.mjs')
  } else {
    console.log('\n⚠️  Add your API keys to the .env file to enable real predictions.')
  }
  
} catch (error) {
  console.log('❌ Could not check .env file status')
}

console.log('\n🧪 Testing without API keys:')
console.log('   node build-tools/create-test-data.mjs  # Creates mock data')
console.log('   npm run dev                        # View in browser\n')

console.log('💡 The system works great with test data - try that first!')
console.log('   Get API keys only when you want real AI predictions.\n')