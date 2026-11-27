// Refresh all preview data from one revision, including any locally generated forecast.
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { maximumJsonBytes } from './lib/bounded-response.mjs'
import { assertTimestamp, atomicJsonBatch, calendarDate, probability, validateLedger, withDataLock } from './lib/data-integrity.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const dir = join(root, 'public/data/local')
const ref = 'refs/remotes/origin/blizzard-data'
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: maximumJsonBytes })

await withDataLock(dir, async () => {
  git('fetch', '--no-tags', 'origin', 'refs/heads/blizzard-data:' + ref)
  const revision = git('rev-parse', '--verify', ref).trim()
  const snapshot = name => JSON.parse(git('show', revision + ':public/data/' + name + '.json'))
  const prediction = snapshot('prediction')
  const summary = snapshot('summary')
  const outcomes = validateLedger(snapshot('outcomes'))
  calendarDate(prediction.targetDate)
  assertTimestamp(prediction.timestamp)
  probability(summary.probability, { optional: false, stored: true })
  if (prediction.targetDate !== summary.targetDate || prediction.timestamp !== summary.timestamp ||
      prediction.final?.snow_day_probability !== summary.probability) {
    throw new Error('Published prediction and summary disagree')
  }
  await atomicJsonBatch([
    [join(dir, 'prediction.json'), prediction],
    [join(dir, 'summary.json'), summary],
    [join(dir, 'outcomes.json'), outcomes]
  ])
  console.log(`Refreshed local preview from blizzard-data at ${revision.slice(0, 12)} (${outcomes.length} records).`)
})
