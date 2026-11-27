function adjustedProbability(issued, multiplier) {
  if (multiplier === 1) return issued
  return Math.round(100 * issued * multiplier / (100 - issued + issued * multiplier))
}

// Offline challenger. Inputs are an archived forecast, never outcomes or class submissions.
function routeWeather(snapshot) {
  const date = snapshot.targetDate
  const weather = snapshot.raw_weather_data
  if (weather?.location?.tz_id !== 'America/Detroit' || weather.location.name !== 'Rockford' ||
      weather.location.region !== 'Michigan') return null

  const previousDate = new Date(Date.parse(date + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10)
  const byTime = new Map()
  for (const day of weather.forecast?.forecastday ?? []) {
    for (const hour of day.hour ?? []) {
      if (byTime.has(hour.time)) return null
      byTime.set(hour.time, hour)
    }
  }

  let lastWetHour = -Infinity
  let lastIceHour = -Infinity
  let firstIceHour = null
  let frozenThroughHour = null
  let iceType = 'none'
  let snowCm = 0
  for (let hour = -3; hour <= 8; hour++) {
    const day = hour < 0 ? previousDate : date
    const clock = String((hour + 24) % 24).padStart(2, '0')
    const h = byTime.get(day + ' ' + clock + ':00')
    if (!h || !Number.isFinite(h.temp_f) || !Number.isFinite(h.precip_mm) || h.precip_mm < 0 ||
        !Number.isFinite(h.snow_cm) || h.snow_cm < 0 || !h.condition?.text) return null
    snowCm += h.snow_cm
    const freezingPrecip = /freezing (rain|drizzle)|ice pellets|sleet/i.test(h.condition.text)
    if (h.precip_mm > 0 && h.temp_f > 32 && /rain|drizzle/i.test(h.condition.text)) lastWetHour = hour
    if (h.precip_mm > 0 && freezingPrecip) {
      firstIceHour ??= hour
      lastIceHour = hour
      iceType = 'freezing precipitation'
    } else if (h.temp_f <= 32 && hour - lastWetHour <= 4) {
      firstIceHour ??= hour
      lastIceHour = hour
      iceType = 'refreeze'
    }
    if (lastIceHour === hour) frozenThroughHour = h.temp_f <= 32 ? hour : null
    else if (frozenThroughHour !== null && frozenThroughHour === hour - 1 && h.temp_f <= 32) frozenThroughHour = hour
  }
  return { firstIceHour, lastIceHour: Number.isFinite(lastIceHour) ? lastIceHour : null, frozenThroughHour, iceType, snowCm }
}

// Retain the original retrospective benchmark for comparisons across rule changes.
export function replayRoutes(snapshot) {
  const weather = routeWeather(snapshot)
  if (!weather) return null
  const { lastIceHour, iceType, snowCm } = weather
  const roads = snapshot.infrastructure?.road_clearing_status
  const limitedTreatment = [roads?.county_roads, roads?.local_streets].some(road =>
    ['partially_covered', 'snow_covered', 'ice_covered', 'impassable'].includes(road?.status) &&
    ['light', 'none'].includes(road?.plow_activity_level))
  // Coarse hourly bins. Test a two-hour treatment window before the 05:30 decision
  // and continued exposure through the bus run. A second boost needs route evidence.
  const shortWindow = lastIceHour !== null && 5.5 - lastIceHour <= 2
  const multiplier = shortWindow ? (limitedTreatment ? 2 : 1.5) : 1
  const issued = snapshot.final.snow_day_probability
  const candidate = adjustedProbability(issued, multiplier)
  const iceOnly = adjustedProbability(issued, shortWindow ? 1.5 : 1)
  const inches = snowCm / 2.54
  const snowOnly = inches >= 6 ? 75 : inches >= 3 ? 50 : inches >= 1 ? 20 : 5
  return { issued, iceOnly, candidate, snowOnly, iceType, lastIceHour: Number.isFinite(lastIceHour) ? lastIceHour : null,
    limitedTreatment, multiplier }
}

// This version is frozen at submission. Any future change to the weights or
// eligibility rules needs a new study version to keep prospective cohorts distinct.
export function roadStudyAtLock(snapshot, date, lockedAt, observation) {
  const weather = snapshot && routeWeather(snapshot)
  const study = { version: 1, observation, iceWindow: null, iceOnly: null, iceAndRoutes: null }
  if (!weather) return study
  const { firstIceHour, lastIceHour, frozenThroughHour, iceType } = weather
  study.iceWindow = { firstIceHour, lastIceHour, frozenThroughHour, iceType }

  // A six-hour taper replaces the old 04:00 cutoff. If air warms before
  // the decision, earlier ice gets no persistence credit. 05:00 is the last
  // whole-hour reading before 05:30; 06:00–08:00 covers the bus run.
  let persistence = 0
  if (lastIceHour !== null && (lastIceHour >= 5.5 || frozenThroughHour >= 5)) {
    persistence = Math.min(1, Math.max(0, 1 - (5.5 - lastIceHour) / 6))
  }
  const previousDay = new Date(Date.parse(date + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10)
  const localDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Detroit' })
  const observationAge = observation ? Date.parse(lockedAt) - Date.parse(observation.observedAt) : Infinity
  const freshLocalIce = observation && observation.roadClass !== 'highway' &&
    ['icy', 'snow-covered'].includes(observation.condition) &&
    observationAge >= 0 && observationAge <= 6 * 3600000 &&
    localDay.format(new Date(observation.observedAt)) === previousDay
  const issued = snapshot.final.snow_day_probability
  study.iceOnly = adjustedProbability(issued, 1 + 0.5 * persistence)
  study.iceAndRoutes = adjustedProbability(issued, 1 + (freshLocalIce ? 1 : 0.5) * persistence)
  return study
}

export function scores(rows, field, opponent = 'rhs') {
  if (!rows.length) return null
  let squared = 0, absolute = 0, wins = 0, ties = 0, losses = 0
  for (const row of rows) {
    const actual = row.closed ? 100 : 0
    const error = Math.abs(actual - row[field])
    absolute += error
    squared += (error / 100) ** 2
    if (row[opponent] == null) continue
    const otherError = Math.abs(actual - row[opponent])
    if (error < otherError) wins++
    else if (error > otherError) losses++
    else ties++
  }
  return { n: rows.length, brier: squared / rows.length, meanError: absolute / rows.length, wins, losses, ties }
}
