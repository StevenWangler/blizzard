import test from 'node:test'
import assert from 'node:assert/strict'
import { replayRoutes, scores } from '../lib/route-replay.mjs'
import { lockMatchup, buildOutcome } from '../lib/outcome-entry.mjs'
import { pendingOutcome } from '../lib/forecast-integrity.mjs'
import { validateLedger } from '../lib/data-integrity.mjs'
import { indexHistoricalSummaries } from '../backfill-predictions.mjs'

const date = '2026-01-27'
const validTime = '2026-01-26T23:00:00Z'
const cutoff = '2026-01-27T01:00:00Z'
const revision = '1'.repeat(40)
const forecast = { targetDate: date, timestamp: validTime, probability: 20, confidence: 'high' }
const pending = { date, actualSnowDay: null, modelProbability: 20, predictionTimestamp: validTime }
function fixture(probability = 20) {
  const days = ['2026-01-26', date].map(day => ({ date: day,
    hour: Array.from({ length: 24 }, (_, i) => ({
      time: day + ' ' + String(i).padStart(2, '0') + ':00', temp_f: 25, precip_mm: 0, snow_cm: 0, condition: { text: 'Clear' }
    })) }))
  return { targetDate: date, final: { snow_day_probability: probability },
    raw_weather_data: { location: { name: 'Rockford', region: 'Michigan', tz_id: 'America/Detroit' }, forecast: { forecastday: days } },
    infrastructure: { road_clearing_status: { local_streets: { status: 'ice_covered', plow_activity_level: 'light' } } } }
}
test('only short treatment windows raise odds, with separate county/local corroboration', () => {
  const snapshot = fixture()
  const morning = snapshot.raw_weather_data.forecast.forecastday[1].hour
  const ice = { condition: { text: 'Light freezing drizzle' }, precip_mm: 0.1 }
  Object.assign(morning[3], ice)
  assert.equal(replayRoutes(snapshot).candidate, 20)
  Object.assign(morning[4], ice)
  assert.equal(replayRoutes(snapshot).iceOnly, 27)
  assert.equal(replayRoutes(snapshot).candidate, 33)
  snapshot.infrastructure = undefined
  assert.equal(replayRoutes(snapshot).candidate, 27)
  Object.assign(morning[4], { precip_mm: 0 })
  assert.equal(replayRoutes(snapshot).candidate, 20)
})
test('rain and subsequent freezing across midnight are considered together', () => {
  const snapshot = fixture()
  const [, morning] = snapshot.raw_weather_data.forecast.forecastday
  Object.assign(morning.hour[1], { temp_f: 34, precip_mm: 1, condition: { text: 'Light rain' } })
  assert.equal(replayRoutes(snapshot).iceType, 'refreeze')
  assert.equal(replayRoutes(snapshot).candidate, 33)
  const [evening] = snapshot.raw_weather_data.forecast.forecastday
  Object.assign(morning.hour[1], { temp_f: 25, precip_mm: 0 })
  Object.assign(evening.hour[23], { temp_f: 34, precip_mm: 1, condition: { text: 'Light rain' } })
  assert.equal(replayRoutes(snapshot).lastIceHour, 3)
})
test('replay preserves historical decimal percentages and excludes unusable weather', () => {
  const snapshot = fixture(0.5)
  assert.equal(replayRoutes(snapshot).candidate, 0.5)
  snapshot.raw_weather_data.forecast.forecastday[1].hour.shift()
  assert.equal(replayRoutes(snapshot), null)
  const wrongTown = fixture()
  wrongTown.raw_weather_data.location.region = 'Illinois'
  assert.equal(replayRoutes(wrongTown), null)
})
test('scoring handles the 89 vs 98 example, ties, zero and unpaired outcomes', () => {
  const rows = [{ issued: 89, rhs: 98, closed: true }, { issued: 0, rhs: 0, closed: false },
    { issued: 0, rhs: 98, closed: false }, { issued: 0.5, rhs: null, closed: false }]
  const result = scores(rows, 'issued')
  assert.deepEqual([result.wins, result.losses, result.ties], [1, 1, 1])
  assert.equal(result.meanError, 11.5 / 4)
  assert.equal(result.brier, ((0.11 ** 2) + (0.005 ** 2)) / 4)
  assert.equal(scores([], 'issued'), null)
})
test('the dispatched pair survives subsequent publications, outcome corrections and retries', () => {
  const locked = lockMatchup(date, '0', pending, forecast, cutoff, revision)
  assert.equal(lockMatchup(date, 0, locked, forecast, cutoff, revision), locked)
  assert.throws(() => lockMatchup(date, 5, locked, forecast, cutoff, revision), /locked/)
  const [later] = pendingOutcome([locked], { targetDate: date, timestamp: '2026-01-27T02:00:00Z',
    final: { snow_day_probability: 89, confidence_level: 'high' } })
  const finalized = buildOutcome({ date, outcome: 'snow-day' }, later)
  assert.equal(finalized.modelProbability, 89)
  assert.equal(finalized.competitionSubmission.modelProbability, 20)
  assert.equal(finalized.competitionSubmission.rhsPrediction, 0)
  assert.throws(() => buildOutcome({ date, outcome: 'snow-day', rhsPrediction: 52 }, later), /locked/)
  assert.throws(() => lockMatchup(date, 5, { ...pending, actualSnowDay: false }, forecast, cutoff, revision), /pending/)
  assert.throws(() => lockMatchup(date, 5, pending, forecast, '2026-01-27T05:00:00Z', revision), /cutoff/)
  assert.throws(() => lockMatchup(date, 5, pending, forecast, '2026-01-26T20:00:00Z', revision), /cutoff/)
  assert.throws(() => validateLedger([{ ...pending, competitionSubmission: {} }]))
  const lockedByDate = new Map([[date, locked.competitionSubmission]])
  const commits = [0, 1].map(i => ({ summary: { ...forecast, probability: 20 + i }, commit: String(i),
    committedAt: Date.parse(validTime) + i * 1000 }))
  assert.equal(indexHistoricalSummaries(commits.reverse(), lockedByDate).get(date).probability, 20)
  assert.equal(indexHistoricalSummaries([{ ...commits[1], committedAt: Date.parse(cutoff) + 1000 }], lockedByDate).size, 0)
})

const observation = { roadClass: 'county-road', condition: 'icy', observedAt: '2026-01-26T23:30:00Z', source: 'https://example.org/county/report' }
function freezeStudy(snapshot, report = observation) {
  return lockMatchup(date, 50, pending, forecast, cutoff, revision, snapshot, report)
}
test('persistent earlier ice tapers gradually; thaw removes the persistence credit', () => {
  const snapshot = { ...fixture(), timestamp: validTime }
  const morning = snapshot.raw_weather_data.forecast.forecastday[1].hour
  const ice = { condition: { text: 'Freezing drizzle' }, precip_mm: 0.2 }
  Object.assign(morning[3], ice)
  const study = freezeStudy(snapshot).competitionSubmission.roadStudy
  assert.deepEqual(study.iceWindow, { firstIceHour: 3, lastIceHour: 3, frozenThroughHour: 8, iceType: 'freezing precipitation' })
  assert.ok(study.iceOnly > 20 && study.iceAndRoutes > study.iceOnly)
  Object.assign(morning[4], ice)
  assert.ok(freezeStudy(snapshot).competitionSubmission.roadStudy.iceOnly > study.iceOnly)
  morning[5].temp_f = 35
  assert.equal(freezeStudy(snapshot).competitionSubmission.roadStudy.iceAndRoutes, 20)
})
test('only recent secondary-road coverage strengthens the frozen ice estimate', () => {
  const snapshot = { ...fixture(), timestamp: validTime }
  Object.assign(snapshot.raw_weather_data.forecast.forecastday[1].hour[6], { condition: { text: 'Sleet' }, precip_mm: 1 })
  for (const report of [null, { ...observation, roadClass: 'highway' }, { ...observation, condition: 'treated' },
    { ...observation, observedAt: '2026-01-26T16:00:00Z' }]) {
    const study = freezeStudy(snapshot, report).competitionSubmission.roadStudy
    assert.equal(study.iceOnly, 27)
    assert.equal(study.iceAndRoutes, 27)
    assert.deepEqual(study.observation, report)
  }
  const locked = freezeStudy(snapshot)
  assert.equal(locked.competitionSubmission.roadStudy.iceAndRoutes, 33)
  assert.throws(() => lockMatchup(date, 50, locked, forecast, cutoff, revision, snapshot,
    { ...observation, condition: 'clear' }), /cannot be changed/)
  const finalized = buildOutcome({ date, outcome: 'school-open', blizzardPrediction: 97 }, locked)
  assert.deepEqual(finalized.competitionSubmission, locked.competitionSubmission)
  for (const report of [{ ...observation, observedAt: '2026-01-27T01:00:01Z' }, { ...observation, observedAt: '' },
    { ...observation, source: 'file:///private/report' }, { ...observation, condition: 'guess' }]) {
    assert.throws(() => freezeStudy(snapshot, report))
  }
})
test('incomplete weather preserves the official lock and reports an unscored study; old submissions still validate', () => {
  const missing = freezeStudy(null)
  assert.deepEqual(missing.competitionSubmission.roadStudy, { version: 1, observation, iceWindow: null, iceOnly: null, iceAndRoutes: null })
  const wrongDate = { ...fixture(), timestamp: validTime, targetDate: '2026-01-28' }
  assert.throws(() => freezeStudy(wrongDate), /does not match/)
  const legacy = { ...missing.competitionSubmission }
  delete legacy.roadStudy
  assert.doesNotThrow(() => validateLedger([{ ...missing, competitionSubmission: legacy }]))
  assert.throws(() => validateLedger([{ ...missing, competitionSubmission: {
    ...legacy, roadStudy: { ...missing.competitionSubmission.roadStudy, iceOnly: 0 }
  } }]))
})
