export interface SnowDayOutcome {
  date: string
  modelProbability?: number | null
  studentPrediction?: number | null
  confidence?: string | null
  predictionTimestamp?: string | null
  actualSnowDay?: boolean | null
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

const OUTCOMES_ENDPOINT = '/data/outcomes.json'

const safeParse = async (response: Response) => {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(`Unable to parse outcomes.json: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export async function fetchOutcomeLedger(options?: { bustCache?: boolean }): Promise<SnowDayOutcome[]> {
  const cacheBust = options?.bustCache ? `?t=${Date.now()}` : ''
  const response = await fetch(`${OUTCOMES_ENDPOINT}${cacheBust}`, {
    cache: 'no-store'
  })

  if (!response.ok) {
    throw new Error('Failed to load outcome ledger')
  }

  const payload = await safeParse(response)
  if (!Array.isArray(payload)) return []
  return payload as SnowDayOutcome[]
}

export function findOutcomeByDate(outcomes: SnowDayOutcome[], date: string): SnowDayOutcome | undefined {
  return outcomes.find(entry => entry.date === date)
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

  const completed = outcomes.filter(entry => typeof entry.actualSnowDay === 'boolean')
  const snowDays = completed.filter(entry => entry.actualSnowDay).length
  const openDays = completed.length - snowDays

  const probabilityValues = completed
    .map(entry => (typeof entry.modelProbability === 'number' ? entry.modelProbability : null))
    .filter((value): value is number => value !== null)

  const avgProbability = probabilityValues.length > 0
    ? Math.round(probabilityValues.reduce((sum, value) => sum + value, 0) / probabilityValues.length)
    : 0

  const directionalCorrect = completed.filter(entry => {
    if (typeof entry.modelProbability !== 'number') return false
    const predictedSnowDay = entry.modelProbability >= 50
    return predictedSnowDay === entry.actualSnowDay
  }).length

  const directionalAccuracy = completed.length > 0
    ? Math.round((directionalCorrect / completed.length) * 100)
    : 0

  const brierScores = completed
    .map(entry => {
      if (typeof entry.modelProbability !== 'number') return null
      const prob = entry.modelProbability / 100
      const actual = entry.actualSnowDay ? 1 : 0
      return Math.pow(prob - actual, 2)
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
