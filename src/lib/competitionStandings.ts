import { readOutcomeProbability, type SnowDayOutcome } from '@/services/outcomes'

export function competitionStandings(outcomes: SnowDayOutcome[]) {
  const paired = outcomes.flatMap(row => {
    if (row.noSchoolScheduled) return []
    const calls = row.competitionSubmission ?? row
    const modelProbability = readOutcomeProbability(calls.modelProbability)
    const rhsPrediction = readOutcomeProbability(calls.rhsPrediction)
    return modelProbability === null || rhsPrediction === null ? [] : [{ ...row, modelProbability, rhsPrediction }]
  }).sort((a, b) => a.date.localeCompare(b.date))

  const headToHead = paired.flatMap(row => {
    if (typeof row.actualSnowDay !== 'boolean') return []
    const target = row.actualSnowDay ? 100 : 0
    return [{ date: row.date, actual: row.actualSnowDay, lockedAt: row.competitionSubmission?.lockedAt,
      blizzardPrediction: row.modelProbability, rhsPrediction: row.rhsPrediction,
      blizzardError: Math.abs(target - row.modelProbability), rhsError: Math.abs(target - row.rhsPrediction) }]
  })
  const wins = { blizzard: 0, rhs: 0, ties: 0 }
  for (const match of headToHead) {
    if (match.blizzardError < match.rhsError) wins.blizzard++
    else if (match.rhsError < match.blizzardError) wins.rhs++
    else wins.ties++
  }
  return { paired, headToHead, wins }
}
