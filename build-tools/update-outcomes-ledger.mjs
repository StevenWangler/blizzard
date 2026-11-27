#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readJson, readLedger, withDataLock, atomicJson, upsertLedger, calendarDate } from './lib/data-integrity.mjs'
import { savedPrediction, buildOutcome, lockMatchup } from './lib/outcome-entry.mjs'

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data')
const input = {
  date: process.env.EVENT_DATE,
  outcome: process.env.OUTCOME,
  noSchoolReason: process.env.NO_SCHOOL_REASON,
  notes: process.env.NOTES,
  blizzardPrediction: process.env.BLIZZARD_PREDICTION,
  rhsPrediction: process.env.RHS_PREDICTION
}
try {
  calendarDate(input.date)
  await withDataLock(dataDir, async () => {
    const file = join(dataDir, 'outcomes.json')
    const ledger = await readLedger(file)
    const existing = ledger.find(row => row.date === input.date)
    let entry
    if (input.outcome === 'lock-matchup') {
      let revision = process.env.GITHUB_SHA
      if (!/^[0-9a-f]{40}$/.test(revision)) throw new Error('Expected a dispatch revision')
      const gitOptions = { cwd: join(dataDir, '..', '..'), encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 }
      if (process.env.DISPATCH_DATA_BASE) {
        const base = process.env.DISPATCH_DATA_BASE
        const cutoff = Date.parse(process.env.SUBMISSION_TIME)
        if (!/^[0-9a-f]{40}$/.test(base) || !Number.isFinite(cutoff)) throw new Error('Invalid submission metadata')
        revision = execFileSync('git', ['rev-list','--first-parent','-1','--before=' + new Date(cutoff).toISOString(),base],gitOptions).trim()
        if (!revision) throw new Error('No data revision at submission time')
      }
      const summary = JSON.parse(execFileSync('git', ['show', revision + ':public/data/summary.json'], gitOptions))
      const roadFields = { roadClass: process.env.ROAD_CLASS, condition: process.env.ROAD_CONDITION,
        observedAt: process.env.ROAD_OBSERVED_AT, source: process.env.ROAD_SOURCE }
      const observation = Object.values(roadFields).some(Boolean) ? roadFields : null
      const path = 'public/data/prediction.json'
      const hasDetail = execFileSync('git', ['ls-tree', revision, '--', path], gitOptions).trim()
      const detail = hasDetail ? JSON.parse(execFileSync('git', ['show', revision + ':' + path], gitOptions)) : null
      entry = lockMatchup(input.date, input.rhsPrediction, existing, savedPrediction(summary, null, input.date),
        process.env.SUBMISSION_TIME, revision, detail, observation)
    } else {
      const summary = await readJson(join(dataDir, 'summary.json'))
      const prediction = await readJson(join(dataDir, 'prediction.json'))
      entry = buildOutcome(input, existing, savedPrediction(summary, prediction, input.date), process.env.GITHUB_ACTOR)
    }
    const changed = await atomicJson(file, upsertLedger(ledger, entry))
    console.log(changed ? `Updated record for ${input.date}` : 'Outcome already recorded; no changes')
  })
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
