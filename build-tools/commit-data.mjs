#!/usr/bin/env node
// Only blobs under public/data cross the boundary into the reviewed code checkout.
import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { readLedger } from './lib/data-integrity.mjs'
import { maximumJsonBytes } from './lib/bounded-response.mjs'
import { dataRef } from './lib/forecast-data-ref.mjs'

const files = ['public/data/outcomes.json', 'public/data/prediction.json', 'public/data/summary.json']
const git = args => execFileSync('git', args, { encoding: 'utf8', maxBuffer: maximumJsonBytes, stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const mode = process.argv[2]
if (process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_REF !== 'refs/heads/main') {
  throw new Error('Use this command in a main-branch Actions job')
}
git(['fetch', '--no-tags', 'origin', 'refs/heads/blizzard-data:' + dataRef])
const base = git(['rev-parse', dataRef])
const output = (key, value) => appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`)
const assertDataTree = sha => {
  const names = git(['ls-tree', '-r', '--name-only', sha]).split('\n').sort()
  if (JSON.stringify(names) !== JSON.stringify(files)) throw new Error('Unexpected file in forecast data branch')
}
assertDataTree(base)
if (mode === 'restore') {
  for (const file of files) {
    if (!git(['ls-tree', base, '--', file]).startsWith('100644 blob ')) throw new Error('Invalid forecast blob')
    const content = execFileSync('git', ['show', base + ':' + file], { maxBuffer: maximumJsonBytes })
    JSON.parse(content)
    writeFileSync(file, content)
  }
  await readLedger(files[0])
  output('sha', base)
} else if (!mode && process.env.BLIZZARD_AUTOMATION_WRITES_APPROVED === 'true') {
  if (process.env.DATA_BASE !== base) throw new Error('Data advanced during generation. Retry with fresh inputs.')
  if (git(['rev-parse','HEAD']) !== git(['ls-remote','origin','refs/heads/main']).split(/\s+/)[0]) {
    throw new Error('Code advanced during generation. Retry with current main.')
  }
  await readLedger(files[0])
  // A separate index builds a commit with only these three regular files. The checked-out code never changes.
  process.env.GIT_INDEX_FILE = process.env.RUNNER_TEMP + '/blizzard-data-index'
  git(['read-tree', base])
  for (const file of files) {
    const data = readFileSync(file)
    if (data.length > maximumJsonBytes) throw new Error('Oversized forecast file')
    JSON.parse(data)
    git(['update-index','--cacheinfo','100644',git(['hash-object','-w','--',file]),file])
  }
  const tree = git(['write-tree'])
  const changed = tree !== git(['rev-parse',base + '^{tree}'])
  if (changed) {
    const sha = git(['-c','user.name=github-actions[bot]','-c','user.email=41898282+github-actions[bot]@users.noreply.github.com',
      'commit-tree',tree,'-p',base,'-m','Update validated Blizzard forecast data'])
    git(['push','origin',sha + ':refs/heads/blizzard-data'])
  }
  output('updated',changed)
} else {
  throw new Error('Unapproved data write or unknown operation')
}
