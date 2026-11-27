import { readFile, mkdir, open, rename, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'

export function calendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) {
    throw new Error('Expected a real calendar date (YYYY-MM-DD)')
  }
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('Expected a real calendar date (YYYY-MM-DD)')
  }
  return value
}

// Stored estimates are percentages and may have legacy decimal precision. New overrides must be whole percentages.
export function probability(value, { optional = true, stored = false } = {}) {
  if (stored && value !== null && value !== undefined && typeof value !== 'number') throw new Error('Stored probability must be numeric')
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    if (optional) return null
    throw new Error('Probability is required')
  }
  if (typeof value === 'string') {
    if (!/^\d+(?:\.\d+)?%?$/.test(value.trim())) throw new Error('Probability must be a whole percentage from 0–100')
    value = Number(value.trim().replace(/%$/, ''))
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error('Probability must be a percentage from 0–100')
  }
  if (!stored && !Number.isInteger(value)) throw new Error('Probability must be a whole percentage from 0–100')
  return value
}

export const confidenceLevels = ['very_low', 'low', 'moderate', 'high', 'very_high']
export const outcomeNames = ['snow-day', 'school-open', 'no-school']
export function assertTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error('Expected an ISO timestamp')
  }
  calendarDate(value.slice(0, 10))
  return value
}

export function validateRoadStudy(study, lockedAt) {
  if (study?.version !== 1) throw new Error('Invalid road study version')
  const { observation, iceWindow, iceOnly, iceAndRoutes } = study
  if (observation !== null) {
    if (!['highway', 'county-road', 'local-street'].includes(observation?.roadClass) ||
        !['clear', 'wet', 'treated', 'icy', 'snow-covered'].includes(observation.condition)) throw new Error('Invalid road class or condition')
    assertTimestamp(observation.observedAt)
    if (Date.parse(observation.observedAt) > Date.parse(lockedAt)) throw new Error('Road observation is later than submission')
    if (typeof observation.source !== 'string' || observation.source.length > 512) throw new Error('Expected a public road report link')
    const url = new URL(observation.source)
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Expected a public HTTPS road report link')
  }
  if (iceWindow === null) {
    if (iceOnly !== null || iceAndRoutes !== null) throw new Error('Incomplete weather cannot produce study probabilities')
    return
  }
  for (const p of [iceOnly, iceAndRoutes]) probability(p, { stored: true, optional: false })
  const { firstIceHour, lastIceHour, frozenThroughHour, iceType } = iceWindow
  const validHour = hour => Number.isInteger(hour) && hour >= -3 && hour <= 8
  if (iceType === 'none' && [firstIceHour, lastIceHour, frozenThroughHour].every(hour => hour === null)) return
  if (!['freezing precipitation', 'refreeze'].includes(iceType) || !validHour(firstIceHour) ||
      !validHour(lastIceHour) || firstIceHour > lastIceHour ||
      (frozenThroughHour !== null && (!validHour(frozenThroughHour) || frozenThroughHour < lastIceHour))) throw new Error('Invalid frozen ice window')
}

export function validateSubmission(date, submission) {
  const { modelProbability, rhsPrediction, forecastTimestamp, lockedAt, revision } = submission
  probability(modelProbability, { stored: true, optional: false })
  probability(rhsPrediction, { stored: true, optional: false })
  assertTimestamp(forecastTimestamp)
  assertTimestamp(lockedAt)
  const localDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Detroit' }).format(new Date(lockedAt))
  if (localDay >= date || Date.parse(forecastTimestamp) > Date.parse(lockedAt)) throw new Error('Submission missed the pre-day cutoff')
  if (submission.roadStudy !== undefined) validateRoadStudy(submission.roadStudy, lockedAt)
  if (!/^[0-9a-f]{40}$/.test(revision)) throw new Error('Submission requires a forecast revision')
}

export function validateLedger(value) {
  if (!Array.isArray(value)) throw new Error('Outcomes must be an array; refusing to replace existing history')
  const dates = new Set()
  for (const row of value) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Invalid outcome record')
    calendarDate(row.date)
    if (dates.has(row.date)) throw new Error('Duplicate outcome date; reconcile history explicitly')
    dates.add(row.date)
    if (row.actualSnowDay !== null && typeof row.actualSnowDay !== 'boolean') throw new Error('Invalid actualSnowDay')
    for (const key of ['modelProbability', 'rhsPrediction']) probability(row[key], { stored: true })
    if (row.competitionSubmission !== undefined) validateSubmission(row.date, row.competitionSubmission)
    if (row.confidence != null && !confidenceLevels.includes(row.confidence)) throw new Error('Invalid confidence')
    for (const key of ['predictionTimestamp', 'recordedAt']) if (row[key] != null) assertTimestamp(row[key])
    for (const key of ['notes', 'noSchoolReason', 'recordedBy', 'source', 'predictionCommit']) {
      if (row[key] != null && typeof row[key] !== 'string') throw new Error(`Invalid ${key}`)
    }
    if (row.noSchoolScheduled != null && typeof row.noSchoolScheduled !== 'boolean') throw new Error('Invalid noSchoolScheduled')
    if (row.noSchoolScheduled === true && row.actualSnowDay !== null) throw new Error('Scheduled no-school cannot have a closure outcome')
    if (row.predictionSource != null && !['manual', 'saved', 'history'].includes(row.predictionSource)) throw new Error('Invalid predictionSource')
  }
  return value
}

// Only ENOENT is absence. Parse, permissions and I/O failures must remain failures.
export async function readJson(file, fallback = null) {
  let handle
  try {
    handle = await open(file, 'r')
    const stat = await handle.stat()
    const maximum = 2 * 1024 * 1024
    if (!stat.isFile() || stat.size > maximum) throw new Error('JSON file exceeds the 2 MiB input limit')
    const buffer = Buffer.alloc(stat.size + 1)
    let offset = 0
    while (offset < buffer.length) {
      const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset)
      if (bytesRead === 0) break
      offset += bytesRead
    }
    if (offset > stat.size) throw new Error('JSON changed while reading; retry against a stable snapshot')
    return JSON.parse(buffer.subarray(0, offset).toString('utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return fallback
    throw new Error(`Cannot read valid bounded JSON from ${file}; existing data preserved`, { cause: error })
  } finally { await handle?.close() }
}

export async function readLedger(file, { allowMissing = false, fallbackFile } = {}) {
  const missing = Symbol()
  const value = await readJson(file, missing)
  if (value === missing) {
    if (fallbackFile) return readLedger(fallbackFile)
    if (allowMissing) return []
    throw new Error('Outcome ledger is missing; restore it before continuing')
  }
  return validateLedger(value)
}

async function stageBytes(file, content) {
  await mkdir(dirname(file), { recursive: true })
  const temp = join(dirname(file), `.${randomUUID()}.tmp`)
  const handle = await open(temp, 'wx', 0o600)
  try { await handle.writeFile(content); await handle.sync() }
  catch (error) { await rm(temp, { force: true }); throw error }
  finally { await handle.close() }
  return temp
}

export async function atomicJsonBatch(files) {
  const prepared = []
  const committed = []
  try {
    // Stage every file before touching any destination. A write/disk failure leaves originals intact.
    for (const [file, value] of files) {
      const content = `${JSON.stringify(value, null, 2)}\n`
      if (Buffer.byteLength(content) > 2 * 1024 * 1024) throw new Error('JSON snapshot exceeds the 2 MiB size limit; existing files preserved')
      let original = null
      try { original = await readFile(file, 'utf8') } catch (error) { if (error.code !== 'ENOENT') throw error }
      if (original === content) continue
      prepared.push({ file, original, temp: await stageBytes(file, content) })
    }
    for (const item of prepared) {
      await rename(item.temp, item.file)
      committed.push(item)
    }
    return prepared.length > 0
  } catch (error) {
    // Renames are atomic per file. Roll back a normal commit error; Git+Pages is the published snapshot boundary.
    const recoveryErrors = []
    for (const item of committed.reverse()) {
      try {
        if (item.original === null) await rm(item.file, { force: true })
        else await rename(await stageBytes(item.file, item.original), item.file)
      } catch (recoveryError) { recoveryErrors.push(recoveryError) }
    }
    if (recoveryErrors.length) throw new AggregateError([error, ...recoveryErrors], 'Snapshot recovery failed; inspect working files before retrying')
    throw error
  } finally {
    for (const item of prepared) await rm(item.temp, { force: true })
  }
}

export async function atomicJson(file, value) {
  return atomicJsonBatch([[file, value]])
}

// Across local processes too. Never steal a lock whose owner may still be writing.
export async function withDataLock(dir, operation) {
  await mkdir(dir, { recursive: true })
  const lock = join(dir, '.blizzard-write.lock')
  try { await mkdir(lock) } catch (error) {
    if (error.code === 'EEXIST') throw new Error('Another data writer holds the lock; retry after it completes')
    throw error
  }
  try { return await operation() } finally { await rm(lock, { recursive: true }) }
}

export function upsertLedger(ledger, entry) {
  validateLedger(ledger)
  validateLedger([entry])
  const existing = ledger.find(row => row.date === entry.date)
  const semantic = row => {
    return JSON.stringify(Object.fromEntries(Object.entries(row)
      .filter(([key, value]) => !['recordedAt', 'recordedBy', 'source'].includes(key) && value !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))))
  }
  if (existing && semantic(existing) === semantic(entry)) return ledger
  return [...ledger.filter(row => row.date !== entry.date), entry].sort((a, b) => b.date.localeCompare(a.date))
}
