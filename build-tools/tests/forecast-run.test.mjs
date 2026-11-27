import test from 'node:test'
import { mkdtemp, mkdir, copyFile, writeFile, symlink, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { forecastMeter, morningWeather, withForecastRetry, weatherPrompt } from '../lib/forecast-run.mjs'

test('compact prompt keeps relevant hours and alerts while the morning figures require complete measurements', () => {
  const day = date => ({ date, day: {}, hour: Array.from({ length: 24 }, (_, h) => ({
    time: date + ' ' + String(h).padStart(2, '0') + ':00', temp_f: 32, wind_mph: 10, snow_cm: 2.54,
    condition: { text: 'Freezing drizzle' }, temp_c: 0
  })) })
  const weather = { location: { name: 'Rockford', region: 'Michigan' }, alerts: { alert: [{ event: 'Ice' }] },
    forecast: { forecastday: ['2026-11-28','2026-11-29','2026-11-30'].map(day) } }
  const prompt = weatherPrompt(weather, '2026-11-30', 2)
  assert.ok(prompt.includes('2026-11-29 23:00') && prompt.includes('Ice'))
  assert.ok(!prompt.includes('2026-11-28') && !prompt.includes('temp_c'))
  const metrics = morningWeather(weather, '2026-11-30')
  assert.ok(Math.abs(metrics.snowInches - 12) < 1e-8)
  assert.equal(metrics.iceType, 'freezing_rain')
  assert.equal(metrics.minVisibilityMiles, null)
  assert.equal(metrics.overnightLowF, 32)
  weather.forecast.forecastday[1].hour.pop()
  assert.equal(morningWeather(weather, '2026-11-30').snowInches, null)
  assert.throws(() => weatherPrompt(weather, '2026-12-01', 2), /Exact target-date/)
})

test('the forecaster retries transient failures once and stops on cancellation or permanent errors', async () => {
  for (const [error, limit, aborted] of [[{ status: 401 }, 1, false], [{ status: 429, code: 'insufficient_quota' }, 1, false],
    [{ status: 503 }, 2, false], [{ status: 503 }, 1, true]]) {
    const controller = new AbortController()
    let calls = 0
    await assert.rejects(withForecastRetry(async () => {
      calls++
      if (aborted) controller.abort()
      throw Object.assign(new Error('failure'), error)
    }, controller.signal))
    assert.equal(calls, limit)
  }
})

const api = 'https://api.openai.com/v1/responses'
const agent = name => ({ name, model: 'gpt-5.2', modelSettings: { reasoning: { effort: 'high' } } })
function reply(overrides) {
  return Response.json({ model: 'gpt-5.2-2025-12-11', usage: { input_tokens: 1000,
    input_tokens_details: { cached_tokens: 400 }, output_tokens: 200, output_tokens_details: { reasoning_tokens: 100 } },
    output: [{ type: 'web_search_call' }, { type: 'code_interpreter_call', container_id: 'shared' }], ...overrides })
}

test('attributes raw responses to nested roles, including failed output, without double-charging reasoning or a container', async () => {
  const meter = forecastMeter(async () => reply({}))
  await meter.attempt(agent('coordinator'), async () => {
    await meter.fetch(api)
    await assert.rejects(meter.attempt(agent('weather'), async () => {
      await meter.fetch(api)
      throw new Error('SDK rejected output')
    }))
  })
  const report = meter.report()
  assert.equal(report.complete, true)
  assert.equal(report.modelRequests, 2)
  assert.deepEqual(report.attempts.map(a => [a.role, a.status, a.requests.length]), [['coordinator','completed',1], ['weather','failed',1]])
  assert.equal(report.estimatedUsd, 0.05784)
})

test('unpriced models, unavailable usage and transport failures keep the total explicitly partial', async () => {
  const meter = forecastMeter(async url => {
    if (url.includes('transport')) throw new Error('network failure')
    return url.includes('unknown') ? reply({ model: 'unpriced' }) : Response.json({ error: 'unavailable' }, { status: 502 })
  })
  await meter.attempt(agent('news'), async () => {
    await meter.fetch(api + '?unknown')
    await meter.fetch(api)
    await assert.rejects(meter.fetch(api + '?transport'))
  })
  const report = meter.report()
  assert.equal(report.modelRequests, 3)
  assert.equal(report.complete, false)
  assert.equal(report.estimatedUsd, null)
  assert.equal(report.pricedUsd, 0.04)
  assert.equal(report.attempts[0].requests[0].output, 200)
})

test('local, scheduled and frozen CLI runs use only the forecaster and isolate their outputs and spend', async t => {
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const temp = await mkdtemp(join(tmpdir(), 'blizzard-meter-test-'))
  t.after(() => rm(temp, { recursive: true, force: true }))
  await mkdir(join(temp, 'build-tools'))
  await copyFile(join(root, 'build-tools/generate-prediction.mjs'), join(temp, 'build-tools/generate-prediction.mjs'))
  for (const name of ['build-tools/lib','src','node_modules']) await symlink(join(root, name), join(temp, name))
  const generator = (environment, ...args) => execFileSync(process.execPath, [
    '--import', join(root, 'build-tools/tests/fixtures/forecast-provider.mjs'),
    join(temp, 'build-tools/generate-prediction.mjs'), ...args
  ], { cwd: temp, env: { OPENAI_API_KEY: 'fixture', WEATHER_API_KEY: 'fixture', ...environment }, timeout: 45000 })
  const data = join(temp, 'public/data')
  await mkdir(data, { recursive: true })
  const archive = await readFile(join(root, 'public/data/outcomes.json'), 'utf8')
  await writeFile(join(data, 'outcomes.json'), archive)
  generator({})
  const file = join(temp, 'public/data/local/prediction.json')
  const saved = await readFile(file, 'utf8')
  const snapshot = JSON.parse(saved)
  assert.equal(snapshot.architecture, 'single-forecaster-v1')
  assert.equal(snapshot.final.snow_day_probability, 50)
  assert.ok(!('meteorology' in snapshot) && !('collaboration' in snapshot))
  const frozen = join(temp, 'legacy.json')
  await writeFile(frozen, JSON.stringify({ ...snapshot, architecture: undefined, final: { decision_rationale: 'TEST OUTCOME LEAK' },
    safety: { report: 'TEST OUTCOME LEAK' }, actualSnowDay: 'TEST OUTCOME LEAK' }))
  generator({}, '--compare-reasoning', frozen)
  assert.equal(await readFile(file, 'utf8'), saved)
  assert.deepEqual((await readdir(data)).sort(), ['local','outcomes.json'])
  assert.equal(await readFile(join(data, 'outcomes.json'), 'utf8'), archive)
  const localRows = JSON.parse(await readFile(join(data, 'local/outcomes.json'), 'utf8'))
  const historical = JSON.parse(archive).filter(r => r.date !== snapshot.targetDate)
  assert.deepEqual(localRows.filter(r => r.date !== snapshot.targetDate), historical)
  assert.throws(() => generator({}, '--scheduled'), /main-branch forecast action/)
  generator({ GITHUB_ACTIONS: 'true', GITHUB_REF: 'refs/heads/main' }, '--scheduled')
  const scheduled = JSON.parse(await readFile(join(data, 'prediction.json')))
  assert.equal(scheduled.architecture, 'single-forecaster-v1')
  assert.equal(JSON.parse(await readFile(join(data, 'summary.json'))).architecture, scheduled.architecture)
  assert.equal(scheduled.final.snow_day_probability, 50)
  const dir = join(temp, 'logs/forecast-costs')
  const reports = await Promise.all((await readdir(dir)).map(async f => JSON.parse(await readFile(join(dir, f)))))
  assert.equal(reports.length, 4)
  const issued = reports.find(r => r.mode === 'scheduled')
  assert.equal(issued.modelRequests, 1)
  assert.deepEqual(issued.attempts.map(a => [a.role, a.effort]), [['Blizzard Forecaster', 'high']])
  assert.ok(reports.every(r => r.complete && r.status === 'completed' && r.estimatedUsd > 0))
  const normal = reports.find(r => r.mode === 'local')
  assert.equal(normal.attempts.length, 2)
  assert.equal(normal.modelRequests, 2)
  assert.ok(normal.attempts.every(a => a.effort === 'high'))
  assert.deepEqual(normal.attempts.filter(a => a.status === 'failed').map(a => a.role), ['Blizzard Forecaster'])
  const low = reports.find(r => r.mode === 'comparison-low')
  assert.equal(low.comparisonId, reports.find(r => r.mode === 'comparison-high').comparisonId)
  for (const effort of ['high', 'low']) {
    const trial = reports.find(r => r.mode === 'comparison-' + effort)
    assert.deepEqual(trial.attempts.map(a => [a.role, a.effort]), [['Blizzard Forecaster', effort]])
  }
})
