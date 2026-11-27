// Offline transport for the generator integration test. No request leaves this process.
import assert from 'node:assert/strict'
import { FinalPredictionSchema } from '../../lib/forecast-integrity.mjs'
import { fixtureForSchema } from '../agent-schema-fixtures.mjs'
import { nextSchoolTarget } from '../../lib/forecast-integrity.mjs'

const { mock } = await import('node:test')
mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-26T17:00:00Z') })

const fixture = fixtureForSchema(FinalPredictionSchema)
const targetDate = nextSchoolTarget().targetDate.toISOString().slice(0, 10)
let incomplete = true
let responseNumber = 0

globalThis.fetch = async (url, init) => {
  const { hostname, pathname } = new URL(url)
  if (hostname === 'api.weatherapi.com') {
    return Response.json({ location: { name: 'Rockford', region: 'Michigan' },
      forecast: { forecastday: [{ date: targetDate, day: {}, hour: [{ temp_f: 30 }] }] } })
  }
  if (hostname !== 'api.openai.com' || pathname !== '/v1/responses') throw new Error('Unexpected endpoint')
  const body = JSON.parse(init.body)
  const live = !process.argv.includes('--compare-reasoning')
  assert.equal(body.text.format.strict, true)
  assert.ok(body.text.format.schema.properties.snow_day_probability)
  assert.deepEqual(body.tools?.map(tool => tool.type) ?? [], live ? ['web_search'] : [])
  assert.equal(body.max_tool_calls, live ? 3 : undefined)
  assert.ok(!JSON.stringify(body.input).includes('TEST OUTCOME LEAK'))
  const fail = incomplete && process.argv.includes('--local')
  if (fail) incomplete = false
  const answer = JSON.stringify(fixture)
  return Response.json({ id: 'resp_' + ++responseNumber, object: 'response', model: body.model,
    status: fail ? 'incomplete' : 'completed', incomplete_details: fail ? { reason: 'max_output_tokens' } : null,
    usage: { input_tokens: 100, output_tokens: 30, total_tokens: 130 },
    output: fail ? [] : [{ id: 'msg_' + responseNumber, role: 'assistant', type: 'message', status: 'completed',
      content: [{ type: 'output_text', text: answer, annotations: [] }] }] })
}
