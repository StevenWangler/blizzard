import { describe, expect, it } from 'vitest'
import { getAnalysisError } from './analysisError'

describe('saved analysis error boundary', () => {
  it('reads the legacy error payload without requiring successful analysis fields', () => {
    expect(getAnalysisError({ error: 'History provider unavailable' })).toBe('History provider unavailable')
    expect(getAnalysisError({ error: 'Safety provider unavailable', road_conditions: {} })).toBe('Safety provider unavailable')
  })

  it('does not mistake valid or absent analysis data for an error', () => {
    for (const analysis of [undefined, null, {}, { risk_level: 'low' }, 'offline', 0]) {
      expect(getAnalysisError(analysis)).toBeNull()
    }
  })

  it('rejects non-text error values that React cannot safely render as a message', () => {
    for (const error of [false, 500, null, undefined, { message: 'offline' }, ['offline']]) {
      expect(getAnalysisError({ error })).toBeNull()
    }
    expect(getAnalysisError({ error: '' })).toBe('')
  })
})
