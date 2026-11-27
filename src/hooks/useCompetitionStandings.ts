import { useEffect, useMemo, useState } from 'react'
import { fetchOutcomeLedger, type SnowDayOutcome } from '@/services/outcomes'
import { competitionStandings } from '@/lib/competitionStandings'

export function useCompetitionStandings(enabled: boolean) {
  const [outcomes, setOutcomes] = useState<SnowDayOutcome[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!enabled) return
    let active = true
    setStatus('loading')
    fetchOutcomeLedger({ bustCache: true }).then(rows => {
      if (active) { setOutcomes(rows); setStatus('ready') }
    }).catch(() => { if (active) setStatus('error') })
    return () => { active = false }
  }, [enabled, attempt])
  const standings = useMemo(() => competitionStandings(outcomes), [outcomes])
  return { ...standings, outcomes, status, retry: () => setAttempt(value => value + 1) }
}
export type CompetitionStandings = ReturnType<typeof useCompetitionStandings>
