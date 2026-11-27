#!/usr/bin/env node
// Fail on conversion errors or newly weakened transport modes. Four reviewed
// optional-output fallbacks remain explicit warnings, matching the v3 baseline.
import { z } from 'zod'
import { readFileSync } from 'node:fs'
import { convertAgentOutputTypeToSerializable, getSchemaAndParserFromInputType } from '../node_modules/@openai/agents-core/dist/utils/tools.mjs'
import { projectAgentSchemas } from './tests/agent-schema-fixtures.mjs'
const packageVersion = name => JSON.parse(readFileSync(new URL(`../node_modules/${name}/package.json`, import.meta.url), 'utf8')).version
const baseline = JSON.parse(readFileSync(new URL('./tests/fixtures/agent-schema-contract.json', import.meta.url), 'utf8')).schemas
const report = { installedZod: packageVersion('zod'), installedSDK: packageVersion('@openai/agents'), schemas: [], warnings: [] }
for (const entry of projectAgentSchemas(z)) {
  try {
    const prior = baseline.find(item => item.source === entry.source && item.name === entry.name && item.kind === entry.kind)
    if (!prior) throw new Error('Unreviewed schema: baseline contract must be updated explicitly')
    const result = entry.kind === 'output'
      ? convertAgentOutputTypeToSerializable(entry.schema)
      : getSchemaAndParserFromInputType(entry.schema, entry.name, { strict: true })
    if (entry.kind === 'output' && result.strict !== prior.strict) throw new Error('Transport mode differs from reviewed baseline')
    if (entry.kind === 'output' && result.strict === false) report.warnings.push(`${entry.source}:${entry.name}: existing non-strict wire fallback; local validators remain mandatory`)
    report.schemas.push({ source: entry.source, name: entry.name, kind: entry.kind, converted: true,
      ...(entry.kind === 'output' ? { strict: result.strict } : {}) })
  } catch (error) {
    report.schemas.push({ source: entry.source, name: entry.name, kind: entry.kind, converted: false, reason: error.message })
  }
}
report.ok = report.schemas.length === baseline.length && report.schemas.every(entry => entry.converted)
console.log(JSON.stringify(report, null, 2))
if (!report.ok) process.exitCode = 1
