#!/usr/bin/env node
import { historyRef } from './lib/forecast-data-ref.mjs'
import { execFileSync } from 'node:child_process'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { calendarDate, probability, confidenceLevels, assertTimestamp, readLedger, atomicJson, withDataLock } from './lib/data-integrity.mjs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = join(repoRoot, 'public', 'data')
let historyIndex

// Only main's first-parent history is eligible, never arbitrary local/unmerged branches.
// Conservative cutoff: generation must precede the target date in district local time.
const districtDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Detroit', year: 'numeric', month: '2-digit', day: '2-digit'
})

export function indexHistoricalSummaries(summaries, locked = new Map()) {
  const index = new Map()
  for (const { summary, commit, committedAt } of summaries) {
    try {
      const date = calendarDate(summary.targetDate)
      probability(summary.probability, { optional: false, stored: true })
      assertTimestamp(summary.timestamp)
      if (!confidenceLevels.includes(summary.confidence)) continue
      const issued = Date.parse(summary.timestamp)
      if (!Number.isFinite(committedAt)) continue
      if (districtDate.format(issued) >= date || districtDate.format(committedAt) >= date) continue
      const submission = locked.get(date)
      if (submission && (summary.timestamp !== submission.forecastTimestamp ||
          summary.probability !== submission.modelProbability || committedAt > Date.parse(submission.lockedAt))) continue
      const previous = index.get(date)
      if (previous && Date.parse(previous.timestamp) >= issued) continue
      index.set(date, {
        probability: summary.probability, confidence: summary.confidence,
        timestamp: summary.timestamp, targetDate: date, commit
      })
    } catch { /* Invalid historic snapshots are not candidates; existing records are never rewritten. */ }
  }
  return index
}

export function loadHistory(revision = historyRef(repoRoot), locked = new Map()) {
  const git = args => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
  const main = git(['rev-parse', '--verify', '--end-of-options', revision + '^{commit}']).trim()
  const commits = git(['log', '--first-parent', '--format=%H %ct', main, '--', 'public/data/summary.json']).trim().split('\n').filter(Boolean)
  const summaries = []
  // Read small groups of Git blobs in one process. Git reports byte lengths,
  // including for summaries containing multibyte units such as degree signs.
  for (let start = 0; start < commits.length; start += 32) {
    const batch = commits.slice(start, start + 32).map(line => line.split(' '))
    const input = batch.map(([commit]) => commit + ':public/data/summary.json').join('\n') + '\n'
    const bytes = execFileSync('git', ['cat-file', '--batch'], { cwd: repoRoot, input, maxBuffer: 16 * 1024 * 1024 })
    let offset = 0
    for (const [commit, seconds] of batch) {
      const end = bytes.indexOf(10, offset)
      const header = bytes.toString('utf8', offset, end)
      offset = end + 1
      if (header.endsWith(' missing')) continue
      const [, type, size] = header.split(' ')
      if (type !== 'blob' || !/^\d+$/.test(size)) throw new Error('Invalid Git summary object')
      const json = bytes.toString('utf8', offset, offset + Number(size))
      offset += Number(size) + 1
      try {
        summaries.push({ summary: JSON.parse(json), commit, committedAt: Number(seconds) * 1000 })
      } catch { /* Malformed historical JSON cannot supply a probability. */ }
    }
  }
  return indexHistoricalSummaries(summaries, locked)
}

export function getHistoricalPrediction(targetDate) {
  calendarDate(targetDate)
  historyIndex ??= loadHistory()
  return historyIndex.get(targetDate) ?? null
}

export function generateSchoolDays(startDate, endDate) {
  calendarDate(startDate)
  calendarDate(endDate)
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  if (end < start || end - start > 366 * 86400000) throw new Error('Date range must be ordered and at most 366 days')
  const dates = []
  for (let current = start; current <= end; current.setUTCDate(current.getUTCDate() + 1)) {
    if (![0, 6].includes(current.getUTCDay())) dates.push(current.toISOString().slice(0, 10))
  }
  return dates // Weekdays only; this is not an official district calendar.
}

async function main() {
  const args = process.argv.slice(2)
  let dates = []
  if (args.includes('--dates')) dates = args[args.indexOf('--dates') + 1].split(',').map(calendarDate)
  if (args.includes('--range')) {
    const i = args.indexOf('--range')
    dates = generateSchoolDays(args[i + 1], args[i + 2])
  }
  const patch = args.includes('--patch')
  const run = async () => {
    const file = join(dataDir, 'outcomes.json')
    const ledger = await readLedger(file)
    if (patch && dates.length === 0) dates = ledger.filter(row => row.modelProbability == null).map(row => row.date)
    const results = dates.map(date => ({ date, prediction: getHistoricalPrediction(date) }))
    if (patch) {
      const next = ledger.map(row => {
        const result = results.find(result => result.date === row.date)?.prediction
        if (row.modelProbability != null || !result) return row
        return { ...row, modelProbability: result.probability, confidence: result.confidence,
          predictionTimestamp: result.timestamp, predictionCommit: result.commit, predictionSource: 'history' }
      })
      await atomicJson(file, next)
    }
    console.log(JSON.stringify(results, null, 2))
  }
  if (patch) await withDataLock(dataDir, run)
  else await run()
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1 })
}
