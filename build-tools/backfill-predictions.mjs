#!/usr/bin/env node
/**
 * backfill-predictions.mjs
 * 
 * Retrieves historical Blizzard predictions from git history by matching
 * summary.json's targetDate to school days. Useful for:
 * - Filling in missing modelProbability values in outcomes.json
 * - Generating reports of what Blizzard predicted for past dates
 * - Supporting batch outcome recording with accurate historical data
 * 
 * Usage:
 *   node build-tools/backfill-predictions.mjs --dates 2026-01-05,2026-01-06,2026-01-07
 *   node build-tools/backfill-predictions.mjs --range 2026-01-05 2026-01-16
 *   node build-tools/backfill-predictions.mjs --patch  # Updates outcomes.json with missing predictions
 */

import { execSync } from 'node:child_process'
import { readFile, writeFile, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const dataDir = path.join(repoRoot, 'public', 'data')

/**
 * Get the last (most recent) prediction for a specific targetDate from git history.
 * Returns the prediction closest to the event date for best accuracy.
 */
function getHistoricalPrediction(targetDate) {
  try {
    // Get all commits that touched summary.json
    const commitsRaw = execSync(
      'git log --all --format="%H" -- public/data/summary.json',
      { cwd: repoRoot, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
    )
    
    const commits = commitsRaw.trim().split('\n').filter(Boolean)
    
    // Search through commits to find the LAST one with this targetDate
    // (most recent prediction for that school day)
    for (const commit of commits) {
      try {
        const summaryRaw = execSync(
          `git show "${commit}:public/data/summary.json"`,
          { cwd: repoRoot, encoding: 'utf8', maxBuffer: 1024 * 1024 }
        )
        
        const summary = JSON.parse(summaryRaw)
        
        if (summary.targetDate === targetDate) {
          return {
            probability: summary.probability,
            confidence: summary.confidence,
            timestamp: summary.timestamp,
            targetDate: summary.targetDate,
            commit: commit.substring(0, 8)
          }
        }
      } catch {
        // Skip commits where summary.json doesn't exist or is invalid
        continue
      }
    }
    
    return null
  } catch (error) {
    console.error(`Error searching git history for ${targetDate}:`, error.message)
    return null
  }
}

/**
 * Generate array of dates between start and end (inclusive), excluding weekends
 */
function generateSchoolDays(startDate, endDate) {
  const dates = []
  const current = new Date(startDate + 'T12:00:00')
  const end = new Date(endDate + 'T12:00:00')
  
  while (current <= end) {
    const dayOfWeek = current.getDay()
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      dates.push(current.toISOString().split('T')[0])
    }
    current.setDate(current.getDate() + 1)
  }
  
  return dates
}

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
 * Main function
 */
async function main() {
  const args = process.argv.slice(2)
  
  // Parse arguments
  let dates = []
  let patchMode = false
  let reportOnly = true
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    
    if (arg === '--dates' && args[i + 1]) {
      dates = args[i + 1].split(',').map(d => d.trim())
      i++
    } else if (arg === '--range' && args[i + 1] && args[i + 2]) {
      dates = generateSchoolDays(args[i + 1], args[i + 2])
      i += 2
    } else if (arg === '--patch') {
      patchMode = true
      reportOnly = false
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage:
  node build-tools/backfill-predictions.mjs --dates 2026-01-05,2026-01-06
  node build-tools/backfill-predictions.mjs --range 2026-01-05 2026-01-16
  node build-tools/backfill-predictions.mjs --patch

Options:
  --dates <list>      Comma-separated list of dates (YYYY-MM-DD)
  --range <start> <end>  Date range (excludes weekends)
  --patch             Update outcomes.json with missing predictions
  --help              Show this help
`)
      process.exit(0)
    }
  }
  
  // If patch mode with no dates, find pending entries in outcomes.json
  if (patchMode && dates.length === 0) {
    const outcomesPath = path.join(dataDir, 'outcomes.json')
    const outcomes = await loadJsonIfExists(outcomesPath) || []
    
    // Find entries with null/undefined modelProbability OR where probability looks like a placeholder
    dates = outcomes
      .filter(o => o.modelProbability === null || o.modelProbability === undefined)
      .map(o => o.date?.trim())
      .filter(Boolean)
    
    if (dates.length === 0) {
      console.log('No entries with missing predictions found in outcomes.json')
      process.exit(0)
    }
    
    console.log(`Found ${dates.length} entries with missing predictions`)
  }
  
  if (dates.length === 0) {
    console.error('No dates specified. Use --dates, --range, or --patch')
    process.exit(1)
  }
  
  console.log(`\nSearching git history for ${dates.length} date(s)...\n`)
  
  const results = []
  
  for (const date of dates) {
    const prediction = getHistoricalPrediction(date)
    
    if (prediction) {
      results.push({
        date,
        ...prediction,
        found: true
      })
      console.log(`✓ ${date}: ${prediction.probability}% (${prediction.confidence}) from commit ${prediction.commit}`)
    } else {
      results.push({ date, found: false })
      console.log(`✗ ${date}: No prediction found in git history`)
    }
  }
  
  // Summary
  const found = results.filter(r => r.found).length
  console.log(`\nFound predictions for ${found}/${dates.length} dates`)
  
  // Patch mode: update outcomes.json
  if (patchMode && found > 0) {
    const outcomesPath = path.join(dataDir, 'outcomes.json')
    const outcomes = await loadJsonIfExists(outcomesPath) || []
    
    let updated = 0
    
    for (const result of results) {
      if (!result.found) continue
      
      // Find the matching entry (handle potential whitespace in dates)
      const idx = outcomes.findIndex(o => o.date?.trim() === result.date)
      
      if (idx !== -1) {
        // Only update if modelProbability is missing
        if (outcomes[idx].modelProbability === null || outcomes[idx].modelProbability === undefined) {
          outcomes[idx].modelProbability = result.probability
          outcomes[idx].confidence = result.confidence
          outcomes[idx].predictionTimestamp = result.timestamp
          updated++
        }
      }
    }
    
    if (updated > 0) {
      const json = JSON.stringify(outcomes, null, 2)
      await writeFile(outcomesPath, `${json}\n`, 'utf8')
      console.log(`\nPatched ${updated} entries in outcomes.json`)
    } else {
      console.log('\nNo entries needed patching')
    }
  }
  
  // Output JSON for scripting use
  if (process.env.OUTPUT_JSON === 'true') {
    console.log('\n--- JSON OUTPUT ---')
    console.log(JSON.stringify(results, null, 2))
  }
  
  return results
}

// Export for use as module
export { getHistoricalPrediction, generateSchoolDays }

// Run if called directly (not imported as module)
const isMainModule = import.meta.url === `file://${process.argv[1]}`
if (isMainModule) {
  main().catch(error => {
    console.error(error)
    process.exit(1)
  })
}
