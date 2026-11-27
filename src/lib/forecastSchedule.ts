/** Scheduled attempt, not a promise that a new forecast will be published. */
export function getNextRefreshTime(now = new Date()): Date {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Detroit', hour: 'numeric', hourCycle: 'h23' })
  const candidate = new Date(now)
  candidate.setUTCMinutes(17, 0, 0)
  if (candidate <= now) candidate.setUTCHours(candidate.getUTCHours() + 1)
  for (let hour = 0; hour < 48; hour++, candidate.setUTCHours(candidate.getUTCHours() + 1)) {
    if ([9, 13, 18].includes(Number(formatter.format(candidate)))) return candidate
  }
  throw new Error('Scheduled forecast time unavailable')
}
