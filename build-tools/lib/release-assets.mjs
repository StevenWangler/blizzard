import { readFile, lstat, realpath, mkdir, copyFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'
import { readLedger } from './data-integrity.mjs'

const musicSource = '.local-assets/music/fireside-romance.mp3'
function safeRelative(file) {
  if (typeof file !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(file) || file.split('/').some(part => !part || part === '.' || part === '..' || part.startsWith('.'))) {
    throw new Error('Unsafe release asset path')
  }
  if (file.startsWith('data/') && !['data/prediction.json', 'data/summary.json', 'data/outcomes.json'].includes(file)) {
    throw new Error('Preview or unreviewed data cannot be a release asset')
  }
  return file
}

// Follow no link below the trusted root, including links in ancestor directories.
export async function regularFileBelow(root, relative) {
  const base = await realpath(root)
  const parts = relative.split('/')
  let current = base
  for (let i = 0; i < parts.length; i++) {
    if (!parts[i] || parts[i] === '.' || parts[i] === '..') throw new Error('Unsafe asset path')
    current = join(current, parts[i])
    const stat = await lstat(current)
    if (stat.isSymbolicLink()) throw new Error('Symlinks are forbidden in release assets')
    if (i === parts.length - 1 ? !stat.isFile() : !stat.isDirectory()) throw new Error('Expected a regular release asset')
  }
  if (await realpath(current) !== resolve(base, ...parts)) throw new Error('Release asset escaped its root')
  return current
}

export async function assetManifest(root) {
  const file = await regularFileBelow(root, 'config/release-assets.json')
  const manifest = JSON.parse(await readFile(file, 'utf8'))
  if (!Array.isArray(manifest.public) || manifest.public.length === 0 || manifest.public.length > 100 || new Set(manifest.public).size !== manifest.public.length) {
    throw new Error('Release assets must be a bounded unique list')
  }
  manifest.public.forEach(safeRelative)
  const music = manifest.music
  if (!music || music.source !== musicSource || !Number.isSafeInteger(music.bytes) || music.bytes < 1 || music.bytes > 20 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(music.sha256)) {
    throw new Error('Invalid licensed-music manifest')
  }
  return manifest
}

export async function verifyReleaseInputs(root, requireMusic = false) {
  const manifest = await assetManifest(root)
  for (const file of manifest.public) {
    const source = await regularFileBelow(root, `public/${file}`)
    if (file === 'data/outcomes.json') await readLedger(source)
  }
  if (requireMusic) {
    let data
    try { data = await readFile(await regularFileBelow(root, musicSource)) } catch {
      throw new Error('Licensed release music is missing or unsafe. Supply the approved private build input before deployment; never add its source to the public repository.')
    }
    if (data.length !== manifest.music.bytes || createHash('sha256').update(data).digest('hex') !== manifest.music.sha256) {
      throw new Error('Licensed music does not match the approved release input')
    }
  }
  return manifest
}

export async function copyPublicReleaseAssets(root, output) {
  const manifest = await verifyReleaseInputs(root)
  await mkdir(output, { recursive: true })
  if ((await lstat(output)).isSymbolicLink()) throw new Error('Release output cannot be a symlink')
  const base = await realpath(output)
  for (const file of manifest.public) {
    const parts = file.split('/')
    let directory = base
    for (const part of parts.slice(0, -1)) {
      directory = join(directory, part)
      await mkdir(directory, { recursive: true })
      if ((await lstat(directory)).isSymbolicLink()) throw new Error('Release output directory cannot be a symlink')
    }
    const target = join(base, file)
    try { if ((await lstat(target)).isSymbolicLink()) throw new Error('Release output file cannot be a symlink') }
    catch (error) { if (error.code !== 'ENOENT') throw error }
    await copyFile(await regularFileBelow(root, `public/${file}`), target)
  }
}
