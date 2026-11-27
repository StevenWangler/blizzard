export type MusicState = 'off' | 'loading' | 'playing' | 'blocked' | 'error'
export const MUSIC_CREDIT = "Music: 'Fireside Romance' by Albert Behar on #Uppbeat"
export const MUSIC_ARTIST_URL = 'https://uppbeat.io/c/albert-behar'

export interface MusicAudio extends EventTarget {
  readonly paused: boolean
  muted: boolean
  play(): Promise<void>
  pause(): void
  load(): void
  removeAttribute(name: string): void
  remove(): void
}

/** Visibility return is intentionally a no-op: only another tap may resume. */
export function attachMusicLifecycle(player: { pause(): void }, page: EventTarget & { readonly hidden: boolean }, browser: EventTarget) {
  const hide = () => { if (page.hidden) player.pause() }
  const leave = () => player.pause()
  page.addEventListener('visibilitychange', hide)
  browser.addEventListener('pagehide', leave)
  return () => {
    page.removeEventListener('visibilitychange', hide)
    browser.removeEventListener('pagehide', leave)
  }
}

/** One player and one current intent. Browser policy decides whether autoplay may succeed. */
export class ForecastMusic {
  private audio: MusicAudio | null = null
  private wantsPlay = false
  private revision = 0
  private disposed = false
  private automaticRequest = false
  private currentState: MusicState = 'off'

  constructor(private createAudio: () => MusicAudio, private onState: (state: MusicState) => void, private onExternalPause: () => void = () => {}) {}

  get state() { return this.currentState }
  get requested() { return this.wantsPlay }

  autoplay() { this.play(true) }

  toggle() {
    if (this.wantsPlay) this.pause()
    else this.play()
  }

  play(automatic = false) {
    if (this.disposed || this.wantsPlay) return
    const retry = this.currentState === 'error'
    const revision = ++this.revision
    this.wantsPlay = true
    this.automaticRequest = automatic
    this.publish('loading')
    try {
      if (!this.audio) {
        this.audio = this.createAudio()
        for (const [event, listener] of this.listeners) this.audio.addEventListener(event, listener)
      }
      const audio = this.audio
      if (retry) audio.load()
      if (!automatic) audio.muted = false
      // Manual requests stay in the tap's call stack; automatic ones may be denied.
      const pending = audio.play()
      void pending.then(() => {
        if (this.disposed || revision !== this.revision) {
          if (!this.wantsPlay || this.disposed) audio.pause()
          return
        }
        if (audio.paused) this.pause()
        else { this.automaticRequest = false; this.publish('playing') }
      }).catch(error => {
        if (!this.disposed && revision === this.revision) this.fail(error, automatic)
      })
    } catch (error) {
      if (!this.disposed && revision === this.revision) this.fail(error, automatic)
    }
  }

  pause() {
    if (this.disposed) return
    this.wantsPlay = false
    this.automaticRequest = false
    ++this.revision
    this.audio?.pause()
    this.publish('off')
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.wantsPlay = false
    ++this.revision
    if (this.audio) {
      for (const [event, listener] of this.listeners) this.audio.removeEventListener(event, listener)
      this.audio.pause()
      this.audio.removeAttribute('src')
      this.audio.load()
      this.audio.remove()
      this.audio = null
    }
    this.currentState = 'off'
  }

  private publish(state: MusicState) {
    if (this.disposed || this.currentState === state) return
    this.currentState = state
    this.onState(state)
  }

  private fail(error?: unknown, automatic = false) {
    this.wantsPlay = false
    ++this.revision
    this.audio?.pause()
    this.automaticRequest = false
    const policyDenied = typeof error === 'object' && error !== null && 'name' in error && error.name === 'NotAllowedError'
    this.publish(automatic && policyDenied ? 'blocked' : 'error')
  }

  private listeners: Array<[string, EventListener]> = [
    ['playing', () => {
      if (this.disposed || !this.wantsPlay) this.audio?.pause()
      else { this.automaticRequest = false; this.publish('playing') }
    }],
    ['waiting', () => { if (this.wantsPlay && !this.disposed) this.publish('loading') }],
    ['stalled', () => { if (this.wantsPlay && !this.disposed) this.publish('loading') }],
    ['pause', () => {
      if (this.wantsPlay && this.audio?.paused && !(this.automaticRequest && this.currentState === 'loading')) {
        this.onExternalPause()
        this.pause()
      }
    }],
    ['volumechange', () => {
      if (this.audio?.muted && !this.disposed) { this.onExternalPause(); this.pause() }
    }],
    ['ended', () => this.pause()],
    ['error', () => { if (this.wantsPlay && !this.disposed) this.fail() }],
  ]
}
