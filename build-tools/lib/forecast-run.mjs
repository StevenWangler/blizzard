import { AsyncLocalStorage } from 'node:async_hooks'
import { exactTargetForecast } from './forecast-integrity.mjs'

// WeatherAPI hour.time is local wall time, including across UTC date boundaries.
function previousDate(date) {
  return new Date(Date.parse(date + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10)
}

export function weatherPrompt(weather, date, daysAhead) {
  const target = exactTargetForecast(weather, date)
  const previous = weather.forecast.forecastday.find(day => day.date === previousDate(date))
  const hourly = [previous, target].flatMap(day => (day?.hour ?? []).map(hour => ({
    time: hour.time, temp_f: hour.temp_f, feelslike_f: hour.feelslike_f,
    condition: hour.condition?.text, snow_cm: hour.snow_cm, precip_mm: hour.precip_mm,
    chance_of_snow: hour.chance_of_snow, chance_of_rain: hour.chance_of_rain,
    precipitation_probability_pct: hour.precipitation_probability_pct, wind: hour.wind,
    wind_mph: hour.wind_mph, gust_mph: hour.gust_mph, wind_dir: hour.wind_dir, vis_miles: hour.vis_miles
  })))
  const current = weather.current && {
    last_updated: weather.current.last_updated, temp_f: weather.current.temp_f, feelslike_f: weather.current.feelslike_f,
    condition: weather.current.condition?.text, wind_mph: weather.current.wind_mph, vis_miles: weather.current.vis_miles
  }
  const targetDay = { mintemp_f: target.day.mintemp_f, maxtemp_f: target.day.maxtemp_f,
    totalsnow_cm: target.day.totalsnow_cm, totalprecip_mm: target.day.totalprecip_mm, condition: target.day.condition?.text }
  const alerts = (weather.alerts?.alert ?? []).map(({ event, headline, severity, areas, effective, expires, desc }) =>
    ({ event, headline, severity, areas, effective, expires, desc }))
  return `Weather for ${weather.location.name}, ${weather.location.region}. Target school date: ${date} (${daysAhead} days ahead). Hourly times are local.\n${JSON.stringify({ current, targetDay, hourly, alerts })}`
}

export function morningWeather(weather, date) {
  const previous = previousDate(date)
  const hours = new Map(weather.forecast.forecastday.flatMap(day => (day.hour ?? []).map(h => [h.time, h])))
  const samples = (day, start, end) => Array.from({ length: end - start + 1 }, (_, i) =>
    hours.get(`${day} ${String(start + i).padStart(2, '0')}:00`))
  const overnight = [...samples(previous, 21, 23), ...samples(date, 0, 5)]
  const morning = samples(date, 6, 8)
  const window = [...overnight, ...morning]
  function aggregate(rows, field, operation) {
    const values = rows.map(row => row?.[field])
    return values.every(Number.isFinite) ? operation(...values) : null
  }
  const conditions = window.map(h => h?.condition?.text ?? '').join(' ')
  return {
    snowInches: aggregate(window, 'snow_cm', (...v) => v.reduce((a, b) => a + b, 0) / 2.54),
    overnightLowF: aggregate(overnight, 'temp_f', Math.min),
    overnightFeelsLikeF: aggregate(overnight, 'feelslike_f', Math.min),
    morningHighF: aggregate(morning, 'temp_f', Math.max),
    maxWindMph: aggregate(window, 'wind_mph', Math.max),
    minVisibilityMiles: aggregate(window, 'vis_miles', Math.min),
    iceType: /freezing (?:rain|drizzle)/i.test(conditions) ? 'freezing_rain' : /sleet|ice pellets/i.test(conditions) ? 'sleet' : null,
    alerts: (weather.alerts?.alert ?? []).map(a => a.headline || a.event).filter(Boolean)
  }
}

export async function withForecastRetry(work, signal) {
  signal.throwIfAborted()
  try {
    return await work()
  } catch (error) {
    signal.throwIfAborted()
    const transient = error?.status === 429 || error?.status >= 500 ||
      ['ModelBehaviorError', 'MaxTurnsExceededError', 'ModelTimeoutError', 'APIConnectionError', 'APIConnectionTimeoutError'].includes(error?.name)
    if (!transient || error?.code === 'insufficient_quota') throw error
    return work()
  }
}

// Standard USD pricing, checked 2026-11-26. Unknown model/tier costs stay unpriced.
// https://developers.openai.com/api/docs/pricing
const rates = { 'gpt-5.2': [1.75, 0.175, 14], 'gpt-5.2-2025-12-11': [1.75, 0.175, 14] }
export function forecastMeter(transport = fetch) {
  const active = new AsyncLocalStorage()
  const attempts = []
  const containers = new Set()
  return {
    async attempt(agent, call) {
      const attempt = { role: agent.name, model: agent.model, effort: agent.modelSettings.reasoning?.effort, requests: [], status: 'failed' }
      attempts.push(attempt)
      return active.run(attempt, async () => {
        const result = await call()
        attempt.status = 'completed'
        return result
      })
    },
    // Read the raw non-streaming Responses usage before the Agents SDK can
    // discard an incomplete response. Each nested specialist has its own scope.
    async fetch(url, init) {
      const attempt = active.getStore()
      if (!attempt || !new URL(url instanceof Request ? url.url : url).pathname.endsWith('/responses')) return transport(url, init)
      const row = { usageKnown: false, estimatedUsd: 0 }
      attempt.requests.push(row)
      const response = await transport(url, init)
      row.httpStatus = response.status
      try {
        const data = await response.clone().json()
        const usage = data.usage
        if (!usage || !Number.isFinite(usage.input_tokens) || !Number.isFinite(usage.output_tokens)) return response
        row.model = data.model ?? attempt.model
        row.input = usage.input_tokens
        row.cached = usage.input_tokens_details?.cached_tokens ?? 0
        row.output = usage.output_tokens
        row.reasoning = usage.output_tokens_details?.reasoning_tokens ?? 0
        row.webSearches = 0
        row.codeInterpreterCalls = 0
        row.newContainers = 0
        let toolsPriced = true
        for (const item of data.output ?? []) {
          if (item.type === 'web_search_call') row.webSearches++
          if (item.type === 'code_interpreter_call') {
            row.codeInterpreterCalls++
            if (!item.container_id) toolsPriced = false
            else if (!containers.has(item.container_id)) {
              containers.add(item.container_id)
              row.newContainers++
            }
          }
        }
        const price = Object.hasOwn(rates, row.model) && rates[row.model]
        const standard = [undefined, null, 'auto', 'default'].includes(data.service_tier)
        const toolsUsd = row.webSearches * 0.01 + row.newContainers * 0.03
        row.estimatedUsd = toolsUsd
        if (price && standard) row.estimatedUsd += ((row.input - row.cached) * price[0] + row.cached * price[1] + row.output * price[2]) / 1e6
        row.usageKnown = Boolean(price && standard && toolsPriced)
      } catch {
        // Metering must not invalidate an otherwise usable model response.
      }
      return response
    },
    report() {
      const requests = attempts.flatMap(a => a.requests)
      const complete = attempts.every(a => a.requests.length > 0) && requests.every(r => r.usageKnown)
      const pricedUsd = Number(requests.reduce((sum, r) => sum + r.estimatedUsd, 0).toFixed(6))
      return { currency: 'USD', complete, estimatedUsd: complete ? pricedUsd : null, pricedUsd, modelRequests: requests.length, attempts }
    }
  }
}
