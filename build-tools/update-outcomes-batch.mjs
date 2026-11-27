#!/usr/bin/env node
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getHistoricalPrediction, generateSchoolDays } from './backfill-predictions.mjs'
import { readLedger, withDataLock, atomicJson, upsertLedger, calendarDate, outcomeNames } from './lib/data-integrity.mjs'
import { buildOutcome } from './lib/outcome-entry.mjs'

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data')
try {
  let entries
  if (process.env.OUTCOMES_DATA) entries = JSON.parse(process.env.OUTCOMES_DATA)
  else if (process.env.OUTCOMES_CSV) entries = process.env.OUTCOMES_CSV.trim().split('\n').map(line => {
    const [date, outcome, noSchoolReason, ...notes] = line.split(',').map(part => part.trim())
    return { date, outcome, noSchoolReason, notes: notes.join(',') }
  })
  else {
    const exceptions = JSON.parse(process.env.EXCEPTIONS || '{}')
    if (!exceptions || Array.isArray(exceptions) || typeof exceptions !== 'object') throw new Error('EXCEPTIONS must be an object')
    const dates = generateSchoolDays(process.env.START_DATE, process.env.END_DATE)
    for (const [date, outcome] of Object.entries(exceptions)) {
      calendarDate(date)
      if (!dates.includes(date) || !outcomeNames.includes(outcome)) throw new Error('Exception must match a weekday in the requested range and a valid outcome')
    }
    entries = dates.map(date => ({ date, outcome: exceptions[date] || process.env.DEFAULT_OUTCOME || 'school-open',
      noSchoolReason: process.env.NO_SCHOOL_REASON }))
  }
  if (!Array.isArray(entries) || entries.length === 0 || entries.length > 367) throw new Error('Supply 1–367 outcome entries')
  const dates = new Set()
  for (const entry of entries) {
    calendarDate(entry?.date)
    if (dates.has(entry.date)) throw new Error('Duplicate input date')
    dates.add(entry.date)
    if (!outcomeNames.includes(entry.outcome)) throw new Error('Invalid outcome')
  }
  await withDataLock(dataDir, async () => {
    const file = join(dataDir, 'outcomes.json')
    let ledger = await readLedger(file)
    for (const input of entries) {
      const existing = ledger.find(row => row.date === input.date)
      const forecast = existing?.modelProbability != null ? null : getHistoricalPrediction(input.date)
      const entry = buildOutcome({ ...input, source: 'batch-workflow' }, existing, forecast, process.env.GITHUB_ACTOR || 'batch-update')
      ledger = upsertLedger(ledger, entry)
    }
    if (process.env.DRY_RUN === 'true') console.log(JSON.stringify(ledger.filter(row => dates.has(row.date)), null, 2))
    else console.log(await atomicJson(file, ledger) ? `Recorded ${entries.length} outcomes` : 'No changes')
  })
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
