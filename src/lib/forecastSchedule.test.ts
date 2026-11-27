import { expect, it } from 'vitest'
import { getNextRefreshTime } from './forecastSchedule'
it('keeps district-local schedule through standard and daylight time', () => {
  expect(getNextRefreshTime(new Date('2026-01-05T12:00:00Z')).toISOString()).toBe('2026-01-05T14:17:00.000Z')
  expect(getNextRefreshTime(new Date('2026-07-06T12:00:00Z')).toISOString()).toBe('2026-07-06T13:17:00.000Z')
  expect(getNextRefreshTime(new Date('2026-11-01T00:00:00Z')).toISOString()).toBe('2026-11-01T14:17:00.000Z')
})
it('moves forward after a scheduled instant instead of returning a negative countdown', () => {
  expect(getNextRefreshTime(new Date('2026-01-05T14:17:00Z')).toISOString()).toBe('2026-01-05T18:17:00.000Z')
})
