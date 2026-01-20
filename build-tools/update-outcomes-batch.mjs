#!/usr/bin/env node
/**
 * update-outcomes-batch.mjs
 * 
 * Process multiple outcome entries at once, automatically retrieving
 * Blizzard predictions from git history for each date.
 * 
 * Usage (via environment variables):
 *   OUTCOMES_DATA='[{"date":"2026-01-05","outcome":"school-open"},...]' node build-tools/update-outcomes-batch.mjs
 * 
 * Or with CSV-style input:
 *   OUTCOMES_CSV='2026-01-05,school-open
 *   2026-01-06,school-open
 *   2026-01-07,snow-day' node build-tools/update-outcomes-batch.mjs
 * 
 * Environment Variables:
 *   OUTCOMES_DATA    - JSON array of {date, outcome, noSchoolReason?, notes?}
 *   OUTCOMES_CSV     - CSV format: date,outcome[,noSchoolReason][,notes] per line
 *   DEFAULT_OUTCOME  - Default outcome for dates without explicit outcome
 *   DRY_RUN          - If 'true', preview changes without writing
 *   GITHUB_ACTOR     - User recording the outcomes
 */

import { readFile, writeFile, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getHistoricalPrediction, generateSchoolDays } from './backfill-predictions.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const dataDir = path.join(repoRoot, 'public', 'data')

const actor = process.env.GITHUB_ACTOR || 'batch-update'
const dryRun = process.env.DRY_RUN === 'true'

/**
 * Load JSON file if it exists
 */
async function loadJsonIfExists(filePath) {
  try {
    await access(filePath)
    const raw = await readFile(filePath, 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * Sanitize probability value to 0-100 scale
 */
function sanitizeProbability(value) {
  if (value === null || value === undefined) return null
  
  const cleaned = typeof value === 'string' ? value.replace('%', '').trim() : value
  const num = Number(cleaned)
  if (Number.isNaN(num) || !Number.isFinite(num)) return null
  
  // Normalize 0-1 scale to 0-100
  const normalized = (num > 0 && num < 1) ? num * 100 : num
  return Math.max(0, Math.min(100, Math.round(normalized)))
}

/**
 * Parse CSV-style input into outcome entries
 * Format: date,outcome[,noSchoolReason][,notes]
 */
function parseCSV(csv) {
  const lines = csv.trim().split('\n').filter(line => line.trim())
  const entries = []
  
  for (const line of lines) {
    const parts = line.split(',').map(p => p.trim())
    const [date, outcome, noSchoolReason, ...noteParts] = parts
    
    if (!date || !outcome) {
      console.warn(`Skipping invalid line: ${line}`)
      continue
    }
    
    entries.push({
      date,
      outcome,
      noSchoolReason: noSchoolReason || undefined,
      notes: noteParts.join(',') || undefined
    })
  }
  
  return entries
}

/**
 * Validate date format (YYYY-MM-DD)
 */
function isValidDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  const date = new Date(dateStr + 'T12:00:00')
  return !Number.isNaN(date.getTime())
}

/**
 * Parse date range input (START_DATE, END_DATE, DEFAULT_OUTCOME)
 */
function parseDateRange() {
  const startDate = process.env.START_DATE
  const endDate = process.env.END_DATE
  const defaultOutcome = process.env.DEFAULT_OUTCOME || 'school-open'
  const exceptions = process.env.EXCEPTIONS // JSON: {"2026-01-10": "snow-day"}
  
  if (!startDate || !endDate) return null
  
  // Validate date formats
  if (!isValidDate(startDate)) {
    console.error(`Invalid START_DATE format: ${startDate} (expected YYYY-MM-DD)`)
    process.exit(1)
  }
  if (!isValidDate(endDate)) {
    console.error(`Invalid END_DATE format: ${endDate} (expected YYYY-MM-DD)`)
    process.exit(1)
  }
  
  const schoolDays = generateSchoolDays(startDate, endDate)
  
  let exceptionMap = {}
  if (exceptions) {
    try {
      exceptionMap = JSON.parse(exceptions)
    } catch (e) {
      console.error(`Invalid EXCEPTIONS JSON: ${e.message}`)
      console.error('Expected format: {"2026-01-10": "snow-day", "2026-01-15": "no-school"}')
      process.exit(1)
    }
  }
  
  return schoolDays.map(date => ({
    date,
    outcome: exceptionMap[date] || defaultOutcome
  }))
}

/**
 * Build outcome entry with historical prediction data
 */
function buildEntry(input, existingEntry = null) {
  const { date, outcome, noSchoolReason, notes, rhsPrediction } = input
  const isNoSchool = outcome === 'no-school'
  
  // Try to get historical prediction from git
  const historicalPrediction = getHistoricalPrediction(date)
  
  // Use historical data if found, fall back to existing entry
  const probability = historicalPrediction?.probability ?? 
    sanitizeProbability(existingEntry?.modelProbability)
  const confidence = historicalPrediction?.confidence ?? 
    existingEntry?.confidence
  const predictionTimestamp = historicalPrediction?.timestamp ?? 
    existingEntry?.predictionTimestamp
  
  const entry = {
    date: date.trim(), // Sanitize any whitespace
    modelProbability: probability,
    rhsPrediction: sanitizeProbability(rhsPrediction) ?? 
      sanitizeProbability(existingEntry?.rhsPrediction) ?? undefined,
    confidence: confidence || undefined,
    predictionTimestamp: predictionTimestamp || undefined,
    actualSnowDay: isNoSchool ? null : outcome === 'snow-day',
    recordedAt: new Date().toISOString(),
    recordedBy: actor,
    notes: notes || undefined,
    source: 'batch-workflow'
  }
  
  if (isNoSchool) {
    entry.noSchoolScheduled = true
    if (noSchoolReason) {
      entry.noSchoolReason = noSchoolReason
    }
  }
  
  // Clean up undefined values
  Object.keys(entry).forEach(key => {
    if (entry[key] === undefined) delete entry[key]
  })
  
  return entry
}

/**
 * Main batch update function
 */
async function main() {
  // Parse input from various sources
  let entries = []
  
  // Priority: JSON data > CSV > Date range
  if (process.env.OUTCOMES_DATA) {
    entries = JSON.parse(process.env.OUTCOMES_DATA)
    console.log(`Parsed ${entries.length} entries from JSON data`)
  } else if (process.env.OUTCOMES_CSV) {
    entries = parseCSV(process.env.OUTCOMES_CSV)
    console.log(`Parsed ${entries.length} entries from CSV data`)
  } else {
    entries = parseDateRange()
    if (entries) {
      console.log(`Generated ${entries.length} entries from date range`)
    }
  }
  
  if (!entries || entries.length === 0) {
    console.error('No outcome entries provided.')
    console.error('Set OUTCOMES_DATA (JSON), OUTCOMES_CSV, or START_DATE/END_DATE/DEFAULT_OUTCOME')
    process.exit(1)
  }
  
  // Validate outcomes
  const validOutcomes = ['snow-day', 'school-open', 'no-school']
  for (const entry of entries) {
    if (!validOutcomes.includes(entry.outcome)) {
      console.error(`Invalid outcome "${entry.outcome}" for date ${entry.date}`)
      console.error('Valid outcomes: snow-day, school-open, no-school')
      process.exit(1)
    }
  }
  
  // Load existing ledger
  const outcomesPath = path.join(dataDir, 'outcomes.json')
  const existingLedger = await loadJsonIfExists(outcomesPath) || []
  
  console.log(`\nProcessing ${entries.length} outcomes...`)
  console.log('─'.repeat(60))
  
  const results = []
  
  for (const input of entries) {
    // Find existing entry (handle whitespace in dates)
    const existingEntry = existingLedger.find(e => e.date?.trim() === input.date.trim())
    
    // Build new entry with historical prediction
    const newEntry = buildEntry(input, existingEntry)
    results.push(newEntry)
    
    // Log what we're doing
    const predictionInfo = newEntry.modelProbability !== undefined 
      ? `${newEntry.modelProbability}%` 
      : 'no prediction'
    const outcomeLabel = newEntry.noSchoolScheduled 
      ? `no-school (${newEntry.noSchoolReason || 'unspecified'})`
      : newEntry.actualSnowDay ? 'snow-day' : 'school-open'
    
    console.log(`${newEntry.date}: ${outcomeLabel} | Blizzard: ${predictionInfo}`)
  }
  
  console.log('─'.repeat(60))
  
  if (dryRun) {
    console.log('\n🔍 DRY RUN - No changes written')
    console.log('\nEntries that would be written:')
    console.log(JSON.stringify(results, null, 2))
    return
  }
  
  // Merge with existing ledger
  const dateSet = new Set(results.map(e => e.date))
  const filtered = existingLedger.filter(e => !dateSet.has(e.date?.trim()))
  
  // Also clean up any entries with whitespace issues
  const sanitizedFiltered = filtered.map(e => ({
    ...e,
    date: e.date?.trim()
  }))
  
  const merged = [...sanitizedFiltered, ...results]
  
  // Sort by date descending
  merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  
  // Normalize entries (remove empty fields)
  const normalized = merged.map(entry => {
    const clone = { ...entry }
    if (!clone.notes) delete clone.notes
    if (!clone.confidence) delete clone.confidence
    if (!clone.predictionTimestamp) delete clone.predictionTimestamp
    if (clone.modelProbability === null || clone.modelProbability === undefined) delete clone.modelProbability
    if (clone.rhsPrediction === null || clone.rhsPrediction === undefined) delete clone.rhsPrediction
    delete clone.studentPrediction // Legacy field cleanup
    return clone
  })
  
  // Write updated ledger
  const json = JSON.stringify(normalized, null, 2)
  await writeFile(outcomesPath, `${json}\n`, 'utf8')
  
  console.log(`\n✓ Recorded ${results.length} outcomes`)
  console.log(`  Total entries in ledger: ${normalized.length}`)
  
  // Summary stats
  const snowDays = results.filter(e => e.actualSnowDay === true).length
  const schoolOpen = results.filter(e => e.actualSnowDay === false).length
  const noSchool = results.filter(e => e.noSchoolScheduled).length
  const withPredictions = results.filter(e => e.modelProbability !== undefined).length
  
  console.log(`\nSummary:`)
  console.log(`  Snow days: ${snowDays}`)
  console.log(`  School open: ${schoolOpen}`)
  console.log(`  No school (holiday/weekend): ${noSchool}`)
  console.log(`  With Blizzard predictions: ${withPredictions}/${results.length}`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
