// Bound work before schema validation; array validators may otherwise accumulate
// one issue per attacker-controlled element. This complements, not replaces, SDK limits.
export function boundedJson(value) {
  const pending = [{ value, depth: 0 }]
  const seen = new WeakSet()
  let nodes = 0
  while (pending.length) {
    const item = pending.pop()
    if (++nodes > 5000 || item.depth > 16) throw new Error('Forecast input exceeds structural limits')
    if (typeof item.value === 'string' && item.value.length > 32768) throw new Error('Forecast text exceeds size limit')
    if (!item.value || typeof item.value !== 'object') continue
    if (seen.has(item.value)) throw new Error('Forecast input must be a JSON tree')
    seen.add(item.value)
    if (Array.isArray(item.value) && item.value.length > 256) throw new Error('Forecast array exceeds size limit')
    const keys = Object.keys(item.value)
    if (keys.length > 256) throw new Error('Forecast object exceeds size limit')
    for (const key of keys) pending.push({ value: item.value[key], depth: item.depth + 1 })
  }
  return value
}
