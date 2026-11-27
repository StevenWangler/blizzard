import { describe, expect, it } from 'vitest'
import { readMusicEnabled, writeMusicEnabled } from './musicPreference'

const storage = () => {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
}

describe('music preference', () => {
  it('enables music for a fresh visit', () => {
    expect(readMusicEnabled(storage())).toBe(true)
  })
  it('remembers an explicit pause across visits and can be explicitly re-enabled', () => {
    const saved = storage()
    writeMusicEnabled(false, saved)
    expect(readMusicEnabled(saved)).toBe(false)
    writeMusicEnabled(true, saved)
    expect(readMusicEnabled(saved)).toBe(true)
  })
  it('handles unavailable or restricted storage without crashing', () => {
    expect(readMusicEnabled(null)).toBe(true)
    expect(readMusicEnabled({ getItem: () => { throw new Error('private storage') } })).toBe(true)
    expect(() => writeMusicEnabled(false, { setItem: () => { throw new Error('private storage') } })).not.toThrow()
  })
})
