import type { AgentPrediction } from '@/types/agentPrediction'
import { reportWeather, forecastFreshness, forecastUpdateLabel, schoolDateLabel, studentOutlook } from './forecastPresentation'
import { normalizeProbability } from '@/services/outcomes'

export interface BroadcastFact { label: string; value: string }
export interface BroadcastSlide {
  id: 'opening' | 'outlook' | 'timing' | 'reasons' | 'closing'
  label: string
  title: string
  text: string
  facts: BroadcastFact[]
  duration: number
  probability?: number
}
export interface ForecastBroadcastModel {
  current: boolean
  slides: BroadcastSlide[]
  ticker: BroadcastFact[]
  districtNotes: string[]
}
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const amount = (value: number) => String(Number(value.toFixed(1)))

/** Structured report facts only. No invented hourly weather, school schedule or update time. */
export function buildForecastBroadcast(prediction: AgentPrediction | null, now = new Date()): ForecastBroadcastModel {
  const freshness = forecastFreshness(prediction?.timestamp, prediction?.targetDate, now)
  const current = freshness === 'current'
  const probability = current ? normalizeProbability(prediction?.final?.snow_day_probability) : null
  const date = schoolDateLabel(prediction?.targetDate, true)
  const validDate = date !== 'School-morning outlook'
  const weather = reportWeather(current ? prediction : null)
  const wind = weather.maxWindMph
  const timing: BroadcastFact[] = []
  if (finite(weather.overnightLowF)) timing.push({ label: 'Overnight low', value: `${amount(weather.overnightLowF)}°F` })
  if (finite(weather.morningHighF)) timing.push({ label: 'Morning high', value: `${amount(weather.morningHighF)}°F` })
  const reasons: BroadcastFact[] = []
  const snow = weather.snowInches
  if (finite(snow) && snow >= 0) reasons.push({ label: 'Snow expected', value: snow === 0 ? 'None' : `${amount(snow)} in` })
  else if (weather.iceType === 'freezing_rain') reasons.push({ label: 'Precipitation', value: 'Freezing rain' })
  else if (weather.iceType === 'sleet') reasons.push({ label: 'Precipitation', value: 'Sleet' })
  if (finite(wind) && wind >= 0) reasons.push({ label: 'Winds up to', value: `${amount(wind)} mph` })
  if (finite(weather.overnightFeelsLikeF)) reasons.push({ label: 'Overnight feels like', value: `${amount(weather.overnightFeelsLikeF)}°F` })
  // Ice must not disappear behind a zero snow total.
  if (weather.iceType === 'freezing_rain' && reasons[0]?.label === 'Snow expected') reasons[0] = { label: 'Precipitation', value: 'Freezing rain' }
  const districtNotes = current ? (prediction?.news?.school_district_signals?.official_announcements ?? []).filter((note): note is string => typeof note === 'string' && note.trim().length > 0) : []
  const title = !current ? freshness === 'archived' ? 'No forecast yet' : 'No current forecast' : studentOutlook(probability).headline
  const text = current ? probability === null ? 'No snow-day estimate has been posted for this date.' : 'Chance of a snow day. Forecast only; the district decides.' : freshness === 'archived' ? 'No forecast for the next school day yet.' : 'We can’t verify a current forecast date and time.'
  const slides: BroadcastSlide[] = [
    { id: 'opening', label: 'Local school outlook', title: 'Rockford, Michigan', text: 'Your snow-day forecast', facts: [], duration: 4000 },
    { id: 'outlook', label: current && validDate ? date : 'Rockford Public Schools', title, text, facts: [], ...(probability === null ? {} : { probability }), duration: 7000 },
  ]
  if (timing.length) slides.push({ id: 'timing', label: date, title: 'Overnight to morning', text: 'From the weather forecast in this report.', facts: timing, duration: 6000 })
  if (reasons.length) slides.push({ id: 'reasons', label: date, title: 'What’s behind it', text: 'Forecast conditions', facts: reasons.slice(0, 3), duration: 6000 })
  const closingFacts: BroadcastFact[] = []
  if (current) closingFacts.push({ label: 'Updated', value: forecastUpdateLabel(prediction?.timestamp, true) })
  else if (freshness === 'archived' && validDate) closingFacts.push({ label: 'Last forecast', value: date })
  slides.push({ id: 'closing', label: 'Rockford Public Schools', title: 'Before you head out', text: current ? 'Check the district’s announcements for school status.' : 'Check back for a new forecast. The district decides school closures.', facts: closingFacts, duration: timing.length || reasons.length ? 4000 : 9000 })
  const ticker: BroadcastFact[] = [{ label: 'Rockford', value: 'Michigan' }]
  if (current) {
    if (districtNotes.length) ticker.push({ label: 'District note in report', value: districtNotes.join(' • ') })
    ticker.push({ label: 'School date', value: date }, { label: 'Snow day', value: probability === null ? 'Chance unavailable' : `${probability}% chance` })
    if (reasons[0]) ticker.push(reasons[0])
    ticker.push({ label: 'Updated', value: forecastUpdateLabel(prediction?.timestamp) }, { label: 'Forecast only', value: 'District decides' })
  } else {
    ticker.push({ label: 'Snow day', value: freshness === 'archived' ? 'No forecast for the next school day yet' : 'No verified current forecast' })
    if (freshness === 'archived' && validDate) ticker.push({ label: 'Last forecast', value: date })
    ticker.push({ label: 'School status', value: 'Check district announcements' })
  }
  return { current, slides, ticker, districtNotes }
}

export function broadcastStep(index: number, direction: number, count: number) {
  return Math.max(0, Math.min(count - 1, index + direction))
}
