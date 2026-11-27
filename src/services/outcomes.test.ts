import { describe, expect, it, vi } from 'vitest'
import { fetchData } from '@/lib/dataPath'
import { buildOutcomeStats, cleanOutcomeLedger, fetchOutcomeLedger, normalizeProbability, readOutcomeProbability } from './outcomes'

vi.mock('@/lib/dataPath', () => ({ fetchData: vi.fn() }))

it('distinguishes an empty outcome ledger from an invalid snapshot', async () => {
  const logger = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    vi.mocked(fetchData).mockResolvedValueOnce([])
    await expect(fetchOutcomeLedger()).resolves.toEqual([])
    vi.mocked(fetchData).mockResolvedValueOnce({})
    await expect(fetchOutcomeLedger()).rejects.toThrow('Failed to load outcome ledger')
  } finally {
    logger.mockRestore()
  }
})

describe('outcomes', () => {
  it('normalizes probability values on either supported scale', () => {
    expect(normalizeProbability(0.42)).toBe(42)
    expect(normalizeProbability(42)).toBe(42)
    expect(normalizeProbability(-12)).toBeNull()
    expect(normalizeProbability(180)).toBeNull()
    expect(normalizeProbability(Number.NaN)).toBeNull()
  })

  it('scores historical decimals as percentages, without rescaling them', () => {
    expect(readOutcomeProbability(0.5)).toBe(0.5)
    expect(readOutcomeProbability('0.5')).toBeNull()
    expect(buildOutcomeStats([{
      date: '2026-02-23', recordedAt: '2026-02-22T23:09:01Z', recordedBy: 'system',
      modelProbability: 0.5, actualSnowDay: false,
    }])).toMatchObject({ directionalAccuracy: 100, avgBrierScore: 0 })
  })

  it('keeps the most useful record when a date is duplicated', () => {
    const outcomes = cleanOutcomeLedger([
      { date: '2026-02-03', recordedAt: '2026-02-03T08:00:00Z', recordedBy: 'prediction', source: 'prediction', modelProbability: 30 },
      { date: '2026-02-03', recordedAt: '2026-02-04T08:00:00Z', recordedBy: 'maintainer', source: 'manual', modelProbability: 30, actualSnowDay: false }
    ])

    expect(outcomes).toHaveLength(1)
    expect(outcomes[0].actualSnowDay).toBe(false)
  })

  it('excludes scheduled days off from accuracy metrics', () => {
    const stats = buildOutcomeStats([
      { date: '2026-02-01', recordedAt: '2026-02-01T08:00:00Z', recordedBy: 'system', modelProbability: 80, actualSnowDay: true },
      { date: '2026-02-02', recordedAt: '2026-02-02T08:00:00Z', recordedBy: 'system', modelProbability: 20, actualSnowDay: false },
      { date: '2026-02-03', recordedAt: '2026-02-03T08:00:00Z', recordedBy: 'system', modelProbability: 90, actualSnowDay: true, noSchoolScheduled: true }
    ])

    expect(stats).toMatchObject({
      totalRecords: 2,
      snowDays: 1,
      openDays: 1,
      avgProbability: 50,
      directionalAccuracy: 100,
      avgBrierScore: 0.04
    })
  })
})

it.each(['', '   ', '0', false, [], {}, null, undefined])('treats malformed runtime probability %j as unavailable', value => {
  expect(normalizeProbability(value)).toBeNull()
})
it('does not count missing predictions as incorrect snow-day calls', () => {
  expect(buildOutcomeStats([
    { date: '2026-02-02', recordedAt: '2026-02-02T08:00:00Z', recordedBy: 'fixture', modelProbability: 20, actualSnowDay: false },
    { date: '2026-02-03', recordedAt: '2026-02-03T08:00:00Z', recordedBy: 'fixture', actualSnowDay: true }
  ])).toMatchObject({ totalRecords: 2, directionalAccuracy: 100, avgBrierScore: 0.04 })
})
