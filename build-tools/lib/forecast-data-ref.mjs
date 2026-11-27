// Data commits descend from the last pre-cutover main archive so replay can
// follow one first-parent history across both storage layouts.
import { spawnSync } from 'node:child_process'

export const dataRef = 'refs/remotes/origin/blizzard-data'
export function historyRef(repoRoot) {
  const result = spawnSync('git', ['show-ref', '--verify', '--quiet', dataRef], { cwd: repoRoot })
  if (result.status === 0) return dataRef
  if (result.status === 1) return 'refs/remotes/origin/main'
  throw new Error('Unable to resolve forecast history')
}
