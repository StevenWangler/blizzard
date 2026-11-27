import { readOutcomeProbability } from '@/services/outcomes'
const districtZone = 'America/Detroit'

export function schoolDateLabel(targetDate?: string, includeYear = false): string {
  if (!targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return 'School-morning outlook'
  const date = new Date(`${targetDate}T12:00:00Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== targetDate) return 'School-morning outlook'
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric', ...(includeYear ? { year: 'numeric' as const } : {}), timeZone: districtZone }).format(date)
}

export function forecastFreshness(timestamp?: string, targetDate?: string, now = new Date()): 'current' | 'archived' | 'unknown' {
  const generated = timestamp ? new Date(timestamp).getTime() : NaN
  if (!Number.isFinite(generated) || generated > now.getTime() + 15 * 60_000) return 'unknown'
  const parts = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: districtZone }).formatToParts(now)
  const part = (type: string) => parts.find(value => value.type === type)?.value
  const today = `${part('year')}-${part('month')}-${part('day')}`
  const validTarget = schoolDateLabel(targetDate) !== 'School-morning outlook'
  if (now.getTime() - generated > 24 * 60 * 60_000) return 'archived'
  if (!validTarget) return 'unknown'
  return targetDate! < today ? 'archived' : 'current'
}

export function studentOutlook(probability: number | null) {
  if (probability === null) return { headline: 'Chance unavailable', takeaway: 'Check the district’s announcements for school status.' }
  if (probability >= 70) return { headline: 'Snow day likely', takeaway: 'Check the district’s announcements before changing your plans.' }
  if (probability >= 30) return { headline: 'Snow day possible', takeaway: 'Plan for school and check for updates.' }
  return { headline: 'Snow day unlikely', takeaway: 'Plan for school and check the district’s announcements.' }
}
import type { AgentPrediction, MorningWeather } from '@/types/agentPrediction'


export function forecastUpdateLabel(timestamp?: string, includeYear = false): string {
  const date = timestamp ? new Date(timestamp) : null
  if (!date || !Number.isFinite(date.getTime())) return 'Update time unavailable'
  return date.toLocaleString('en-US', { ...(includeYear ? { year: 'numeric' as const } : {}), month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: districtZone, timeZoneName: 'short' })
}

export function reportWeather(prediction: AgentPrediction | null): MorningWeather {
  if (prediction?.architecture === 'single-forecaster-v1') return prediction.morningWeather
  const weather = prediction?.meteorology
  const kind = weather?.precipitation_analysis?.precipitation_type
  return {
    snowInches: weather?.precipitation_analysis?.total_snowfall_inches ?? null,
    overnightLowF: weather?.temperature_analysis?.overnight_low_f ?? null,
    overnightFeelsLikeF: weather?.temperature_analysis?.overnight_feels_like_f ?? null,
    morningHighF: weather?.temperature_analysis?.morning_high_f ?? null,
    maxWindMph: weather?.wind_analysis?.max_wind_speed_mph ?? null,
    minVisibilityMiles: weather?.visibility_analysis?.minimum_visibility_miles ?? null,
    iceType: kind === 'freezing_rain' || kind === 'sleet' ? kind : null,
    alerts: weather?.alert_summary?.map(a => `${a.type}: ${a.description}`) ?? []
  }
}

/** One plain weather fact from the report; this never changes its probability. */
export function forecastReason(prediction: AgentPrediction | null): string {
  const { iceType, snowInches: snow, overnightLowF: low, maxWindMph: wind, morningHighF } = reportWeather(prediction)
  const amount = (value: number) => Number(value.toFixed(1))
  if (iceType === 'freezing_rain') return 'Freezing rain expected.'
  if (iceType === 'sleet') return 'Sleet expected.'
  if (typeof snow === 'number' && Number.isFinite(snow) && snow > 0) return `${amount(snow)} in of snow expected.`
  if (typeof low === 'number' && Number.isFinite(low) && low <= 20) return `Overnight low of ${amount(low)}°F.`
  if (typeof wind === 'number' && Number.isFinite(wind) && wind >= 25) return `Winds up to ${amount(wind)} mph.`
  if (snow === 0) return 'No snow expected.'
  if (typeof morningHighF === 'number' && Number.isFinite(morningHighF)) {
    return prediction?.architecture === 'single-forecaster-v1'
      ? `High of ${amount(morningHighF)}°F during the morning bus run.`
      : `Morning high of ${amount(morningHighF)}°F.`
  }
  return 'Weather summary unavailable.'
}

/** Saved metadata needs an exact calendar date and a numeric estimate. */
export function forecastMetadata(record: Record<string, unknown>) {
  const date = typeof record.targetDate === 'string' ? record.targetDate : ''
  const final = record.final && typeof record.final === 'object' ? record.final as Record<string, unknown> : null
  const modelPrediction = readOutcomeProbability(record.probability ?? final?.snow_day_probability)
  if (schoolDateLabel(date) === 'School-morning outlook' || modelPrediction === null) return null
  const confidence = record.confidence ?? final?.confidence_level
  return { date, modelPrediction, confidence: typeof confidence === 'string' ? confidence : null }
}
