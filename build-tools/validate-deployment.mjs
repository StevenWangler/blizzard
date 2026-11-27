#!/usr/bin/env node
import { fileURLToPath } from 'node:url'
import { verifyReleaseInputs } from './lib/release-assets.mjs'
try {
  const root = fileURLToPath(new URL('..', import.meta.url))
  await verifyReleaseInputs(root, true)
  console.log('Local release inputs verified, including licensed music. No credentials or remote settings were read.')
  console.log('This is not deployment approval. Review docs/DEPLOYMENT_GUIDE.md for the remaining remote gates.')
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
