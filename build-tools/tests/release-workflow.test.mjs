import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { nwsRockfordWeather } from '../lib/nws-weather.mjs'
import { nextSchoolTarget } from '../lib/forecast-integrity.mjs'

const target = '2026-11-30'
const updated = '2026-11-26T16:00:00Z'
const now = Date.parse(updated)
function transport(hours = 24, updateTime = updated) {
  return async url => {
    if (url.includes('/alerts/')) return Response.json({ features: [] })
    const periods = Array.from({ length: hours }, (_, h) => ({
      startTime: target + 'T' + String(h).padStart(2, '0') + ':00:00-05:00',
      temperatureUnit: 'F', temperature: 30, shortForecast: 'Cloudy', windSpeed: '5 to 10 mph'
    }))
    return Response.json({ properties: { updateTime, periods } })
  }
}

test('Rockford NWS uses local target hours and preserves missing wind speed and accumulation', async () => {
  const data = await nwsRockfordWeather(target, transport(), now)
  const [day] = data.forecast.forecastday
  assert.equal(day.date, target)
  assert.equal(day.hour.length, 24)
  assert.equal(day.hour[6].time, target + ' 06:00')
  assert.equal(day.hour[6].temp_f, 30)
  assert.equal(day.hour[6].wind_mph, undefined)
  assert.equal(day.day.totalsnow_cm, undefined)
  await assert.rejects(nwsRockfordWeather(target, transport(23), now), /coverage/)
  await assert.rejects(nwsRockfordWeather(target, transport(), now + 25 * 3600000), /stale/)
})

test('district Thanksgiving and winter breaks advance the next eligible target', () => {
  const date = start => nextSchoolTarget(new Date(start)).targetDate.toISOString().slice(0, 10)
  assert.equal(date('2026-11-26T19:00:00Z'), target)
  assert.equal(date('2026-12-18T18:00:00Z'), '2027-01-04')
})

test('Actions restores and fast-forwards only forecast data and refuses stale writes', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'blizzard-data-remote-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const repo = join(dir, 'work')
  await mkdir(repo)
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }).trim()
  const remote = join(dir, 'remote.git')
  git('init', '--bare', remote)
  git('init', '-b', 'main')
  git('config', 'user.name', 'Blizzard test')
  git('config', 'user.email', 'test@example.invalid')
  git('config', 'commit.gpgSign', 'false')
  git('remote', 'add', 'origin', remote)
  const data = join(repo, 'public/data')
  await mkdir(data, { recursive: true })
  for (const name of ['outcomes','summary','prediction']) {
    await writeFile(join(data, name + '.json'), name === 'outcomes' ? '[]' : '{}')
  }
  git('add', 'public')
  git('commit', '-m', 'Data baseline')
  const base = git('rev-parse', 'HEAD')
  git('push', 'origin', 'HEAD:refs/heads/blizzard-data')
  await writeFile(join(repo, 'source.txt'), 'reviewed main')
  git('add', 'source.txt')
  git('commit', '-m', 'Reviewed application')
  const main = git('rev-parse', 'HEAD')
  git('push', 'origin', 'main')

  const out = join(dir, 'outputs')
  const env = { ...process.env, GITHUB_ACTIONS: 'true', GITHUB_REF: 'refs/heads/main', GITHUB_OUTPUT: out,
    BLIZZARD_AUTOMATION_WRITES_APPROVED: 'true', RUNNER_TEMP: dir, DATA_BASE: base }
  const script = fileURLToPath(new URL('../commit-data.mjs', import.meta.url))
  const run = (...args) => execFileSync(process.execPath, [script, ...args], { cwd: repo, env, stdio: ['ignore','pipe','pipe'] })
  await writeFile(join(data, 'summary.json'), 'invalid')
  run('restore')
  assert.equal(await readFile(join(data, 'summary.json'), 'utf8'), '{}')
  run()
  assert.match(await readFile(out, 'utf8'), /updated=false/)
  await writeFile(join(data, 'summary.json'), '{"probability":2}')
  run()
  const tip = git('ls-remote', 'origin', 'refs/heads/blizzard-data').split(/\s+/)[0]
  assert.equal(git('rev-parse', tip + '^'), base)
  assert.equal(git('ls-tree', '-r', '--name-only', tip), 'public/data/outcomes.json\npublic/data/prediction.json\npublic/data/summary.json')
  assert.equal(git('ls-remote', 'origin', 'main').split(/\s+/)[0], main)
  assert.throws(() => run(), /Data advanced/)
})
