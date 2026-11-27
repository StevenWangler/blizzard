import { expect, it } from 'vitest'
import { competitionStandings } from './competitionStandings'
import type { SnowDayOutcome } from '@/services/outcomes'

it('scores paired school days using locked calls, with historical decimals, ties and pending pairs', () => {
  const row = (date: string, data: Partial<SnowDayOutcome>) => ({ date, modelProbability: 0, rhsPrediction: 0, actualSnowDay: false, ...data }) as SnowDayOutcome
  const standings = competitionStandings([
    row('2026-01-05', { actualSnowDay: null }),
    row('2026-01-01', { modelProbability: 0.5 }),
    row('2026-01-02', { actualSnowDay: true, competitionSubmission: { modelProbability: 98, rhsPrediction: 89, lockedAt: '', forecastTimestamp: '', revision: '' } }),
    row('2026-01-03', {}),
    row('2026-01-04', { noSchoolScheduled: true }),
    row('2026-01-06', { rhsPrediction: null }),
  ])
  expect(standings.wins).toEqual({ blizzard: 1, rhs: 1, ties: 1 })
  expect(standings.paired.map(row => row.date)).toEqual(['2026-01-01','2026-01-02','2026-01-03','2026-01-05'])
  expect(standings.headToHead[0].blizzardError).toBe(0.5)
})
