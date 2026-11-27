import { useCallback, useEffect, useState } from 'react'
import { fetchData } from '@/lib/dataPath'
import type { AgentPrediction } from '@/types/agentPrediction'

export function useSavedForecast(enabled: boolean) {
  const [prediction, setPrediction] = useState<AgentPrediction | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [, refreshFreshness] = useState(0)
  const reload = useCallback(() => setAttempt(value => value + 1), [])
  useEffect(() => {
    if (!enabled) return
    // Re-evaluate the saved report's age; this does not fetch or promise new data.
    const refresh = () => refreshFreshness(value => value + 1)
    const resume = () => { if (!document.hidden) refresh() }
    const timer = window.setInterval(refresh, 60_000)
    document.addEventListener('visibilitychange', resume)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', resume) }
  }, [enabled])
  useEffect(() => {
    if (!enabled) return
    let active = true
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    void fetchData<AgentPrediction>('prediction.json', { signal: controller.signal }).then(data => {
      if (active) setPrediction(data)
    }).catch(() => {
      if (active) { setPrediction(null); setError('The forecast couldn’t load.') }
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false; controller.abort() }
  }, [enabled, attempt])
  return { prediction, loading, error, reload }
}
export type SavedForecast = ReturnType<typeof useSavedForecast>
