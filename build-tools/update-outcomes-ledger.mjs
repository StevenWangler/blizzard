#!/usr/bin/env node
import { readFile, writeFile, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const dataDir = path.join(repoRoot, 'public', 'data')

const eventDate = process.env.EVENT_DATE
const outcome = process.env.OUTCOME
const notes = process.env.NOTES || ''
const manualProbability = process.env.MANUAL_PROBABILITY
const actor = process.env.GITHUB_ACTOR || 'unknown'

if (!eventDate) {
  console.error('EVENT_DATE is required (expected YYYY-MM-DD).')
  process.exit(1)
}

if (!outcome || !['snow-day', 'school-open'].includes(outcome)) {
  console.error('OUTCOME must be "snow-day" or "school-open".')
  process.exit(1)
}

const outcomesPath = path.join(dataDir, 'outcomes.json')
const summaryPath = path.join(dataDir, 'summary.json')
const predictionPath = path.join(dataDir, 'prediction.json')

const loadJsonIfExists = async (targetPath) => {
  try {
    await access(targetPath)
    const raw = await readFile(targetPath, 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    return null
  }
}

const sanitizeProbability = (value) => {
  if (value === null || value === undefined) return null
  const num = Number(value)
  if (Number.isNaN(num)) return null
  if (!Number.isFinite(num)) return null
  return Math.max(0, Math.min(100, Math.round(num)))
}

const buildEntry = async () => {
  const summary = await loadJsonIfExists(summaryPath)
  const prediction = await loadJsonIfExists(predictionPath)

  let probability = sanitizeProbability(manualProbability)
  let confidence = null
  let predictionTimestamp = null

  if (!probability && summary) {
    probability = sanitizeProbability(summary.probability)
    confidence = summary.confidence || null
    predictionTimestamp = summary.timestamp || null
  }

  if (!probability && prediction?.final) {
    probability = sanitizeProbability(prediction.final.snow_day_probability)
    confidence = confidence || prediction.final.confidence_level || null
    predictionTimestamp = predictionTimestamp || prediction.timestamp || null
  }

  return {
    date: eventDate,
    modelProbability: probability,
    confidence: confidence || null,
    predictionTimestamp,
    actualSnowDay: outcome === 'snow-day',
    recordedAt: new Date().toISOString(),
    recordedBy: actor,
    notes: notes || undefined,
    source: 'workflow'
  }
}

const writeLedger = async () => {
  const entry = await buildEntry()
  const raw = await loadJsonIfExists(outcomesPath)
  const ledger = Array.isArray(raw) ? raw : []

  const filtered = ledger.filter(item => item && item.date !== eventDate)
  filtered.push(entry)

  filtered.sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime()
  })

  const normalized = filtered.map(item => {
    const clone = { ...item }
    if (!clone.notes) delete clone.notes
    if (!clone.confidence) delete clone.confidence
    if (!clone.predictionTimestamp) delete clone.predictionTimestamp
    if (clone.modelProbability === null || clone.modelProbability === undefined) delete clone.modelProbability
    return clone
  })

  const json = JSON.stringify(normalized, null, 2)
  await writeFile(outcomesPath, `${json}\n`, 'utf8')

  console.log(`Logged outcome for ${eventDate} (${entry.actualSnowDay ? 'snow day' : 'school open'})`)
}

writeLedger().catch(error => {
  console.error(error)
  process.exit(1)
})
