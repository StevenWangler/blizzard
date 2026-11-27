import { describe, expect, it } from 'vitest'
import { attachMusicLifecycle, ForecastMusic, type MusicAudio, type MusicState } from './forecastMusic'

function deferred() {
  let resolve!: () => void
  let reject!: (reason: Error) => void
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

class TestAudio extends EventTarget implements MusicAudio {
  paused = true
  muted = false
  plays: ReturnType<typeof deferred>[] = []
  pauses = 0
  loads = 0
  removed = false
  sourceRemoved = false
  play() { this.paused = false; const next = deferred(); this.plays.push(next); return next.promise }
  pause() { this.paused = true; this.pauses++; this.dispatchEvent(new Event('pause')) }
  load() { this.loads++ }
  removeAttribute(name: string) { if (name === 'src') this.sourceRemoved = true }
  remove() { this.removed = true }
}

function setup() {
  const audio = new TestAudio()
  const states: MusicState[] = []
  let created = 0
  const player = new ForecastMusic(() => { created++; return audio }, state => states.push(state))
  return { audio, states, player, created: () => created }
}
const settle = async () => { await Promise.resolve(); await Promise.resolve() }

describe('opt-in forecast music transport', () => {
  it('starts off and creates no media until an explicit play', () => {
    const { player, created } = setup()
    expect(player.state).toBe('off')
    expect(created()).toBe(0)
    player.play()
    expect(created()).toBe(1)
    expect(player.state).toBe('loading')
  })

  it('attempts autoplay but does not report playing before successful playback', async () => {
    const { player, audio } = setup()
    player.autoplay()
    expect(player.state).toBe('loading')
    audio.plays[0].resolve(); await settle()
    expect(player.state).toBe('playing')
  })

  it('offers tap-to-start when policy rejects autoplay, reusing one player', async () => {
    const { player, audio, created } = setup()
    player.autoplay()
    const denied = new Error('gesture required'); denied.name = 'NotAllowedError'
    audio.plays[0].reject(denied); await settle()
    expect(player.state).toBe('blocked')
    expect(player.requested).toBe(false)
    expect(audio.paused).toBe(true)
    player.toggle()
    audio.plays[1].resolve(); await settle()
    expect(player.state).toBe('playing')
    expect(created()).toBe(1)
  })

  it('does not turn a cancelled autoplay rejection into a new start prompt', async () => {
    const { player, audio } = setup()
    player.autoplay(); player.pause()
    const denied = new Error('policy'); denied.name = 'NotAllowedError'
    audio.plays[0].reject(denied); await settle()
    expect(player.state).toBe('off')
  })

  it('distinguishes native pause/mute from automatic lifecycle pauses', async () => {
    const audio = new TestAudio()
    let externalPauses = 0
    const player = new ForecastMusic(() => audio, () => {}, () => externalPauses++)
    player.play(); audio.plays[0].resolve(); await settle()
    player.pause()
    expect(externalPauses).toBe(0)
    player.play(); audio.plays[1].resolve(); await settle()
    audio.pause()
    expect(externalPauses).toBe(1)
    player.play(); audio.plays[2].resolve(); await settle()
    audio.muted = true; audio.dispatchEvent(new Event('volumechange'))
    expect(player.state).toBe('off')
    expect(externalPauses).toBe(2)
    player.play()
    expect(audio.muted).toBe(false)
  })

  it('plays once and pauses immediately without creating another player', async () => {
    const { player, audio, created } = setup()
    player.play(); player.play()
    expect(audio.plays).toHaveLength(1)
    audio.plays[0].resolve(); await settle()
    expect(player.state).toBe('playing')
    player.toggle()
    expect(audio.paused).toBe(true)
    expect(player.state).toBe('off')
    expect(created()).toBe(1)
  })

  it('cancels loading and blocks a late playing event or resolved promise', async () => {
    const { player, audio } = setup()
    player.toggle(); player.toggle()
    audio.paused = false
    audio.dispatchEvent(new Event('playing'))
    audio.plays[0].resolve(); await settle()
    expect(audio.paused).toBe(true)
    expect(player.state).toBe('off')
  })

  it('keeps the latest intent through rapid play/pause/play', async () => {
    const { player, audio, created } = setup()
    player.play(); player.pause(); player.play()
    const pauses = audio.pauses
    audio.plays[0].resolve(); await settle()
    expect(audio.pauses).toBe(pauses)
    audio.plays[1].resolve(); await settle()
    expect(player.state).toBe('playing')
    expect(created()).toBe(1)
  })

  it('ignores an obsolete rejected play without stopping the new attempt', async () => {
    const { player, audio } = setup()
    player.play(); player.pause(); player.play()
    audio.plays[0].reject(new Error('old request aborted')); await settle()
    expect(player.state).toBe('loading')
    audio.plays[1].resolve(); await settle()
    expect(player.state).toBe('playing')
  })

  it('reports rejected playback and can retry using the same media element', async () => {
    const { player, audio, created } = setup()
    player.play()
    audio.plays[0].reject(new Error('not allowed')); await settle()
    expect(player.state).toBe('error')
    expect(audio.paused).toBe(true)
    player.toggle()
    expect(audio.loads).toBe(1)
    audio.plays[1].resolve(); await settle()
    expect(player.state).toBe('playing')
    expect(created()).toBe(1)
  })

  it('reflects external pause and never resumes without another tap', async () => {
    const { player, audio } = setup()
    player.play(); audio.plays[0].resolve(); await settle()
    audio.pause()
    expect(player.state).toBe('off')
    expect(audio.plays).toHaveLength(1)
  })

  it('handles buffering and a media error without duplicate playback', async () => {
    const { player, audio } = setup()
    player.play(); audio.plays[0].resolve(); await settle()
    audio.dispatchEvent(new Event('waiting'))
    expect(player.state).toBe('loading')
    audio.dispatchEvent(new Event('playing'))
    expect(player.state).toBe('playing')
    audio.dispatchEvent(new Event('error'))
    expect(player.state).toBe('error')
    expect(audio.paused).toBe(true)
  })

  it('disposes pending audio and ignores events after unmount', async () => {
    const { player, audio, states, created } = setup()
    player.play(); player.dispose()
    const before = [...states]
    audio.plays[0].resolve(); await settle()
    audio.dispatchEvent(new Event('playing'))
    player.play()
    expect(states).toEqual(before)
    expect(audio.sourceRemoved).toBe(true)
    expect(audio.removed).toBe(true)
    expect(audio.paused).toBe(true)
    expect(created()).toBe(1)
  })

  it('pauses on page hiding and does not resume on visibility return', () => {
    const { player, audio } = setup()
    const page = Object.assign(new EventTarget(), { hidden: false })
    const browser = new EventTarget()
    const detach = attachMusicLifecycle(player, page, browser)
    player.play()
    page.hidden = true
    page.dispatchEvent(new Event('visibilitychange'))
    expect(player.state).toBe('off')
    expect(audio.paused).toBe(true)
    page.hidden = false
    page.dispatchEvent(new Event('visibilitychange'))
    expect(audio.plays).toHaveLength(1)
    expect(player.state).toBe('off')
    detach()
  })

  it('pauses on pagehide and removes its lifecycle listeners during cleanup', () => {
    const { player, audio } = setup()
    const page = Object.assign(new EventTarget(), { hidden: false })
    const browser = new EventTarget()
    const detach = attachMusicLifecycle(player, page, browser)
    player.play()
    browser.dispatchEvent(new Event('pagehide'))
    expect(audio.paused).toBe(true)
    detach()
    player.play()
    browser.dispatchEvent(new Event('pagehide'))
    expect(player.state).toBe('loading')
    expect(audio.paused).toBe(false)
    player.dispose()
  })
})
