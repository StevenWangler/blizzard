import { historyRef } from './lib/forecast-data-ref.mjs'
// Usage: npm run replay:forecasts [-- <full main commit>]. Reads only local Git objects.
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { loadHistory } from './backfill-predictions.mjs'
import { validateLedger } from './lib/data-integrity.mjs'
import { replayRoutes, roadStudyAtLock, scores } from './lib/route-replay.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })
const canonicalRef = historyRef(root)
const revision = process.argv[2] ?? canonicalRef
if (process.argv.length > 3 || (process.argv[2] && !/^[0-9a-f]{40}$/.test(revision))) throw new Error('Expected a full main commit SHA')
if (git(['rev-parse', '--is-shallow-repository']).trim() === 'true') throw new Error('Replay requires full main history')
const tip = git(['rev-parse', canonicalRef]).trim()
const commit = revision === canonicalRef ? tip : revision
if (commit !== tip && !git(['rev-list', '--first-parent', tip]).split('\n').includes(commit)) throw new Error('Revision must be on the canonical data history')
const ledger = validateLedger(JSON.parse(git(['show', commit + ':public/data/outcomes.json'])))
const locks = new Map(ledger.filter(r => r.competitionSubmission).map(r => [r.date, r.competitionSubmission]))
const history = loadHistory(commit, locks)
const ancestry = new Set(git(['rev-list', '--first-parent', commit]).trim().split('\n'))
const rows = []
const prospective = []
let missingWeather = 0
let pendingStudies = 0
const skipped = []
// Evaluation labels only. Never feed district decisions to the challenger.
const drillLog = 'https://www.rockfordschools.org/departments/security/2025-26-safety-drills/'
// Each report records a completed daytime drill with students on site. That rules
// out a districtwide full-day closure, even if an individual building had a delay.
const labels = new Map([
  ['2026-02-06', { closed: true, source: 'https://www.rockfordschools.org/pub/news/posts/1971' }],
  ...['2026-02-10', '2026-02-11', '2026-02-18', '2026-02-19', '2026-02-27', '2026-03-06', '2026-03-20']
    .map(date => [date, { closed: false, source: drillLog }])
])
const midwinterBreak = new Set(['2026-02-13', '2026-02-16']) // RPS winter 2026 district calendar
for (const row of [...ledger].sort((a, b) => a.date.localeCompare(b.date))) {
  const { date } = row
  const submission = row.competitionSubmission
  const study = submission?.roadStudy
  if (study) {
    if (row.noSchoolScheduled) {
      skipped.push({ date, reason: 'scheduled day off' })
      continue
    }
    if (row.actualSnowDay === null) pendingStudies++
    else if (study.iceWindow === null) missingWeather++
    else prospective.push({ date, closed: row.actualSnowDay, rhs: submission.rhsPrediction, issued: submission.modelProbability,
      iceOnly: study.iceOnly, iceAndRoutes: study.iceAndRoutes, roadClass: study.observation?.roadClass ?? 'unknown',
      observedAt: study.observation?.observedAt ?? null, condition: study.observation?.condition ?? 'unknown',
      iceType: study.iceWindow.iceType })
    continue // Score submitted probabilities directly, including after a future rule change.
  }
  const closed = row.actualSnowDay ?? labels.get(date)?.closed ?? null
  let reason
  if (row.noSchoolScheduled || midwinterBreak.has(date)) reason = 'scheduled day off'
  else if (date === '2026-03-13') reason = 'district announced opening before forecast'
  else if (closed === null) reason = 'outcome unverified'
  const saved = history.get(date)
  if (!reason && !saved) reason = 'no eligible issued forecast'
  if (reason) {
    skipped.push({ date, reason })
    continue
  }
  const revisionAtIssue = row.competitionSubmission?.revision ?? saved.commit
  if (!ancestry.has(revisionAtIssue) || (row.competitionSubmission &&
      Number(git(['show', '-s', '--format=%ct', revisionAtIssue])) * 1000 > Date.parse(row.competitionSubmission.lockedAt))) {
    skipped.push({ date, reason: 'submission revision unavailable at cutoff' })
    continue
  }
  if (!git(['ls-tree', revisionAtIssue, '--', 'public/data/prediction.json']).trim()) {
    skipped.push({ date, reason: 'missing detailed forecast' })
    continue
  }
  const file = revisionAtIssue + ':public/data/prediction.json'
  const snapshot = JSON.parse(git(['show', file]))
  if (snapshot.targetDate !== date || snapshot.timestamp !== saved.timestamp ||
      snapshot.final?.snow_day_probability !== saved.probability) {
    skipped.push({ date, reason: 'summary and forecast differ' })
    continue
  }
  const estimate = replayRoutes(snapshot)
  if (!estimate) {
    skipped.push({ date, reason: 'incomplete or nonlocal weather window' })
    continue
  }
  const retrospectiveIce = roadStudyAtLock(snapshot, date, saved.timestamp, null).iceOnly
  rows.push({ date, ...estimate, retrospectiveIce, closed, rhs: row.competitionSubmission?.rhsPrediction ?? row.rhsPrediction ?? null,
    timestamp: saved.timestamp, commit: revisionAtIssue, labelSource: row.actualSnowDay === null ? labels.get(date)?.source : 'ledger' })
}
if (!rows.length && !prospective.length && !pendingStudies && !missingWeather) throw new Error('No scorable archived forecasts. A full main history with weather snapshots is required.')
console.log('Main revision', commit)
console.log('Latest issued and committed before local midnight, or the locked submission. Historical class submission times are unknown.')
for (const [label, subset] of [
  ['All', rows], ['Through Jan 27 (reviewed storms)', rows.filter(r => r.date <= '2026-01-27')],
  ['Later dates', rows.filter(r => r.date > '2026-01-27')], ['Paired', rows.filter(r => r.rhs !== null)]
]) {
  console.log('\n' + label + ' (' + subset.filter(r => r.closed).length + ' closures)')
  for (const field of ['issued', 'iceOnly', 'candidate', 'snowOnly', 'retrospectiveIce', ...(label === 'Paired' ? ['rhs'] : [])]) {
    const score = scores(subset, field)
    if (score) console.log(field, 'n=' + score.n, 'Brier=' + score.brier.toFixed(5), 'MAE=' + score.meanError.toFixed(2),
      ...(field === 'rhs' ? [] : ['vs RHS W/L/T=' + [score.wins, score.losses, score.ties].join('/')]))
  }
}
console.log('\nScored forecasts (percentages)')
console.table(rows.map(r => ({ date: r.date, closed: r.closed, issued: r.issued, iceOnly: r.iceOnly, candidate: r.candidate, persistenceIce: r.retrospectiveIce,
  snowOnly: r.snowOnly, rhs: r.rhs, ice: r.iceType, lastIceHour: r.lastIceHour, limited: r.limitedTreatment,
  issuedAt: r.timestamp, commit: r.commit.slice(0, 10) })))
console.log('Prospective locked road study v1:', prospective.length, 'scored,', pendingStudies, 'pending,', missingWeather, 'resolved without complete weather')
if (prospective.length) {
  console.table(prospective)
  for (const [group, days] of [
    ['All scored matchups', prospective],
    ['Icy forecasts, school open', prospective.filter(row => row.iceType !== 'none' && !row.closed)],
    ['Icy forecasts, school closed', prospective.filter(row => row.iceType !== 'none' && row.closed)]
  ]) {
    console.log(group, days.length)
    if (days.length) {
      for (const field of ['issued', 'iceOnly', 'iceAndRoutes']) console.log(field, scores(days, field))
      console.log('Roads vs ice alone', scores(days, 'iceAndRoutes', 'iceOnly'))
    }
  }
}
console.log('Excluded', Object.fromEntries([...new Set(skipped.map(r => r.reason))].map(reason =>
  [reason, skipped.filter(r => r.reason === reason).map(r => r.date)])))
