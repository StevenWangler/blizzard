#!/usr/bin/env node

// Generates one validated school-day forecast locally or from GitHub Actions.

import { readFileSync, mkdirSync, writeFileSync, appendFileSync } from 'node:fs'
import { randomUUID, createHash } from 'node:crypto'
import OpenAI from 'openai'
import { forecastMeter, withForecastRetry, weatherPrompt, morningWeather } from './lib/forecast-run.mjs'
import { FinalPredictionSchema, validateFinal, exactTargetForecast, saveForecast, nextSchoolTarget } from './lib/forecast-integrity.mjs'
import { nwsRockfordWeather } from './lib/nws-weather.mjs'
import { readResponseJson } from './lib/bounded-response.mjs'
import { readLedger } from './lib/data-integrity.mjs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { config as loadEnv } from 'dotenv'
import { Agent, ModelBehaviorError, run as sdkRun, setTracingDisabled, setDefaultOpenAIClient, webSearchTool } from '@openai/agents'

// Load environment variables from .env file
loadEnv()

// __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const instructions = readFileSync(join(__dirname, '../src/services/prompts/forecaster.txt'), 'utf8')
const forecastModel = process.env.OPENAI_FORECAST_MODEL || process.env.OPENAI_FORECAST_COORDINATOR_MODEL || 'gpt-5.2'
// Default timezone for date calculations (keeps runs in sync with the district's local time)
const DEFAULT_TIMEZONE = process.env.VITE_TIMEZONE || process.env.TIMEZONE || 'America/Detroit'

// Parse command line arguments
const args = process.argv.slice(2)
const compare = args[0] === '--compare-reasoning' && args.length === 2
const scheduled = args.length === 1 && args[0] === '--scheduled'
const isLocalMode = args.length === 0 || (args.length === 1 && ['--local', '-l'].includes(args[0]))
if (!compare && !scheduled && !isLocalMode) throw new Error('Expected --local, --scheduled or --compare-reasoning <saved prediction.json>')
if (scheduled && (process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_REF !== 'refs/heads/main')) {
  throw new Error('Scheduled output requires the main-branch forecast action')
}

function isBlizzardActive(value) {
  if (!value) return true
  return !['0', 'false', 'no', 'off', 'disabled'].includes(String(value).trim().toLowerCase())
}

// A transient failure gets one retry within the original forecast deadline.
let generationSignal
let meter
async function run(agent, input) {
  return meter.attempt(agent, async () => {
    const result = await sdkRun(agent, input, { maxTurns: 4, signal: generationSignal })
    // The SDK validates structured output lazily. Attribute that failure to
    // this attempt while its retry and usage context are still available.
    let finalOutput
    try {
      finalOutput = result.finalOutput
    } catch {
      throw new ModelBehaviorError('Forecaster returned invalid structured output')
    }
    if (!finalOutput) throw new ModelBehaviorError('Forecaster returned no output')
    return { finalOutput }
  })
}

// Tracing is opt-in because it can retain provider/model context externally.
setTracingDisabled(process.env.ENABLE_AGENT_TRACING !== 'true')

console.log('🚀 Starting Snow Day Prediction Generator (OpenAI Agents SDK)...')
if (isLocalMode) {
  console.log('📦 Running in LOCAL mode - output will be saved to public/data/local/')
}

const blizzardActive = isBlizzardActive(process.env.BLIZZARD_ACTIVE ?? process.env.VITE_BLIZZARD_ACTIVE)

if (!blizzardActive && !compare) {
  console.log('🌼 Blizzard is in off-season mode. Skipping prediction generation.')
  process.exit(0)
}

// Check required environment variables
const requiredEnvVars = ['OPENAI_API_KEY']
const missingVars = requiredEnvVars.filter(varName => !process.env[varName])

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '))
  console.error('Please set the following environment variables:')
  missingVars.forEach(varName => {
    console.error(`  ${varName}`)
  })
  process.exit(1)
}

const projectRoot = join(__dirname, '..')

// Configuration - use local directory when in local mode
const appConfig = {
  weatherApiKey: process.env.WEATHER_API_KEY,
  zipCode: process.env.VITE_ZIP_CODE || '49341',
  timeZone: DEFAULT_TIMEZONE,
  outputDir: isLocalMode 
    ? join(projectRoot, 'public', 'data', 'local')
    : join(projectRoot, 'public', 'data'),
  outputFile: 'prediction.json'
}

console.log(`📍 Location: ${appConfig.zipCode}`)
if (!compare) console.log(`📂 Output: ${join(appConfig.outputDir, appConfig.outputFile)}`)
console.log(`⏱️ Timezone for scheduling: ${appConfig.timeZone}`)

// Weather API client for Node.js
class NodeWeatherAPI {
  constructor(apiKey, zipCode) {
    this.apiKey = apiKey
    this.zipCode = zipCode
    this.baseUrl = 'https://api.weatherapi.com/v1'
  }

  async getForecast(daysAhead = 2) {
    const url = new URL(`${this.baseUrl}/forecast.json`)
    url.searchParams.set('key', this.apiKey)
    url.searchParams.set('q', this.zipCode)
    url.searchParams.set('days', String(Math.min(daysAhead + 1, 14))) // Provider entitlement may reject a longer horizon; never substitute another date.
    url.searchParams.set('aqi', 'no')
    url.searchParams.set('alerts', 'yes')

    console.log(`🌤️  Fetching weather forecast for ${this.zipCode}...`)

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(15_000),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Weather provider request failed (HTTP ${response.status}); last valid forecast preserved`)
    }

    const data = await readResponseJson(response)
    console.log(`✅ Weather data retrieved for ${data.location.name}, ${data.location.region}`)
    return data
  }
}

async function runForecaster(weather, targetDate, daysAhead, issuedAt, trialEffort) {
  const frozen = trialEffort !== undefined
  const forecaster = new Agent({
    name: 'Blizzard Forecaster',
    model: forecastModel,
    instructions: instructions + (frozen ? '\nUse only the saved weather evidence. External conditions are unknown.' : ''),
    modelSettings: {
      maxTokens: 6000,
      reasoning: { effort: trialEffort ?? 'high' },
      ...(frozen ? {} : { providerData: { max_tool_calls: 3 } })
    },
    tools: frozen ? [] : [webSearchTool()],
    outputType: FinalPredictionSchema
  })
  const input = `Forecast issue time: ${issuedAt}\n${weatherPrompt(weather, targetDate, daysAhead)}`
  const result = await withForecastRetry(() => run(forecaster, input), generationSignal)
  return {
    architecture: 'single-forecaster-v1',
    final: validateFinal(result.finalOutput),
    evidenceTimestamp: issuedAt,
    timestamp: new Date().toISOString(),
    targetDate,
    targetDayName: new Date(targetDate + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }),
    daysAhead,
    location: `${weather.location.name}, ${weather.location.region}`,
    morningWeather: morningWeather(weather, targetDate),
    raw_weather_data: weather
  }
}

async function measuredRun(mode, metadata, work) {
  const id = randomUUID()
  const dir = join(projectRoot, 'logs', 'forecast-costs')
  mkdirSync(dir, { recursive: true })
  generationSignal = AbortSignal.timeout(8 * 60_000)
  meter = forecastMeter()
  let status = 'failed'
  try {
    const result = await work()
    status = 'completed'
    return result
  } finally {
    const report = { id, mode, architecture: 'single-forecaster-v1', ...metadata, timestamp: new Date().toISOString(), status, ...meter.report() }
    writeFileSync(join(dir, id + '.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
    if (process.env.GITHUB_STEP_SUMMARY) {
      const amount = report.complete ? 'Estimated USD ' : 'Partially priced, USD '
      appendFileSync(process.env.GITHUB_STEP_SUMMARY,
        `\n**Forecast API cost** · ${metadata.targetDate ?? 'unknown date'} · ${status} · ${amount}${report.pricedUsd.toFixed(4)} · ${report.modelRequests} requests\n`)
    }
    console.log(`Forecast cost (${mode}, ${status}): USD ${report.pricedUsd.toFixed(4)} ${report.complete ? 'estimated' : 'priced portion only'}; ${report.modelRequests} requests. Report: logs/forecast-costs/${id}.json`)
  }
}

async function compareReasoning(filename) {
  const snapshot = JSON.parse(readFileSync(filename, 'utf8'))
  const { raw_weather_data: weather, targetDate, daysAhead, evidenceTimestamp: timestamp = snapshot.timestamp } = snapshot
  exactTargetForecast(weather, targetDate)
  if (!Number.isFinite(Date.parse(timestamp)) || !Number.isInteger(daysAhead) || daysAhead < 1) {
    throw new Error('Comparison needs saved target weather, issue time and forecast horizon')
  }
  const comparisonId = randomUUID()
  const snapshotHash = createHash('sha256').update(JSON.stringify([timestamp, weatherPrompt(weather, targetDate, daysAhead)])).digest('hex')
  const failures = []
  for (const effort of ['high', 'low']) {
    const metadata = { targetDate, comparisonId, snapshotHash, sourceTimestamp: timestamp }
    try {
      await measuredRun('comparison-' + effort, metadata, async () => {
        const estimate = await runForecaster(weather, targetDate, daysAhead, timestamp, effort)
        metadata.probability = estimate.final.snow_day_probability
        metadata.confidence = estimate.final.confidence_level
        console.log(`Comparison (${effort}): ${metadata.probability}% for ${targetDate}`)
      })
    } catch {
      failures.push(effort)
    }
  }
  if (failures.length) throw new Error('Comparison incomplete')
}

async function main() {
  setDefaultOpenAIClient(new OpenAI({ maxRetries: 0, fetch: (...args) => meter.fetch(...args) }))
  if (compare) return compareReasoning(args[1])
  const metadata = {}
  return measuredRun(isLocalMode ? 'local' : 'scheduled', metadata, async () => {
    // Determine the next school day (skip weekends)
    const runTimestamp = new Date()
    const ledgerOptions = isLocalMode ? { fallbackFile: join(projectRoot, 'public/data/outcomes.json') } : {}
    const ledger = await readLedger(join(appConfig.outputDir, 'outcomes.json'), ledgerOptions)
    const { targetDate: nextSchoolDay, daysAhead } = nextSchoolTarget(runTimestamp, appConfig.timeZone,
      ledger.filter(row => row.noSchoolScheduled === true).map(row => row.date))
    const nextSchoolDayStr = nextSchoolDay.toISOString().split('T')[0]
    metadata.targetDate = nextSchoolDayStr
    const dayName = nextSchoolDay.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
    
    console.log(`📅 Next school day: ${dayName}, ${nextSchoolDayStr} (${daysAhead} day${daysAhead > 1 ? 's' : ''} ahead)`)
    
    if (!/^\d{5}$/.test(appConfig.zipCode)) throw new Error('ZIP code must contain five digits')
    if (daysAhead >= (appConfig.weatherApiKey ? 14 : 7)) {
      console.log('The next school morning is beyond the weather provider horizon. Keeping the last dated report.')
      return
    }

    let weatherData
    if (appConfig.weatherApiKey) {
      weatherData = await new NodeWeatherAPI(appConfig.weatherApiKey, appConfig.zipCode).getForecast(daysAhead)
    }
    if (!weatherData?.forecast?.forecastday?.some(day => day.date === nextSchoolDayStr)) {
      if (appConfig.zipCode !== '49341') throw new Error('Exact target weather unavailable for this ZIP')
      console.log('Using NWS Grand Rapids hourly weather for Rockford school buses.')
      weatherData = await nwsRockfordWeather(nextSchoolDayStr)
    }

    // Only record the issue time once the weather has been received.
    const prediction = await runForecaster(weatherData, nextSchoolDayStr, daysAhead, new Date().toISOString())

    await saveForecast(appConfig.outputDir, prediction, { fallbackLedger: ledgerOptions.fallbackFile })
    metadata.predictionTimestamp = prediction.timestamp
    metadata.probability = prediction.final.snow_day_probability
    console.log('✅ Validated forecast snapshot saved; deployment is a separate workflow.')

  })
}

// Generation never publishes. GitHub Actions owns the separately approved deployment.
main().catch(error => {
  console.error('Forecast stage failed:', error.name, error.status ?? '')
  console.error('Prediction generation failed; deployment was not attempted.')
  process.exitCode = 1
})
