#!/usr/bin/env node
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { calendarDate, readLedger, atomicJson, withDataLock } from './lib/data-integrity.mjs'
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data')
try {
  const date = calendarDate(process.env.EVENT_DATE)
  if (process.env.CONFIRM !== 'yes') throw new Error('Deletion not confirmed')
  await withDataLock(dir, async () => {
    const file = join(dir, 'outcomes.json')
    const ledger = await readLedger(file)
    const next = ledger.filter(row => row.date !== date)
    if (next.length === ledger.length) { console.log('No matching outcome; unchanged'); return }
    await atomicJson(file, next)
    console.log(`Deleted outcome for ${date}`)
  })
} catch (error) { console.error(error.message); process.exitCode = 1 }
