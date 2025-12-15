import { fetchData } from '@/lib/dataPath'

export interface SnowDayOutcome {
  date: string
  modelProbability?: number | null
  /** Rockford High School student prediction (0-100) - our competition */
  rhsPrediction?: number | null
  confidence?: string | null
  predictionTimestamp?: string | null
  actualSnowDay?: boolean | null
  /** When true, indicates no school was scheduled (weekend, holiday, etc.) - excludes from accuracy stats */
  noSchoolScheduled?: boolean
  /** Reason for no school (e.g., 'weekend', 'thanksgiving', 'winter-break', 'teacher-day') */
  noSchoolReason?: string
  recordedAt: string
  recordedBy: string
  notes?: string
  source?: string
}

export interface OutcomeStats {
  totalRecords: number
  snowDays: number
  openDays: number
  avgProbability: number
  avgBrierScore: number | null
  directionalAccuracy: number
}

export async function fetchOutcomeLedger(options?: { bustCache?: boolean }): Promise<SnowDayOutcome[]> {
  try {
    // fetchData handles local vs production paths automatically
    // Add cache busting via a query param if needed (fetchData doesn't handle this)
    const payload = await fetchData<unknown>('outcomes.json', {
      cache: options?.bustCache ? 'no-store' : 'default'
    })
    if (!Array.isArray(payload)) return []
    return cleanOutcomeLedger(payload as SnowDayOutcome[])
  } catch (error) {
    console.error('Failed to load outcome ledger:', error)
    throw new Error('Failed to load outcome ledger')
  }
}

function choosePreferredOutcome(existing: SnowDayOutcome, candidate: SnowDayOutcome): SnowDayOutcome {
  // Favor entries with verified outcomes, then no-school flags, then human/workflow sources, then most recent timestamps
  const existingHasOutcome = typeof existing.actualSnowDay === 'boolean'
  const candidateHasOutcome = typeof candidate.actualSnowDay === 'boolean'
  if (existingHasOutcome !== candidateHasOutcome) {
    return candidateHasOutcome ? candidate : existing
  }

  const existingNoSchool = !!existing.noSchoolScheduled
  const candidateNoSchool = !!candidate.noSchoolScheduled
  if (existingNoSchool !== candidateNoSchool) {
    return candidateNoSchool ? candidate : existing
  }

  const existingIsWorkflow = existing.source && existing.source !== 'prediction'
  const candidateIsWorkflow = candidate.source && candidate.source !== 'prediction'
  if (existingIsWorkflow !== candidateIsWorkflow) {
    return candidateIsWorkflow ? candidate : existing
  }

  const toTimestamp = (value?: string) => {
    const parsed = value ? Date.parse(value) : NaN
    return Number.isNaN(parsed) ? 0 : parsed
  }
  const existingRecordedAt = toTimestamp(existing.recordedAt)
  const candidateRecordedAt = toTimestamp(candidate.recordedAt)
  return candidateRecordedAt >= existingRecordedAt ? candidate : existing
}

export function cleanOutcomeLedger(outcomes: SnowDayOutcome[]): SnowDayOutcome[] {
  const deduped = new Map<string, SnowDayOutcome>()

  for (const entry of outcomes) {
    if (!entry || typeof entry !== 'object') continue

    const trimmedDate = typeof entry.date === 'string' ? entry.date.trim() : ''
    if (!trimmedDate) continue

    const normalized = { ...entry, date: trimmedDate }
    const existing = deduped.get(trimmedDate)
    if (!existing) {
      deduped.set(trimmedDate, normalized)
      continue
    }

    deduped.set(trimmedDate, choosePreferredOutcome(existing, normalized))
  }

  return Array.from(deduped.values())
}

export function findOutcomeByDate(outcomes: SnowDayOutcome[], date: string): SnowDayOutcome | undefined {
  return outcomes.find(entry => entry.date === date)
}

/**
 * Normalize probability to 0-100 scale.
 * Handles both 0-1 scale (e.g., 0.18) and 0-100 scale (e.g., 18) values.
 */
export function normalizeProbability(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const num = Number(value)
  if (Number.isNaN(num) || !Number.isFinite(num)) return null
  // If value is between 0 and 1 (exclusive of 1), treat as 0-1 scale
  const normalized = (num > 0 && num < 1) ? num * 100 : num
  return Math.max(0, Math.min(100, Math.round(normalized)))
}

export function buildOutcomeStats(outcomes: SnowDayOutcome[]): OutcomeStats {
  if (!outcomes || outcomes.length === 0) {
    return {
      totalRecords: 0,
      snowDays: 0,
      openDays: 0,
      avgProbability: 0,
      avgBrierScore: null,
      directionalAccuracy: 0
    }
  }

  // Exclude days where no school was scheduled (weekends, holidays) from accuracy stats
  const completed = outcomes.filter(entry => typeof entry.actualSnowDay === 'boolean' && !entry.noSchoolScheduled)
  const snowDays = completed.filter(entry => entry.actualSnowDay).length
  const openDays = completed.length - snowDays

  const probabilityValues = completed
    .map(entry => normalizeProbability(entry.modelProbability))
    .filter((value): value is number => value !== null)

  const avgProbability = probabilityValues.length > 0
    ? Math.round(probabilityValues.reduce((sum, value) => sum + value, 0) / probabilityValues.length)
    : 0

  const directionalCorrect = completed.filter(entry => {
    const prob = normalizeProbability(entry.modelProbability)
    if (prob === null) return false
    const predictedSnowDay = prob >= 50
    return predictedSnowDay === entry.actualSnowDay
  }).length

  const directionalAccuracy = completed.length > 0
    ? Math.round((directionalCorrect / completed.length) * 100)
    : 0

  const brierScores = completed
    .map(entry => {
      const prob = normalizeProbability(entry.modelProbability)
      if (prob === null) return null
      const actual = entry.actualSnowDay ? 1 : 0
      return Math.pow(prob / 100 - actual, 2)
    })
    .filter((score): score is number => typeof score === 'number')

  const avgBrierScore = brierScores.length > 0
    ? Number((brierScores.reduce((sum, score) => sum + score, 0) / brierScores.length).toFixed(3))
    : null

  return {
    totalRecords: completed.length,
    snowDays,
    openDays,
    avgProbability,
    avgBrierScore,
    directionalAccuracy
  }
}
