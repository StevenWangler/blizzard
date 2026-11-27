import { test } from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { Agent, run, tool, RunContext, Usage, setTracingDisabled } from '@openai/agents'
import { readFileSync } from 'node:fs'
import { convertAgentOutputTypeToSerializable, getSchemaAndParserFromInputType } from '../../node_modules/@openai/agents-core/dist/utils/tools.mjs'
import { projectAgentSchemas, fixtureForSchema } from './agent-schema-fixtures.mjs'

setTracingDisabled(true)
const schemas = projectAgentSchemas(z)
const baseline = JSON.parse(readFileSync(new URL('./fixtures/agent-schema-contract.json', import.meta.url), 'utf8')).schemas
test('offline SDK contract covers every actual model and tool schema', () => {
  const signatures = entries => entries.map(e => [e.source, e.name, e.kind].join(':')).sort()
  assert.deepEqual(signatures(schemas), signatures(baseline))
  assert.ok(schemas.some(entry => entry.source.endsWith('forecast-integrity.mjs') && entry.name === 'FinalPredictionSchema'))
})
for (const entry of schemas) {
  test(`${entry.source}: ${entry.name} validates through the actual SDK parser offline`, () => {
    const fixture = fixtureForSchema(entry.schema)
    const expected = entry.schema.parse(fixture)
    if (entry.kind === 'output') {
      const format = convertAgentOutputTypeToSerializable(entry.schema)
      assert.ok(format.schema?.properties)
      const before = baseline.find(item => item.source === entry.source && item.name === entry.name && item.kind === entry.kind)
      assert.ok(before, 'Every schema needs an explicitly reviewed baseline')
      assert.equal(format.strict, before.strict, 'Migration must not silently weaken a strict transport')
      const agent = new Agent({ name: 'offline-schema-check', outputType: entry.schema })
      assert.deepEqual(agent.processFinalOutput(JSON.stringify(fixture)), expected)
    } else {
      const converted = getSchemaAndParserFromInputType(entry.schema, entry.name, { strict: true })
      assert.ok(converted.schema?.properties)
      assert.deepEqual(converted.parser(JSON.stringify(fixture)), expected)
    }
    assert.equal(entry.schema.safeParse({ unexpected: true }).success,
      entry.name === 'get_weather_data', 'Required fields must not silently disappear; only the defaulted weather tool accepts {}')
  })
}
test('final probability wire constraints and tool minimum cardinality survive conversion', () => {
  const final = schemas.find(entry => entry.source.endsWith('forecast-integrity.mjs') && entry.name === 'FinalPredictionSchema')
  const format = convertAgentOutputTypeToSerializable(final.schema)
  assert.equal(format.strict, true)
  assert.equal(format.schema.properties.snow_day_probability.type, 'integer')
  assert.equal(format.schema.properties.snow_day_probability.minimum, 0)
  assert.equal(format.schema.properties.snow_day_probability.maximum, 100)
  const cross = schemas.find(entry => entry.kind === 'tool' && entry.name === 'cross_check_experts')
  const converted = getSchemaAndParserFromInputType(cross.schema, cross.name, { strict: true })
  assert.equal(converted.schema.properties.experts.minItems, 2)
  const fixture = fixtureForSchema(cross.schema)
  assert.throws(() => converted.parser(JSON.stringify({ ...fixture, experts: fixture.experts.slice(0, 1) })))
  assert.throws(() => converted.parser(JSON.stringify({ ...fixture, experts: ['unknown', 'unknown'] })))
})
test('dictionary parsing retains dynamic keys and rejects invalid values', () => {
  const dictionary = z.record(z.string(), z.number())
  assert.deepEqual(dictionary.parse({ district: 1, other: 2 }), { district: 1, other: 2 })
  assert.equal(dictionary.safeParse({ district: 'not numeric' }).success, false)
})
test('defaulted tool fields preserve false and the original focus period', () => {
  const weather = schemas.find(entry => entry.name === 'get_weather_data')
  const converted = getSchemaAndParserFromInputType(weather.schema, weather.name, { strict: true })
  assert.deepEqual(converted.parser('{}'), { include_raw_data: false, focus_period: 'next_24_hours' })
  assert.throws(() => converted.parser('{"focus_period":"unknown"}'))
})
test('actual coordinator SDK parsing rejects malformed numbers and enum values', () => {
  const entry = schemas.find(entry => entry.source.endsWith('forecast-integrity.mjs') && entry.name === 'FinalPredictionSchema')
  const agent = new Agent({ name: 'offline-coordinator', outputType: entry.schema })
  const fixture = fixtureForSchema(entry.schema)
  for (const probability of [-1, 101, 0.5, '0', null]) {
    assert.throws(() => agent.processFinalOutput(JSON.stringify({ ...fixture, snow_day_probability: probability })))
  }
  assert.throws(() => agent.processFinalOutput(JSON.stringify({ ...fixture, confidence_level: 'invented' })))
  for (const probability of [0, 100]) {
    assert.equal(agent.processFinalOutput(JSON.stringify({ ...fixture, snow_day_probability: probability })).snow_day_probability, probability)
  }
})
test('optional output fields remain absent and explicit null is not silently accepted', () => {
  for (const entry of schemas.filter(entry => ['NewsAnalysisSchema', 'DebatePositionSchema'].includes(entry.name))) {
    const fixture = fixtureForSchema(entry.schema)
    const agent = new Agent({ name: 'offline-optionals', outputType: entry.schema })
    const output = agent.processFinalOutput(JSON.stringify(fixture))
    if (entry.name === 'NewsAnalysisSchema') {
      assert.equal(output.local_news[0].url, undefined)
      const invalid = structuredClone(fixture)
      invalid.local_news[0].url = null
      assert.throws(() => agent.processFinalOutput(JSON.stringify(invalid)))
    } else {
      assert.equal(output.challenges, undefined)
      assert.equal(output.adjustments_from_peer_input, undefined)
      assert.throws(() => agent.processFinalOutput(JSON.stringify({ ...fixture, challenges: null })))
    }
  }
})
test('SDK parsing strips unknown prototype fields without polluting objects', () => {
  const entry = schemas.find(entry => entry.source.endsWith('forecast-integrity.mjs') && entry.name === 'FinalPredictionSchema')
  const agent = new Agent({ name: 'offline-unknown-fields', outputType: entry.schema })
  const payload = JSON.stringify(fixtureForSchema(entry.schema)).replace('{', '{"__proto__":{"blizzardPolluted":true},')
  const parsed = agent.processFinalOutput(payload)
  assert.equal(Object.hasOwn(parsed, '__proto__'), false)
  assert.equal({}.blizzardPolluted, undefined)
})

test('actual strict tool factory preserves closure, parser defaults and validation', async () => {
  for (const entry of schemas.filter(entry => entry.kind === 'tool')) {
    const contractTool = tool({ name: entry.name, description: 'Offline schema check', parameters: entry.schema,
      execute: async value => JSON.stringify(value) })
    assert.equal(contractTool.strict, true)
    assert.equal(contractTool.parameters.additionalProperties, false)
    assert.deepEqual([...contractTool.parameters.required].sort(), Object.keys(contractTool.parameters.properties).sort())
    const fixture = fixtureForSchema(entry.schema)
    const result = await contractTool.invoke(new RunContext({}), JSON.stringify(fixture))
    assert.deepEqual(JSON.parse(result), entry.schema.parse(fixture))
  }
})
test('supported optional-output fallback retains enums and local numeric validators', () => {
  const canary = z.object({ probability: z.number().int().min(0).max(100),
    relevance: z.enum(['high', 'medium', 'low']), url: z.string().optional() })
  const wire = convertAgentOutputTypeToSerializable(canary)
  assert.equal(wire.strict, false) // Explicit, pre-existing fallback; not advertised as strict.
  assert.deepEqual(wire.schema.properties.relevance.enum, ['high', 'medium', 'low'])
  const agent = new Agent({ name: 'offline-optional-enum', outputType: canary })
  for (const probability of [-1, 101, 0.5, '0']) assert.throws(() => agent.processFinalOutput(JSON.stringify({ probability, relevance: 'high' })))
  assert.throws(() => agent.processFinalOutput('{"probability":20,"relevance":"invented"}'))
  assert.deepEqual(agent.processFinalOutput('{"probability":0,"relevance":"high"}'), { probability: 0, relevance: 'high' })
})
test('real SDK runner forwards limits and parses a mocked model response without network', async () => {
  const entry = schemas.find(entry => entry.source.endsWith('forecast-integrity.mjs') && entry.name === 'FinalPredictionSchema')
  const fixture = fixtureForSchema(entry.schema)
  let captured
  const model = {
    async getResponse(request) {
      captured = request
      return { usage: new Usage(), responseId: 'synthetic-offline-response', output: [{
        type: 'message', role: 'assistant', status: 'completed',
        content: [{ type: 'output_text', text: JSON.stringify(fixture) }]
      }] }
    },
    getStreamedResponse() { throw new Error('Streaming is not part of this offline test') }
  }
  const agent = new Agent({ name: 'offline-runner', model, outputType: entry.schema,
    modelSettings: { maxTokens: 6000, reasoning: { effort: 'high' } } })
  const signal = AbortSignal.timeout(1000)
  const result = await run(agent, 'Synthetic fixture only', { maxTurns: 4, signal })
  assert.deepEqual(result.finalOutput, fixture)
  assert.equal(captured.modelSettings.maxTokens, 6000)
  assert.equal(captured.modelSettings.reasoning.effort, 'high')
  assert.equal(captured.outputType.strict, true)
  assert.ok(captured.signal)
})
