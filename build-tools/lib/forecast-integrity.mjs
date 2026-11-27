import { z } from 'zod'
import { boundedJson } from './input-limits.mjs'
import { calendarDate, assertTimestamp, probability, readLedger, atomicJsonBatch, withDataLock, upsertLedger } from './data-integrity.mjs'
import { join } from 'node:path'

export const FinalPredictionSchema = z.object({
  snow_day_probability: z.number().int().finite().min(0).max(100),
  confidence_level: z.enum(['very_low', 'low', 'moderate', 'high', 'very_high']),
  primary_factors: z.array(z.string().min(1)).min(1),
  timeline: z.object({ conditions_start: z.string(), peak_impact_time: z.string(), conditions_improve: z.string() }),
  decision_rationale: z.string().min(1),
  alternative_scenarios: z.array(z.object({ scenario: z.string(), probability: z.number().finite().min(0).max(100), impact: z.string() })),
  recommendations: z.object({ for_schools: z.array(z.string()), for_residents: z.array(z.string()), for_authorities: z.array(z.string()) }),
  updates_needed: z.boolean(),
  next_evaluation_time: z.string()
})

export function validateFinal(value) {
  const parsed = FinalPredictionSchema.safeParse(boundedJson(value))
  if (!parsed.success) throw new Error('Forecast output failed validation; last valid forecast preserved')
  return parsed.data
}

export function exactTargetForecast(weather, date) {
  calendarDate(date)
  if (!weather?.location?.name || !weather?.location?.region) throw new Error('Weather location unavailable')
  const matches = weather.forecast?.forecastday?.filter(day => day.date === date) ?? []
  if (matches.length !== 1) throw new Error('Exact target-date weather unavailable; last valid forecast preserved')
  const target = matches[0]
  if (!target.day || !Array.isArray(target.hour) || target.hour.length === 0) throw new Error('Target-date weather is incomplete')
  return target
}

export function pendingOutcome(ledger, prediction) {
  const existing = ledger.find(row => row.date === prediction.targetDate)
  // A scheduled holiday has null actualSnowDay too, but is finalized, not pending.
  if (existing && (existing.actualSnowDay !== null || existing.noSchoolScheduled === true)) return ledger
  const refreshed = {
    ...existing, date: prediction.targetDate, modelProbability: prediction.final.snow_day_probability,
    confidence: prediction.final.confidence_level, predictionTimestamp: prediction.timestamp,
    predictionSource: 'saved', actualSnowDay: null, recordedAt: prediction.timestamp,
    recordedBy: 'system', source: 'prediction'
  }
  delete refreshed.predictionCommit
  return upsertLedger(ledger, refreshed)
}

export async function saveForecast(dir, prediction, { allowMissingLedger = false, fallbackLedger } = {}) {
  calendarDate(prediction.targetDate)
  assertTimestamp(prediction.timestamp)
  const final = validateFinal(prediction.final)
  probability(final.snow_day_probability, { optional: false, stored: true })
  exactTargetForecast(prediction.raw_weather_data, prediction.targetDate)
  const summary = {
    ...(prediction.architecture ? { architecture: prediction.architecture } : {}),
    probability: final.snow_day_probability, confidence: final.confidence_level,
    primary_factors: final.primary_factors, decision_rationale: final.decision_rationale,
    timestamp: prediction.timestamp, targetDate: prediction.targetDate,
    targetDayName: prediction.targetDayName, daysAhead: prediction.daysAhead, location: prediction.location,
    collaboration: prediction.collaboration ? {
      rounds: prediction.collaboration.totalRounds, consensus: prediction.collaboration.finalConsensus,
      exitReason: prediction.collaboration.exitReason, summary: prediction.collaboration.collaborationSummary
    } : null
  }
  await withDataLock(dir, async () => {
    // Validate the entire existing ledger before changing any snapshot file.
    const ledger = await readLedger(join(dir, 'outcomes.json'), { allowMissing: allowMissingLedger, fallbackFile: fallbackLedger })
    const next = pendingOutcome(ledger, prediction)
    await atomicJsonBatch([
      [join(dir, 'prediction.json'), { ...prediction, final }],
      [join(dir, 'summary.json'), summary],
      [join(dir, 'outcomes.json'), next]
    ])
  })
}

// Published full days off. Early-release days remain eligible.
// https://www.rockfordschools.org/district-calendar/
// https://www.rockfordschools.org/schools/high-schools/rockford-high-school/rfc-rhs-student-handbook/
const districtBreaks = [
  ['2026-11-25','2026-11-27'], ['2026-12-21','2027-01-03'], ['2027-01-18','2027-01-18'],
  ['2027-02-12','2027-02-15'], ['2027-04-01','2027-04-09'], ['2027-05-28','2027-05-31']
]
export function nextSchoolTarget(from = new Date(), timeZone = 'America/Detroit', scheduledDaysOff = []) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(from)
  const get = key => parts.find(part => part.type === key)?.value
  const today = new Date(`${get('year')}-${get('month')}-${get('day')}T00:00:00Z`)
  const off = new Set(scheduledDaysOff.map(calendarDate))
  const candidate = new Date(today)
  for (let daysAhead = 1; daysAhead <= 31; daysAhead++) {
    candidate.setUTCDate(candidate.getUTCDate() + 1)
    const date = candidate.toISOString().slice(0, 10)
    const schoolBreak = districtBreaks.some(([start, end]) => date >= start && date <= end)
    if (![0, 6].includes(candidate.getUTCDay()) && !off.has(date) && !schoolBreak) {
      return { targetDate: candidate, daysAhead }
    }
  }
  throw new Error('No eligible school date within the supported planning horizon')
}
