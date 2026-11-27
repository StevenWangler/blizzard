import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, mkdir, cp, rm, readdir, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { readResponseJson, maximumJsonBytes } from '../lib/bounded-response.mjs'
import { verifyDist } from '../verify-dist.mjs'
import { calendarDate, probability, validateLedger, readJson, readLedger, withDataLock, atomicJsonBatch, upsertLedger } from '../lib/data-integrity.mjs'
import { buildOutcome, savedPrediction } from '../lib/outcome-entry.mjs'
import { exactTargetForecast, validateFinal, saveForecast, pendingOutcome, nextSchoolTarget } from '../lib/forecast-integrity.mjs'
import { generateSchoolDays, indexHistoricalSummaries } from '../backfill-predictions.mjs'
import { publicEnvironment } from '../lib/public-environment.mjs'
import { verifyReleaseInputs, copyPublicReleaseAssets } from '../lib/release-assets.mjs'

const repo = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const old = { date: '2026-01-20', modelProbability: 20, rhsPrediction: 40, confidence: 'high',
  predictionTimestamp: '2026-01-19T18:00:00Z', actualSnowDay: null, recordedAt: '2026-01-19T18:00:00Z', recordedBy: 'system', source: 'prediction' }
const weather = date => ({ location: { name: 'Fixture', region: 'Michigan' }, forecast: { forecastday: [{ date, day: {}, hour: [{ time: `${date} 06:00` }] }] } })
const final = probability => ({ snow_day_probability: probability, confidence_level: 'high', primary_factors: ['Synthetic fixture'],
  timeline: { conditions_start: 'Unknown', peak_impact_time: 'Unknown', conditions_improve: 'Unknown' }, decision_rationale: 'Synthetic test only',
  alternative_scenarios: [], recommendations: { for_schools: [], for_residents: [], for_authorities: [] }, updates_needed: false, next_evaluation_time: 'Unknown' })
const prediction = chance => ({ targetDate: '2026-01-20', timestamp: '2026-01-19T19:00:00Z', final: final(chance), raw_weather_data: weather('2026-01-20') })
async function temporary(t) {
  const dir = await mkdtemp(join(tmpdir(), 'blizzard-regression-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  return dir
}
async function fixture(t, ledger = [old]) {
  const dir = await temporary(t)
  await cp(join(repo, 'build-tools'), join(dir, 'build-tools'), { recursive: true })
  const data = join(dir, 'public/data')
  await mkdir(data, { recursive: true })
  await writeFile(join(data, 'outcomes.json'), typeof ledger === 'string' ? ledger : JSON.stringify(ledger))
  await writeFile(join(data, 'summary.json'), JSON.stringify({ targetDate: '2026-01-23', probability: 80, confidence: 'high', timestamp: '2026-01-22T18:00:00Z' }))
  const run = (script, env = {}) => spawnSync(process.execPath, [join(dir, 'build-tools', script)], {
    env: { PATH: process.env.PATH, EVENT_DATE: old.date, OUTCOME: 'school-open', ...env }, encoding: 'utf8'
  })
  return { dir, data, run, ledger: () => readFile(join(data, 'outcomes.json'), 'utf8') }
}

test('blank is absent; percentages preserve zero and 100 without fraction inference', () => {
  for (const input of [undefined, null, '', '   ']) assert.equal(probability(input), null)
  for (const input of [0, '0', '0%']) assert.equal(probability(input), 0)
  assert.equal(probability('100%'), 100)
  assert.throws(() => probability('0.18'))
  for (const input of [true, {}, [], -1, 101, Infinity, NaN, '12garbage', '10%%', '-1', '1e2']) assert.throws(() => probability(input))
  assert.throws(() => probability('20', { stored: true }))
})
test('stored fractional percentages survive validation, backfill and outcome updates', async t => {
  const historical = { ...old, modelProbability: 0.5 }
  assert.equal(validateLedger([historical])[0].modelProbability, 0.5)
  assert.equal(probability(0.5, { stored: true }), 0.5)
  assert.throws(() => probability('0.5'), /whole percentage/)
  assert.throws(() => validateFinal(final(0.5)))
  const summary = { targetDate: old.date, probability: 0.5, confidence: 'high', timestamp: old.predictionTimestamp }
  const indexed = indexHistoricalSummaries([{ summary, committedAt: Date.parse(summary.timestamp), commit: 'historical' }]).get(old.date)
  assert.equal(indexed.probability, 0.5)
  assert.equal(buildOutcome({ date: old.date, outcome: 'school-open' }, null, indexed).modelProbability, 0.5)
  const f = await fixture(t, [historical])
  const result = f.run('update-outcomes-ledger.mjs')
  assert.equal(result.status, 0, result.stderr)
  assert.equal(JSON.parse(await f.ledger())[0].modelProbability, 0.5)
})

test('validates calendar dates and bounded weekday ranges, including leap years', () => {
  assert.equal(calendarDate('2024-02-29'), '2024-02-29')
  for (const input of ['2026-02-30', '2026-02-29', '2026-13-01', '01-02-2026', '', null, '2026-01-01 ']) assert.throws(() => calendarDate(input))
  assert.deepEqual(generateSchoolDays('2026-11-06', '2026-11-09'), ['2026-11-06', '2026-11-09'])
  assert.throws(() => generateSchoolDays('2026-11-09', '2026-11-06'))
  assert.throws(() => generateSchoolDays('2025-01-01', '2026-02-01'))
})
test('malformed, duplicate and invalid ledger records are rejected', () => {
  for (const value of [{}, [old, old], [{ ...old, modelProbability: '20' }], [{ ...old, actualSnowDay: 'yes' }], [{ ...old, noSchoolScheduled: true, actualSnowDay: false }]]) assert.throws(() => validateLedger(value))
})
test('blank overrides and a newer different-date forecast preserve probability and original metadata', () => {
  const row = buildOutcome({ date: old.date, outcome: 'school-open', blizzardPrediction: '', rhsPrediction: '' }, old,
    { targetDate: '2026-01-23', probability: 80, confidence: 'very_high', timestamp: '2026-01-22T18:00:00Z' })
  assert.equal(row.modelProbability, 20); assert.equal(row.rhsPrediction, 40)
  assert.equal(row.predictionTimestamp, old.predictionTimestamp); assert.equal(row.confidence, old.confidence)
})
test('unknown historical forecast remains absent, never borrowing another day', () => {
  assert.equal(savedPrediction({ targetDate: '2026-01-23', probability: 80 }, null, old.date), null)
  const row = buildOutcome({ date: old.date, outcome: 'snow-day' }, null, { targetDate: '2026-01-23', probability: 80 })
  assert.equal(row.modelProbability, undefined)
})
test('valid 0% saved forecast retains its own metadata and manual override is marked', () => {
  const forecast = savedPrediction({ targetDate: old.date, probability: 0, confidence: 'high', timestamp: old.predictionTimestamp }, null, old.date)
  assert.equal(buildOutcome({ date: old.date, outcome: 'school-open' }, null, forecast).modelProbability, 0)
  const manual = buildOutcome({ date: old.date, outcome: 'school-open', blizzardPrediction: '100' }, old)
  assert.equal(manual.modelProbability, 100); assert.equal(manual.predictionSource, 'manual')
  assert.equal(manual.predictionTimestamp, undefined); assert.equal(manual.confidence, undefined)
})
test('CLI preserves omitted overrides; repeats are byte-idempotent and shell-like notes are literal', async t => {
  const f = await fixture(t)
  const env = { BLIZZARD_PREDICTION: '', RHS_PREDICTION: '', NOTES: '$(touch unexpected) `echo no`' }
  assert.equal(f.run('update-outcomes-ledger.mjs', env).status, 0)
  const once = await f.ledger()
  const row = JSON.parse(once)[0]
  assert.equal(row.modelProbability, 20); assert.equal(row.rhsPrediction, 40)
  assert.equal(row.predictionTimestamp, old.predictionTimestamp)
  assert.equal(row.notes, env.NOTES)
  assert.equal(f.run('update-outcomes-ledger.mjs', env).status, 0)
  assert.equal(await f.ledger(), once)
})
test('CLI rejects invalid inputs without changing ledger bytes', async t => {
  const f = await fixture(t)
  const before = await f.ledger()
  for (const env of [{ EVENT_DATE: '2026-02-30' }, { BLIZZARD_PREDICTION: 'oops' }, { RHS_PREDICTION: '101' }, { OUTCOME: 'anything' }]) {
    assert.notEqual(f.run('update-outcomes-ledger.mjs', env).status, 0)
    assert.equal(await f.ledger(), before)
  }
})
test('corrupt and non-array histories survive every writer unchanged', async t => {
  for (const raw of ['{broken', '{}', JSON.stringify([{ ...old, actualSnowDay: 'bad' }])]) {
    const f = await fixture(t, raw)
    for (const script of ['update-outcomes-ledger.mjs', 'update-outcomes-batch.mjs', 'delete-outcome.mjs']) {
      const result = f.run(script, { CONFIRM: 'yes', OUTCOMES_DATA: JSON.stringify([{ date: old.date, outcome: 'school-open' }]) })
      assert.notEqual(result.status, 0, script)
      assert.equal(await f.ledger(), raw)
    }
  }
})
test('missing production history cannot be silently initialized by outcome writers', async t => {
  const f = await fixture(t)
  await rm(join(f.data, 'outcomes.json'))
  for (const script of ['update-outcomes-ledger.mjs', 'update-outcomes-batch.mjs', 'delete-outcome.mjs']) {
    const result = f.run(script, { CONFIRM: 'yes', OUTCOMES_DATA: JSON.stringify([{ date: old.date, outcome: 'school-open' }]) })
    assert.notEqual(result.status, 0, script)
    assert.match(result.stderr, /Outcome ledger is missing/)
    await assert.rejects(f.ledger(), { code: 'ENOENT' })
  }
  await assert.rejects(saveForecast(f.data, prediction(20)), /Outcome ledger is missing/)
  await assert.rejects(readFile(join(f.data, 'prediction.json')), { code: 'ENOENT' })
})

test('batch preserves holiday reason and validates all inputs before any file write', async t => {
  const f = await fixture(t)
  const env = { START_DATE: old.date, END_DATE: old.date, DEFAULT_OUTCOME: 'no-school', NO_SCHOOL_REASON: 'teacher-day' }
  assert.equal(f.run('update-outcomes-batch.mjs', env).status, 0)
  assert.equal(JSON.parse(await f.ledger())[0].noSchoolReason, 'teacher-day')
  const before = await f.ledger()
  const bad = [{ date: old.date, outcome: 'school-open' }, { date: '2026-02-30', outcome: 'school-open' }]
  assert.notEqual(f.run('update-outcomes-batch.mjs', { OUTCOMES_DATA: JSON.stringify(bad) }).status, 0)
  assert.equal(await f.ledger(), before)
})
test('local lock rejects a competing writer and releases after failure', async t => {
  const dir = await temporary(t)
  await withDataLock(dir, async () => {
    await assert.rejects(withDataLock(dir, () => assert.fail('must not run')))
  })
  await assert.rejects(withDataLock(dir, () => { throw new Error('synthetic failure') }))
  await withDataLock(dir, async () => {})
})
test('atomic batch stages all files before touching originals', async t => {
  const dir = await temporary(t)
  const first = join(dir, 'first.json'), invalid = join(dir, 'directory.json')
  await writeFile(first, 'original bytes')
  await mkdir(invalid)
  await assert.rejects(atomicJsonBatch([[first, { replacement: true }], [invalid, {}]]))
  assert.equal(await readFile(first, 'utf8'), 'original bytes')
  assert.deepEqual((await readdir(dir)).sort(), ['directory.json', 'first.json'])
})
test('requires exact target weather: Friday cannot use Sunday for Monday', () => {
  assert.throws(() => exactTargetForecast(weather('2026-11-08'), '2026-11-09'))
  assert.equal(exactTargetForecast(weather('2026-11-09'), '2026-11-09').date, '2026-11-09')
  const duplicate = weather('2026-11-09'); duplicate.forecast.forecastday.push(duplicate.forecast.forecastday[0])
  assert.throws(() => exactTargetForecast(duplicate, '2026-11-09'))
})
test('invalid coordinator results never become a fabricated 0%', () => {
  for (const value of [{}, null, { snow_day_probability: 0 }, final(-1), final(101), final(NaN)]) assert.throws(() => validateFinal(value))
  assert.equal(validateFinal(final(0)).snow_day_probability, 0)
  assert.equal(validateFinal(final(100)).snow_day_probability, 100)
})
test('forecast save validates corrupt ledger before changing any snapshot', async t => {
  const dir = await temporary(t)
  await writeFile(join(dir, 'outcomes.json'), '{broken')
  await writeFile(join(dir, 'prediction.json'), 'old prediction')
  await writeFile(join(dir, 'summary.json'), 'old summary')
  await assert.rejects(saveForecast(dir, prediction(0)))
  assert.equal(await readFile(join(dir, 'prediction.json'), 'utf8'), 'old prediction')
  assert.equal(await readFile(join(dir, 'summary.json'), 'utf8'), 'old summary')
  assert.equal(await readFile(join(dir, 'outcomes.json'), 'utf8'), '{broken')
})
test('valid saved forecasts stay zero or 100 and never reopen finalized no-school records', async t => {
  const dir = await temporary(t)
  for (const chance of [0, 100]) {
    await saveForecast(dir, prediction(chance), { allowMissingLedger: true })
    assert.equal(JSON.parse(await readFile(join(dir, 'summary.json'), 'utf8')).probability, chance)
    assert.equal((await readLedger(join(dir, 'outcomes.json')))[0].modelProbability, chance)
  }
  const holiday = [{ ...old, noSchoolScheduled: true, noSchoolReason: 'winter-break' }]
  assert.equal(pendingOutcome(holiday, prediction(100)), holiday)
  assert.equal(upsertLedger([old], { ...old, recordedAt: '2026-01-20T00:00:00Z', recordedBy: 'other' })[0], old)
})
test('submission CLI uses the dispatch revision when the checkout has newer weather', async t => {
  const f = await fixture(t, [old])
  const git = (...args) => {
    const r = spawnSync('git', args, { cwd: f.dir, encoding: 'utf8' })
    assert.equal(r.status, 0, r.stderr)
    return r.stdout.trim()
  }
  const file = join(f.data, 'summary.json')
  const snapshot = { targetDate: old.date, probability: 20, confidence: 'high', timestamp: old.predictionTimestamp }
  await writeFile(file, JSON.stringify(snapshot))
  const detail = prediction(20)
  detail.timestamp = snapshot.timestamp
  detail.raw_weather_data = { location: { name: 'Rockford', region: 'Michigan', tz_id: 'America/Detroit' }, forecast: {
    forecastday: ['2026-01-19', old.date].map(date => ({ date, hour: Array.from({ length: 24 }, (_, h) => ({
      time: date + ' ' + String(h).padStart(2, '0') + ':00', temp_f: 28, snow_cm: 0, precip_mm: h === 6 ? 0.1 : 0,
      condition: { text: h === 6 ? 'Freezing drizzle' : 'Clear' }
    })) }))
  } }
  const detailFile = join(f.data, 'prediction.json')
  await writeFile(detailFile, JSON.stringify(detail))
  git('init', '--quiet')
  git('add', 'public/data')
  git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgSign=false', 'commit', '--quiet', '-m', 'Fixture forecast')
  const revision = git('rev-parse', 'HEAD')
  await writeFile(file, JSON.stringify({ ...snapshot, probability: 90 }))
  await writeFile(detailFile, JSON.stringify({ ...detail, final: final(90) }))
  const input = { ROAD_CLASS: 'local-street', ROAD_CONDITION: 'icy', ROAD_SOURCE: 'https://example.org/road-report',
    ROAD_OBSERVED_AT: '2026-01-19T18:30:00Z', OUTCOME: 'lock-matchup', RHS_PREDICTION: '98', GITHUB_SHA: revision, SUBMISSION_TIME: '2026-01-19T19:20:00Z' }
  const first = f.run('update-outcomes-ledger.mjs', input)
  assert.equal(first.status, 0, first.stderr)
  const before = await f.ledger()
  const [record] = JSON.parse(before)
  assert.equal(record.competitionSubmission.modelProbability, 20)
  assert.equal(record.competitionSubmission.rhsPrediction, 98)
  assert.equal(record.competitionSubmission.revision, revision)
  assert.equal(record.competitionSubmission.roadStudy.iceOnly, 27)
  assert.equal(record.competitionSubmission.roadStudy.iceAndRoutes, 33)
  assert.equal(record.competitionSubmission.roadStudy.observation.observedAt, input.ROAD_OBSERVED_AT)
  assert.equal(record.actualSnowDay, null)
  assert.equal(f.run('update-outcomes-ledger.mjs', input).status, 0)
  assert.equal(await f.ledger(), before)
  assert.notEqual(f.run('update-outcomes-ledger.mjs', { ...input, ROAD_CONDITION: 'clear' }).status, 0)
  assert.equal(await f.ledger(), before)

  assert.equal(f.run('update-outcomes-ledger.mjs', { OUTCOME: 'school-open', BLIZZARD_PREDICTION: '90' }).status, 0)
  git('add', 'public/data')
  git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgSign=false', 'commit', '--quiet', '-m', 'Resolve fixture')
  git('update-ref', 'refs/remotes/origin/main', 'HEAD')
  const replay = f.run('replay-forecasts.mjs')
  assert.equal(replay.status, 0, replay.stderr)
  assert.match(replay.stdout, /Prospective locked road study v1: 1 scored, 0 pending/)
  assert.match(replay.stdout, /Icy forecasts, school open 1/)
  assert.match(replay.stdout, /Roads vs ice alone [^}]*losses: 1/)
})

test('historical index excludes hindsight, invalid probabilities and later duplicates', () => {
  const summary = { targetDate: old.date, probability: 0, confidence: 'high', timestamp: old.predictionTimestamp }
  const committedAt = Date.parse(old.predictionTimestamp)
  const index = indexHistoricalSummaries([
    { summary: { ...summary, probability: 99, timestamp: '2026-01-20T18:00:00Z' }, committedAt, commit: 'too-late' },
    { summary, committedAt: Date.parse('2026-01-20T05:00:00Z'), commit: 'late-publication' },
    { summary, committedAt, commit: 'eligible' }, { summary: { ...summary, probability: 100 }, committedAt, commit: 'older' }
  ])
  assert.equal(index.get(old.date).probability, 0)
  assert.equal(index.get(old.date).commit, 'eligible')
})
test('only reviewed public environment values are exposed, never arbitrary VITE secrets', () => {
  const values = publicEnvironment({ VITE_WEATHER_API_KEY: 'synthetic-secret', VITE_OUTCOME_ADMIN_SECRET: 'synthetic-admin', VITE_OTHER: 'synthetic-other' })
  assert.equal(Object.keys(values).length, 3)
  assert.ok(!JSON.stringify(values).includes('synthetic'))
  assert.equal(values['import.meta.env.VITE_BLIZZARD_ACTIVE'], '"false"')
})
test('release allowlist excludes preview data and fails closed when music is missing', async t => {
  const dir = await temporary(t)
  await mkdir(join(dir, 'config')); await mkdir(join(dir, 'public/data/local'), { recursive: true })
  await writeFile(join(dir, 'public/data/summary.json'), '{}')
  await writeFile(join(dir, 'public/data/local/summary.json'), '{"synthetic":true}')
  await writeFile(join(dir, 'config/release-assets.json'), JSON.stringify({ public: ['data/summary.json'], music: { source: '.local-assets/music/fireside-romance.mp3', bytes: 1, sha256: '0'.repeat(64) } }))
  await verifyReleaseInputs(dir)
  await assert.rejects(verifyReleaseInputs(dir, true), /Licensed release music is missing/)
  await copyPublicReleaseAssets(dir, join(dir, 'dist'))
  assert.deepEqual(await readdir(join(dir, 'dist/data')), ['summary.json'])
})

test('release input and output validation reject parseable but invalid outcome ledgers', async t => {
  const dir = await temporary(t)
  await mkdir(join(dir, 'config'))
  await mkdir(join(dir, 'public/data'), { recursive: true })
  const manifest = {
    public: ['data/prediction.json', 'data/summary.json', 'data/outcomes.json'],
    music: { source: '.local-assets/music/fireside-romance.mp3', bytes: 1, sha256: '0'.repeat(64) },
  }
  await writeFile(join(dir, 'config/release-assets.json'), JSON.stringify(manifest))
  for (const file of ['prediction', 'summary']) await writeFile(join(dir, 'public/data', `${file}.json`), '{}')
  const source = join(dir, 'public/data/outcomes.json')
  const output = join(dir, 'dist')
  await writeFile(source, JSON.stringify([old]))
  await copyPublicReleaseAssets(dir, output)
  await verifyDist(output, manifest)
  const invalid = JSON.stringify([old, old])
  await writeFile(source, invalid)
  await assert.rejects(verifyReleaseInputs(dir), /Duplicate outcome date/)
  await writeFile(join(output, 'data/outcomes.json'), invalid)
  await assert.rejects(verifyDist(output, manifest), /Duplicate outcome date/)
})

test('next school date uses district timezone, weekends and explicit known days off', () => {
  const friday = nextSchoolTarget(new Date('2026-11-06T18:00:00Z'))
  assert.equal(friday.targetDate.toISOString().slice(0, 10), '2026-11-09')
  assert.equal(friday.daysAhead, 3)
  const holiday = nextSchoolTarget(new Date('2026-11-06T18:00:00Z'), 'America/Detroit', ['2026-11-09'])
  assert.equal(holiday.targetDate.toISOString().slice(0, 10), '2026-11-10')
  assert.equal(holiday.daysAhead, 4)
  // 01:00 UTC is still Friday in the district, including around the DST transition.
  assert.equal(nextSchoolTarget(new Date('2026-10-31T01:00:00Z')).targetDate.toISOString().slice(0, 10), '2026-11-02')
})

test('stored blank values are corrupt, not optional missing overrides', async t => {
  for (const value of ['', '   ', '0', false]) {
    assert.throws(() => probability(value, { stored: true }))
    for (const key of ['modelProbability', 'rhsPrediction']) {
      const raw = JSON.stringify([{ ...old, [key]: value }])
      const f = await fixture(t, raw)
      assert.notEqual(f.run('update-outcomes-ledger.mjs').status, 0)
      assert.equal(await f.ledger(), raw)
    }
  }
})
test('refreshing a pending prediction clears prior historical commit attribution', () => {
  const pending = [{ ...old, predictionSource: 'history', predictionCommit: 'a'.repeat(40) }]
  const refreshed = pendingOutcome(pending, prediction(80))[0]
  assert.equal(refreshed.modelProbability, 80)
  assert.equal(refreshed.predictionSource, 'saved')
  assert.equal(refreshed.predictionCommit, undefined)
})
test('release assets reject symlinks to fixtures, linked ancestors and unsafe manifest paths', async t => {
  const dir = await temporary(t)
  await mkdir(join(dir, 'config'))
  await mkdir(join(dir, 'public/data/local'), { recursive: true })
  const manifest = { public: ['data/summary.json'], music: {
    source: '.local-assets/music/fireside-romance.mp3', bytes: 1, sha256: '0'.repeat(64)
  } }
  const save = () => writeFile(join(dir, 'config/release-assets.json'), JSON.stringify(manifest))
  await save()
  await writeFile(join(dir, 'public/data/local/fixture.json'), '{"synthetic":true}')
  await symlink('local/fixture.json', join(dir, 'public/data/summary.json'))
  await assert.rejects(verifyReleaseInputs(dir), /Symlinks/)
  await assert.rejects(copyPublicReleaseAssets(dir, join(dir, 'dist')), /Symlinks/)
  await rm(join(dir, 'public/data/summary.json'))
  await symlink('data', join(dir, 'public/linked'))
  manifest.public = ['linked/local/fixture.json']; await save()
  await assert.rejects(verifyReleaseInputs(dir), /Symlinks/)
  for (const path of ['../outside.json', 'data/local/fixture.json', 'data/./summary.json', '/absolute', 'fonts/../../outside', 'images/\\..\\secret']) {
    manifest.public = [path]; await save()
    await assert.rejects(verifyReleaseInputs(dir))
  }
  manifest.public = ['data/summary.json']
  manifest.music.source = '../private-other.mp3'; await save()
  await assert.rejects(verifyReleaseInputs(dir), /music/)
})

test('release output verification rejects symlink entries before following them', async t => {
  const dir = await temporary(t)
  await writeFile(join(dir, 'fixture.json'), '{}')
  await symlink('fixture.json', join(dir, 'innocent.json'))
  await assert.rejects(verifyDist(dir, { public: ['fixture.json'] }), /Symlinks/)
})

test('oversized or deeply nested model values fail before schema traversal', () => {
  assert.throws(() => validateFinal({ ...final(10), primary_factors: Array(10000).fill({ invalid: true }) }), /size limit/)
  assert.throws(() => validateFinal({ ...final(10), decision_rationale: 'x'.repeat(33000) }), /size limit/)
  let deep = {}; const root = deep
  for (let i = 0; i < 20; i++) { deep.next = {}; deep = deep.next }
  assert.throws(() => validateFinal(root), /structural limits/)
})
test('oversized JSON files fail without replacing existing bytes', async t => {
  const dir = await temporary(t), file = join(dir, 'oversized.json')
  const content = ' '.repeat(2 * 1024 * 1024 + 1)
  await writeFile(file, content)
  await assert.rejects(readJson(file), /bounded JSON/)
  assert.equal((await readFile(file)).length, content.length)
})

test('provider JSON body and published snapshots have bounded byte sizes', async t => {
  assert.deepEqual(await readResponseJson(new Response('{"fixture":true}')), { fixture: true })
  await assert.rejects(readResponseJson(new Response('x'.repeat(maximumJsonBytes + 1))), /size limit/)
  const dir = await temporary(t), file = join(dir, 'original.json')
  await writeFile(file, '{"old":true}')
  await assert.rejects(atomicJsonBatch([[file, { oversized: 'x'.repeat(maximumJsonBytes) }]]), /size limit/)
  assert.equal(await readFile(file, 'utf8'), '{"old":true}')
})

test('release output refuses unexpected private files and unapproved audio bytes', async t => {
  const dir = await temporary(t)
  await writeFile(join(dir, 'private-note.txt'), 'synthetic private material')
  await assert.rejects(verifyDist(dir, { public: [] }), /Unexpected file/)
  await rm(join(dir, 'private-note.txt'))
  await mkdir(join(dir, 'assets'))
  await writeFile(join(dir, 'assets/unapproved-audio.mp3'), 'synthetic wrong media')
  await assert.rejects(verifyDist(dir, { public: [], music: { bytes: 1, sha256: '0'.repeat(64) } }), /integrity mismatch/)
})
