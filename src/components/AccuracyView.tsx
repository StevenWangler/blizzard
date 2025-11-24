import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { Target, Clock, Database, Warning, ArrowsClockwise, Calendar } from '@phosphor-icons/react'
import { buildOutcomeStats, fetchOutcomeLedger, SnowDayOutcome } from '@/services/outcomes'
import { useAdminAccess } from '@/hooks/useAdminAccess'

interface PredictionMeta {
  date: string
  modelPrediction: number
  confidence?: string | null
}

const todayISO = () => new Date().toISOString().split('T')[0]

const normalizeProbability = (value: unknown) => {
  const num = Number(value)
  if (Number.isNaN(num)) return 0
  return Math.max(0, Math.min(100, Math.round(num)))
}

export function AccuracyView() {
  const [outcomes, setOutcomes] = useState<SnowDayOutcome[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [predictionMeta, setPredictionMeta] = useState<PredictionMeta | null>(null)
  const { isAdmin } = useAdminAccess()

  useEffect(() => {
    const loadLedger = async () => {
      setLoading(true)
      setError(null)
      try {
        const ledger = await fetchOutcomeLedger({ bustCache: true })
        setOutcomes(ledger)
      } catch (err) {
        console.warn('Could not load outcome ledger:', err)
        setOutcomes([])
      } finally {
        setLoading(false)
      }
    }

    loadLedger()
  }, [])

  useEffect(() => {
    const fetchSummary = async () => {
      const hydrateFromSummary = async () => {
        const response = await fetch('/data/summary.json', { cache: 'no-store' })
        if (!response.ok) return false
        const summary = await response.json()
        const date = summary.timestamp ? summary.timestamp.split('T')[0] : todayISO()
        setPredictionMeta({
          date,
          modelPrediction: normalizeProbability(summary.probability ?? summary.final?.snow_day_probability ?? 0),
          confidence: summary.confidence ?? summary.final?.confidence_level ?? null
        })
        return true
      }

      const hydrateFromPrediction = async () => {
        const response = await fetch('/data/prediction.json', { cache: 'no-store' })
        if (!response.ok) return
        const prediction = await response.json()
        const date = prediction.timestamp ? prediction.timestamp.split('T')[0] : todayISO()
        setPredictionMeta({
          date,
          modelPrediction: normalizeProbability(prediction.final?.snow_day_probability ?? 0),
          confidence: prediction.final?.confidence_level ?? null
        })
      }

      try {
        const success = await hydrateFromSummary()
        if (!success) {
          await hydrateFromPrediction()
        }
      } catch (err) {
        await hydrateFromPrediction()
      }
    }

    fetchSummary()
  }, [])

  const pendingRecords = useMemo(() => {
    if (!predictionMeta) return []
    const alreadyLogged = outcomes.some(entry => entry.date === predictionMeta.date)
    if (alreadyLogged) return []
    return [predictionMeta]
  }, [predictionMeta, outcomes])

  const stats = useMemo(() => {
    const baseStats = buildOutcomeStats(outcomes)
    const demoDataCount = outcomes.filter(entry => entry.source === 'seed').length
    const realDataCount = baseStats.totalRecords - demoDataCount
    return {
      modelBrier: baseStats.avgBrierScore ?? 0,
      modelAccuracy: baseStats.directionalAccuracy,
      totalPredictions: baseStats.totalRecords + pendingRecords.length,
      completedPredictions: baseStats.totalRecords,
      pendingPredictions: pendingRecords.length,
      snowDays: baseStats.snowDays,
      realDataCount,
      demoDataCount
    }
  }, [outcomes, pendingRecords])

  const calibrationData = useMemo(() => {
    if (!outcomes || outcomes.length === 0) return []
    const completed = outcomes.filter(entry => 
      typeof entry.modelProbability === 'number' && 
      entry.actualSnowDay !== null && 
      entry.actualSnowDay !== undefined
    )
    if (completed.length === 0) return []

    const buckets = Array(10).fill(0).map(() => ({ predictions: 0, outcomes: 0 }))

    completed.forEach(entry => {
      const bucket = Math.min(Math.floor((entry.modelProbability || 0) / 10), 9)
      buckets[bucket].predictions++
      buckets[bucket].outcomes += entry.actualSnowDay ? 1 : 0
    })

    return buckets
      .map((bucket, index) => ({
        range: `${index * 10}-${(index + 1) * 10}%`,
        predicted: index * 10 + 5,
        observed: bucket.predictions > 0 ? Math.round((bucket.outcomes / bucket.predictions) * 100) : 0,
        count: bucket.predictions
      }))
      .filter(bucket => bucket.count > 0)
  }, [outcomes])

  const recentTrend = useMemo(() => {
    const trendSource = outcomes
      .filter(entry => 
        typeof entry.modelProbability === 'number' && 
        entry.actualSnowDay !== null && 
        entry.actualSnowDay !== undefined
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-7)

    return trendSource.map(entry => {
      const prob = typeof entry.modelProbability === 'number' ? entry.modelProbability : 0
      const actual = entry.actualSnowDay ? 1 : 0
      const brier = Math.pow(prob / 100 - actual, 2)
      return {
        date: entry.date,
        modelBrier: brier,
        modelPrediction: prob,
        actualOutcome: actual
      }
    })
  }, [outcomes])

  const completedOutcomes = useMemo(() => {
    return outcomes.map(entry => {
      const prob = typeof entry.modelProbability === 'number' ? entry.modelProbability : null
      const hasOutcome = entry.actualSnowDay !== null && entry.actualSnowDay !== undefined
      const brier = (typeof prob === 'number' && hasOutcome) 
        ? Math.pow(prob / 100 - (entry.actualSnowDay ? 1 : 0), 2) 
        : null
      return { ...entry, modelPrediction: prob, modelBrier: brier }
    })
  }, [outcomes])

  const openRecorderTab = () => {
    if (!isAdmin) return
    const trigger = document.querySelector('[data-value="outcomes"]') as HTMLButtonElement | null
    trigger?.click()
  }

  return (
    <div className="space-y-6">

      {pendingRecords.length > 0 && (
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Calendar size={20} className="text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-sm text-yellow-800">
                  Pending Outcomes ({pendingRecords.length})
                </h3>
                <p className="text-xs text-yellow-700 mb-3">
                  These predictions need real-world outcomes logged.
                </p>
                <div className="space-y-2">
                  {pendingRecords.map(record => (
                    <div key={record.date} className="flex items-center justify-between p-2 bg-white rounded border">
                      <div className="text-sm">
                        <span className="font-medium mr-2">{new Date(record.date).toLocaleDateString()}</span>
                        <span className="text-muted-foreground">Model: {record.modelPrediction}%</span>
                      </div>
                      {isAdmin ? (
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={openRecorderTab}
                            className="text-xs bg-yellow-100 hover:bg-yellow-200 border-yellow-300"
                          >
                            Open Recorder
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            asChild
                          >
                            <a
                              href="https://github.com/StevenWangler/snowday-forecast/actions/workflows/log-outcome.yml"
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs"
                            >
                              Workflow
                            </a>
                          </Button>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Outcome logging restricted to admins.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target size={20} />
              Model Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Brier Score</span>
                <span className="font-bold">{stats.modelBrier.toFixed(3)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Directional Accuracy</span>
                <span className="font-bold">{stats.modelAccuracy}%</span>
              </div>
            </div>
            <Badge variant={stats.modelBrier < 0.15 ? 'default' : 'secondary'} className="w-full justify-center">
              {stats.modelBrier < 0.15 ? 'Excellent' : stats.modelBrier < 0.25 ? 'Good' : 'Needs Tuning'}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock size={20} />
              Prediction Volume
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold">{stats.totalPredictions}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Completed</span>
                                    <span className="font-semibold">{stats.completedPredictions}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pending</span>
              <span className="font-semibold">{stats.pendingPredictions}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Snow Days Logged</span>
              <span className="font-semibold">{stats.snowDays}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Brier Score Trend</CardTitle>
            <p className="text-sm text-muted-foreground">
              Lower scores indicate better calibration • {recentTrend.length} completed predictions
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={recentTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(date) => new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  />
                  <YAxis tick={{ fontSize: 12 }} domain={[0, 0.5]} />
                  <Tooltip 
                    labelFormatter={(date) => new Date(date).toLocaleDateString()}
                    formatter={(value: number) => [value.toFixed(3), 'Brier']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="modelBrier" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Calibration Chart</CardTitle>
            <p className="text-sm text-muted-foreground">
              How well probabilities match outcomes • {calibrationData.length} bins
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={calibrationData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                  <Tooltip formatter={(value: number) => [`${value}%`, 'Observed']} />
                  <Bar dataKey="observed" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Perfect calibration lands each bar near the midpoint of its range.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Predictions</CardTitle>
          <p className="text-sm text-muted-foreground">
            Latest forecasting performance • {completedOutcomes.length} total records
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {completedOutcomes.length > 0 ? (
              completedOutcomes.map((record) => (
                <div key={`${record.date}-${record.recordedAt}`} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-4">
                    <div className="text-sm font-medium">
                      {new Date(record.date).toLocaleDateString(undefined, { 
                        weekday: 'short', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </div>
                    <div className="text-sm">
                      <span>{typeof record.modelPrediction === 'number' ? `${record.modelPrediction}%` : '—'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={record.actualSnowDay === true ? 'destructive' : record.actualSnowDay === false ? 'secondary' : 'outline'}>
                      {record.actualSnowDay === true ? 'Snow Day' : record.actualSnowDay === false ? 'School Open' : 'Pending'}
                    </Badge>
                    {typeof record.modelBrier === 'number' && (
                      <div className="text-sm text-muted-foreground">
                        Brier: {record.modelBrier.toFixed(3)}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Target size={48} className="mx-auto mb-4 opacity-50" />
                <p className="text-sm">No prediction data yet</p>
                <p className="text-xs">Record some outcomes to build the accuracy dashboard.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
