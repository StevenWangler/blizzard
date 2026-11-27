#!/usr/bin/env node
import { join, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readdir, readFile, lstat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { assetManifest, regularFileBelow } from './lib/release-assets.mjs'
import { readLedger } from './lib/data-integrity.mjs'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
export async function verifyDist(output, manifest, { requireMusic = false } = {}) {
  let musicFiles = 0
  if ((await lstat(output)).isSymbolicLink()) throw new Error('Symlinks are forbidden in release output')
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = join(dir, entry.name)
      if (entry.isSymbolicLink()) throw new Error('Symlinks are forbidden in release output')
      if (entry.name === 'local' || entry.name.startsWith('.env') || entry.name === '.local-assets' || entry.name.toLowerCase().endsWith('.map')) {
        throw new Error('Forbidden preview, secret-source or sourcemap file in release output')
      }
      if (entry.isDirectory()) { await walk(file); continue }
      const asset = relative(output, file).split('\\').join('/')
      if (!manifest.public.includes(asset) && asset !== 'index.html' && !/^assets\/[A-Za-z0-9_.-]+\.(?:js|css|mp3)$/.test(asset)) {
        throw new Error('Unexpected file in release output; review the asset allowlist')
      }
      if (entry.name.endsWith('.mp3')) {
        musicFiles++
        const media = await readFile(file)
        if (media.length !== manifest.music?.bytes || createHash('sha256').update(media).digest('hex') !== manifest.music?.sha256) throw new Error('Release music integrity mismatch')
      }
      if (/\.(js|html)$/.test(entry.name)) {
        const content = await readFile(file, 'utf8')
        if (/VITE_(?:WEATHER_API_KEY|OUTCOME_ADMIN_SECRET)|OPENAI_API_KEY|sk-proj-/.test(content)) throw new Error('Credential reference found in release output')
      }
    }
  }
  await walk(output)
  if (requireMusic && musicFiles !== 1) throw new Error('Release output must include exactly one licensed music file')
  for (const file of manifest.public) await regularFileBelow(output, file)
  // These JSON snapshots must still be parseable, without changing their historical contents.
  for (const file of ['prediction', 'summary']) JSON.parse(await readFile(join(output, 'data', `${file}.json`), 'utf8'))
  await readLedger(join(output, 'data', 'outcomes.json'))
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await verifyDist(join(root, 'dist'), await assetManifest(root), { requireMusic: process.argv.includes('--require-music') })
  console.log('Release output verified: required assets present; preview data and credential references absent')
}
