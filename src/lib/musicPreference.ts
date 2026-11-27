const key = 'blizzard.forecastMusic.enabled'

function browserStorage(): Storage | null {
  try { return typeof window === 'undefined' ? null : window.localStorage } catch { return null }
}

export function readMusicEnabled(storage: Pick<Storage, 'getItem'> | null = browserStorage()): boolean {
  try { return storage?.getItem(key) !== 'off' } catch { return true }
}

export function writeMusicEnabled(enabled: boolean, storage: Pick<Storage, 'setItem'> | null = browserStorage()): void {
  try { storage?.setItem(key, enabled ? 'on' : 'off') } catch { /* Current-page preference still works without storage. */ }
}
