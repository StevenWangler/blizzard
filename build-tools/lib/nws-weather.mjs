import { readResponseJson } from './bounded-response.mjs'

// Rockford 49341, NWS Grand Rapids. The hourly feed has no snowfall totals or pavement observations.
const hourlyUrl = 'https://api.weather.gov/gridpoints/GRR/44,54/forecast/hourly'
const alertsUrl = 'https://api.weather.gov/alerts/active?point=43.1152,-85.5136'
export async function nwsRockfordWeather(targetDate, transport = fetch, now = Date.now()) {
  async function get(url) {
    const response = await transport(url, {
      headers: { 'User-Agent': 'Blizzard forecast (https://www.blizzardbot.ai)', Accept: 'application/geo+json' },
      signal: AbortSignal.timeout(15000)
    })
    if (!response.ok) throw new Error('National Weather Service returned HTTP ' + response.status)
    return readResponseJson(response)
  }
  const [forecast, alerts] = await Promise.all([get(hourlyUrl), get(alertsUrl)])
  const { updateTime, periods } = forecast.properties
  const age = now - Date.parse(updateTime)
  if (!Number.isFinite(age) || age < -900000 || age > 86400000) throw new Error('NWS hourly forecast is stale')
  const days = new Map()
  for (const period of periods) {
    // NWS timestamps for this grid carry the district UTC offset. Keep the local hours intact.
    if (!/^\d{4}-\d\d-\d\dT\d\d:00:00-0[45]:00$/.test(period.startTime)) throw new Error('Unexpected NWS district hour')
    const date = period.startTime.slice(0, 10)
    if (date > targetDate) break
    if (period.temperatureUnit !== 'F' || !Number.isFinite(period.temperature)) throw new Error('NWS temperature unavailable')
    const speed = /^(\d+(?:\.\d+)?) mph$/.exec(period.windSpeed)
    const hour = { time: period.startTime.slice(0,16).replace('T',' '), temp_f: period.temperature,
      condition: { text: period.shortForecast }, wind: period.windSpeed, wind_dir: period.windDirection,
      precipitation_probability_pct: period.probabilityOfPrecipitation?.value }
    if (speed) hour.wind_mph = Number(speed[1])
    if (!days.has(date)) days.set(date, [])
    days.get(date).push(hour)
  }
  const hours = new Set(days.get(targetDate)?.map(h => h.time))
  if (hours.size !== 24) throw new Error('NWS target-day coverage incomplete')
  const forecastday = [...days].map(([date,hour]) => {
    const temps = hour.map(h => h.temp_f)
    return { date, hour, day: { mintemp_f: Math.min(...temps), maxtemp_f: Math.max(...temps) } }
  })
  return { location: { name: 'Rockford', region: 'Michigan', tz_id: 'America/Detroit' },
    source: { forecast: hourlyUrl, updatedAt: updateTime }, forecast: { forecastday },
    alerts: { alert: alerts.features.map(({ properties: a }) => ({ event: a.event, headline: a.headline,
      severity: a.severity, areas: a.areaDesc, effective: a.effective, expires: a.expires, desc: a.description })) } }
}
