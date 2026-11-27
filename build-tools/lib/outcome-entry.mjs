import { roadStudyAtLock } from './route-replay.mjs'
import { calendarDate, probability, confidenceLevels, assertTimestamp, outcomeNames, validateSubmission } from './data-integrity.mjs'

export function savedPrediction(summary, prediction, date) {
  // Each candidate must independently match; never mix probability and metadata across dates.
  for (const candidate of [summary && { ...summary }, prediction && {
    targetDate: prediction.targetDate, probability: prediction.final?.snow_day_probability,
    confidence: prediction.final?.confidence_level, timestamp: prediction.timestamp
  }]) {
    if (!candidate || candidate.targetDate !== date) continue
    calendarDate(candidate.targetDate)
    probability(candidate.probability, { optional: false, stored: true })
    if (!confidenceLevels.includes(candidate.confidence)) throw new Error('Invalid forecast confidence')
    assertTimestamp(candidate.timestamp)
    return candidate
  }
  return null
}

// The submission references the forecast visible on main at dispatch, even if
// another run publishes before this job leaves the queue.
export function lockMatchup(date, rhs, existing, forecast, lockedAt, revision, snapshot = null, observation = null) {
  calendarDate(date)
  const rhsPrediction = probability(rhs, { optional: false })
  if (existing?.competitionSubmission) {
    const locked = existing.competitionSubmission
    if (locked.rhsPrediction !== rhsPrediction) throw new Error('This matchup already has a locked class submission')
    if (observation && Object.keys(observation).some(key => observation[key] !== locked.roadStudy?.observation?.[key])) {
      throw new Error('Road evidence cannot be changed after submission')
    }
    return existing
  }
  if (!existing || existing.actualSnowDay !== null || existing.noSchoolScheduled) throw new Error('Matchup requires a pending school day')
  if (forecast?.targetDate !== date) throw new Error('No published forecast for this school day at submission')
  const submission = { rhsPrediction, modelProbability: forecast.probability, forecastTimestamp: forecast.timestamp, lockedAt, revision }
  if (snapshot && (snapshot.targetDate !== date || snapshot.timestamp !== forecast.timestamp ||
      snapshot.final?.snow_day_probability !== forecast.probability)) throw new Error('Detailed forecast does not match the submission summary')
  submission.roadStudy = roadStudyAtLock(snapshot, date, lockedAt, observation)
  validateSubmission(date, submission)
  return { ...existing, rhsPrediction, competitionSubmission: submission }
}

export function buildOutcome(input, existing = null, forecast = null, actor = 'unknown', now = new Date().toISOString()) {
  calendarDate(input.date)
  if (!outcomeNames.includes(input.outcome)) throw new Error('Invalid outcome')
  for (const key of ['notes', 'noSchoolReason']) {
    if (input[key] != null && typeof input[key] !== 'string') throw new Error(`Invalid ${key}`)
  }
  const manual = probability(input.blizzardPrediction)
  const rhs = probability(input.rhsPrediction)
  if (existing?.competitionSubmission && rhs !== null && rhs !== existing.competitionSubmission.rhsPrediction) {
    throw new Error('Class forecast differs from the locked submission')
  }
  // A recorded historical probability takes precedence over a newer forecast.
  const existingProbability = probability(existing?.modelProbability, { stored: true })
  const sameDate = forecast?.targetDate === input.date ? forecast : null
  const useSaved = manual === null && existingProbability === null && sameDate !== null
  const row = {
    ...existing,
    date: input.date,
    actualSnowDay: input.outcome === 'no-school' ? null : input.outcome === 'snow-day',
    recordedAt: now,
    recordedBy: actor,
    source: input.source || 'workflow'
  }
  if (manual !== null) {
    row.modelProbability = manual
    row.predictionSource = 'manual'
    // A manually supplied probability has no model confidence or generation timestamp.
    delete row.confidence
    delete row.predictionTimestamp
    delete row.predictionCommit
  } else if (useSaved) {
    row.modelProbability = probability(sameDate.probability, { optional: false, stored: true })
    row.confidence = sameDate.confidence
    row.predictionTimestamp = sameDate.timestamp
    row.predictionSource = sameDate.commit ? 'history' : 'saved'
    if (sameDate.commit) row.predictionCommit = sameDate.commit
  }
  if (rhs !== null) row.rhsPrediction = rhs
  if (input.notes?.trim()) row.notes = input.notes.trim()
  if (input.outcome === 'no-school') {
    row.noSchoolScheduled = true
    if (input.noSchoolReason?.trim()) row.noSchoolReason = input.noSchoolReason.trim()
  } else {
    delete row.noSchoolScheduled
    delete row.noSchoolReason
  }
  return row
}
