// Resolving a URL does not fetch media; an enabled playback request creates it.
// A source checkout without the private licensed file builds
// normally and omits the control instead of linking to an unavailable asset.
const assets = import.meta.glob<string>('/.local-assets/music/fireside-romance.mp3', {
  eager: true,
  query: '?url',
  import: 'default',
})

export const forecastMusicUrl = Object.values(assets)[0] ?? null
