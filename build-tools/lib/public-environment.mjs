// No prefix-wide environment exposure. New public values need an explicit review here.
export function publicEnvironment(env, production = true) {
  const zip = env.VITE_ZIP_CODE || '49341'
  if (!/^\d{5}$/.test(zip)) throw new Error('Public ZIP code must contain five digits')
  const active = env.VITE_BLIZZARD_ACTIVE ?? (production ? 'false' : 'true')
  if (!['true', 'false'].includes(active)) throw new Error('Public season flag must be true or false')
  return {
    'import.meta.env.VITE_ZIP_CODE': JSON.stringify(zip),
    'import.meta.env.VITE_BLIZZARD_ACTIVE': JSON.stringify(active),
    'import.meta.env.VITE_BLIZZARD_ENV': JSON.stringify(production ? 'production' : 'development')
  }
}
