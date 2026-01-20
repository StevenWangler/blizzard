#!/usr/bin/env node
/**
 * sanitize-outcomes.mjs
 * 
 * One-time cleanup script for outcomes.json to fix data quality issues:
 * - Trims whitespace from dates (fixes " 2025-12-10" bug)
 * - Deduplicates entries, preferring those with recorded outcomes
 * - Removes legacy fields
 * 
 * Usage:
 *   node build-tools/sanitize-outcomes.mjs
 *   node build-tools/sanitize-outcomes.mjs --dry-run
 */

import { readFile, writeFile, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const dataDir = path.join(repoRoot, 'public', 'data')

const dryRun = process.argv.includes('--dry-run')

async function loadJsonIfExists(filePath) {
  try {
    await access(filePath)
    const raw = await readFile(filePath, 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

async function main() {
  const outcomesPath = path.join(dataDir, 'outcomes.json')
  const outcomes = await loadJsonIfExists(outcomesPath)
  
  if (!outcomes || !Array.isArray(outcomes)) {
    console.error('Could not load outcomes.json')
    process.exit(1)
  }
  
  console.log(`Loaded ${outcomes.length} entries\n`)
  
  const issues = []
  const sanitized = []
  const seenDates = new Map() // date -> best entry
  
  for (const entry of outcomes) {
    const originalDate = entry.date
    const trimmedDate = originalDate?.trim()
    
    // Track whitespace issues
    if (originalDate !== trimmedDate) {
      issues.push(`Whitespace in date: "${originalDate}" → "${trimmedDate}"`)
    }
    
    // Create sanitized entry
    const clean = {
      ...entry,
      date: trimmedDate
    }
    
    // Remove legacy/empty fields
    delete clean.studentPrediction
    if (!clean.notes) delete clean.notes
    if (!clean.confidence) delete clean.confidence
    if (!clean.predictionTimestamp) delete clean.predictionTimestamp
    if (clean.modelProbability === null || clean.modelProbability === undefined) delete clean.modelProbability
    if (clean.rhsPrediction === null || clean.rhsPrediction === undefined) delete clean.rhsPrediction
    
    // Handle duplicates - prefer entries with actual outcomes
    if (seenDates.has(trimmedDate)) {
      const existing = seenDates.get(trimmedDate)
      
      // Scoring: prefer recorded outcomes over pending
      const existingScore = scoreEntry(existing)
      const newScore = scoreEntry(clean)
      
      if (newScore > existingScore) {
        issues.push(`Duplicate date "${trimmedDate}": keeping entry with better data (score ${newScore} > ${existingScore})`)
        seenDates.set(trimmedDate, clean)
      } else {
        issues.push(`Duplicate date "${trimmedDate}": keeping existing entry (score ${existingScore} >= ${newScore})`)
      }
    } else {
      seenDates.set(trimmedDate, clean)
    }
  }
  
  // Build final array from deduped map
  const final = Array.from(seenDates.values())
  
  // Sort by date descending
  final.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  
  // Report
  console.log('Issues found:')
  if (issues.length === 0) {
    console.log('  None!')
  } else {
    for (const issue of issues) {
      console.log(`  - ${issue}`)
    }
  }
  
  console.log(`\nResult: ${outcomes.length} → ${final.length} entries`)
  
  if (dryRun) {
    console.log('\n🔍 DRY RUN - No changes written')
    console.log('\nSanitized data:')
    console.log(JSON.stringify(final, null, 2))
  } else {
    const json = JSON.stringify(final, null, 2)
    await writeFile(outcomesPath, `${json}\n`, 'utf8')
    console.log('\n✓ Wrote sanitized outcomes.json')
  }
}

/**
 * Score an entry for deduplication preference
 * Higher score = better data quality
 */
function scoreEntry(entry) {
  let score = 0
  
  // Has actual outcome (not null)
  if (entry.actualSnowDay === true || entry.actualSnowDay === false) {
    score += 100
  }
  
  // Has noSchoolScheduled flag
  if (entry.noSchoolScheduled) {
    score += 100
  }
  
  // Has prediction data
  if (entry.modelProbability !== undefined) score += 10
  if (entry.confidence) score += 5
  if (entry.predictionTimestamp) score += 5
  
  // Has RHS prediction (competition data)
  if (entry.rhsPrediction !== undefined) score += 10
  
  // Source preference
  if (entry.source === 'workflow') score += 20
  else if (entry.source === 'batch-workflow') score += 15
  else if (entry.source === 'live') score += 10
  
  // More recent recording
  if (entry.recordedAt) {
    const recTime = new Date(entry.recordedAt).getTime()
    score += recTime / 1e15 // Small bonus for recency
  }
  
  return score
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
