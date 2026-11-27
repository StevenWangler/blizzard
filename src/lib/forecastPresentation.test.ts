import { forecastMetadata } from './forecastPresentation'
import { describe, expect, it } from 'vitest'
import { forecastFreshness, forecastReason, schoolDateLabel, studentOutlook } from './forecastPresentation'
import type { AgentPrediction } from '@/types/agentPrediction'

describe('student forecast presentation', () => {
  it('derives the weekday from the actual date, not the model label', () => {
    expect(schoolDateLabel('2026-01-30')).toBe('Friday, Jan 30')
    expect(schoolDateLabel('2026-09-08')).toBe('Tuesday, Sep 8')
    expect(schoolDateLabel('2026-09-08', true)).toBe('Tuesday, Sep 8, 2026')
  })
  it('does not invent a date for missing or malformed dates', () => {
    for (const input of [undefined, 'garbage', '2026-02-30', '2026-13-01']) {
      expect(schoolDateLabel(input)).toBe('School-morning outlook')
    }
  })
  it('labels saved past-day and older-than-24-hour reports as archived', () => {
    const now = new Date('2026-10-04T20:00:00Z')
    expect(forecastFreshness('2026-10-04T19:00:00Z', '2026-10-03', now)).toBe('archived')
    expect(forecastFreshness('2026-10-03T19:59:00Z', '2026-10-05', now)).toBe('archived')
    expect(forecastFreshness('2026-10-04T19:00:00Z', '2026-10-05', now)).toBe('current')
  })
  it('uses the district day at midnight rather than the UTC date', () => {
    const now = new Date('2026-10-05T02:00:00Z') // Still October 4 in Rockford.
    expect(forecastFreshness('2026-10-05T01:00:00Z', '2026-10-04', now)).toBe('current')
  })
  it('does not present unknown or future timestamps as fresh', () => {
    const now = new Date('2026-10-04T20:00:00Z')
    expect(forecastFreshness(undefined, undefined, now)).toBe('unknown')
    expect(forecastFreshness('bad', undefined, now)).toBe('unknown')
    expect(forecastFreshness('2026-10-04T21:00:00Z', undefined, now)).toBe('unknown')
  })
  it('requires a valid target day before calling a recently generated report current', () => {
    const now = new Date('2026-10-04T20:00:00Z')
    for (const targetDate of [undefined, 'garbage', '2026-02-30', '2026-13-01']) {
      expect(forecastFreshness('2026-10-04T19:00:00Z', targetDate, now)).toBe('unknown')
    }
  })
  it('preserves unknown probabilities and consistent closure thresholds', () => {
    expect(studentOutlook(null).headline).toBe('Chance unavailable')
    expect(studentOutlook(0).headline).toBe('Snow day unlikely')
    expect(studentOutlook(30).headline).toBe('Snow day possible')
    expect(studentOutlook(50).headline).toBe('Snow day possible')
    expect(studentOutlook(70).headline).toBe('Snow day likely')
  })
  it('uses a concise weather fact without fabricating missing conditions', () => {
    const prediction = (weather: object) => ({ meteorology: weather } as AgentPrediction)
    expect(forecastReason(prediction({ precipitation_analysis: { total_snowfall_inches: 0 } }))).toBe('No snow expected.')
    expect(forecastReason(prediction({ precipitation_analysis: { total_snowfall_inches: 2.55 } }))).toBe('2.5 in of snow expected.')
    expect(forecastReason(prediction({ precipitation_analysis: { precipitation_type: 'freezing_rain' } }))).toBe('Freezing rain expected.')
    expect(forecastReason(null)).not.toContain('0')
  })
})

it('never invents a zero estimate or target date for accuracy metadata', () => {
  expect(forecastMetadata({ timestamp: '2026-01-20T18:00:00Z', probability: 0 })).toBeNull()
  expect(forecastMetadata({ targetDate: '2026-02-30', probability: 20 })).toBeNull()
  expect(forecastMetadata({ targetDate: '2026-01-20', probability: '' })).toBeNull()
  expect(forecastMetadata({ targetDate: '2026-01-20', final: {} })).toBeNull()
  expect(forecastMetadata({ targetDate: '2026-01-20', probability: 0 })).toMatchObject({ date: '2026-01-20', modelPrediction: 0 })
})

it('reads archived forecast metadata on its original percentage scale', () => {
  expect(forecastMetadata({ targetDate: '2026-02-23', probability: 0.5 })).toEqual({
    date: '2026-02-23', modelPrediction: 0.5, confidence: null,
  })
})
