import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { CloudSnow, CalendarBlank, Target, Clock, Database, Sparkle } from '@phosphor-icons/react'
import { fetchOutcomeLedger, SnowDayOutcome } from '@/services/outcomes'

interface HistoricalEvent {
  date: string
  eventName: string
  modelPrediction: number | null
  actualOutcome: boolean
  notes: string
  recordedBy: string
  recordedAt: string
  confidence?: string | null
  source?: string
}

const generateEventName = (entry: SnowDayOutcome): string => {
  if (entry.source === 'seed') {
    const demoNames = [
      'January Blizzard',
      'Light Snow Event',
      'Pre-Holiday Storm',
      'False Alarm',
      'Near Miss'
    ]
    const dateSeed = entry.date.replace(/-/g, '')
    const index = Number(dateSeed) % demoNames.length
    return demoNames[index]
  }

  const date = new Date(entry.date)
  const monthName = date.toLocaleDateString('en-US', { month: 'long' })
  if (entry.actualSnowDay) {
    const confident = typeof entry.modelProbability === 'number' && entry.modelProbability >= 70
    return confident ? `${monthName} Storm (Predicted)` : `${monthName} Surprise Storm`
  }
  const expectedClosure = typeof entry.modelProbability === 'number' && entry.modelProbability >= 50
  if (expectedClosure) return `${monthName} False Alarm`
  if ((entry.modelProbability ?? 0) >= 30) return `${monthName} Close Call`
  return `${monthName} Light Snow`
}

const generateNotes = (entry: SnowDayOutcome): string => {
  if (entry.notes) return entry.notes
  if (entry.actualSnowDay) {
    return entry.modelProbability && entry.modelProbability >= 50
      ? 'Model called the closure correctly and confidence tracked well.'
      : 'Closure arrived despite low modeled probability. Capture context in notes next time.'
  }
  return entry.modelProbability && entry.modelProbability >= 50
    ? 'Model leaned toward closure but schools stayed open.'
    : 'Routine day with manageable conditions.'
}

const toHistoricalEvents = (ledger: SnowDayOutcome[]): HistoricalEvent[] => {
  return ledger.map(entry => ({
    date: entry.date,
    eventName: generateEventName(entry),
    modelPrediction: typeof entry.modelProbability === 'number' ? entry.modelProbability : null,
    actualOutcome: !!entry.actualSnowDay,
    notes: generateNotes(entry),
    recordedBy: entry.recordedBy,
    recordedAt: entry.recordedAt,
    confidence: entry.confidence ?? undefined,
    source: entry.source
  })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

const getAccuracyBadge = (prediction: number | null, outcome: boolean) => {
  if (prediction === null) return { text: 'Unknown', variant: 'outline' as const }
  const predictedClosure = prediction >= 50
  if (predictedClosure === outcome) {
    const confidence = Math.abs(prediction - 50)
    if (confidence > 30) return { text: 'Excellent', variant: 'default' as const }
    if (confidence > 15) return { text: 'Good', variant: 'secondary' as const }
    return { text: 'Tight Call', variant: 'outline' as const }
  }
  return { text: 'Miss', variant: 'destructive' as const }
}

const calculateBrierScore = (prediction: number | null, outcome: boolean) => {
  if (prediction === null) return null
  const prob = prediction / 100
  return Math.pow(prob - (outcome ? 1 : 0), 2)
}

export function HistoryView() {
  const [searchTerm, setSearchTerm] = useState('')
  const [events, setEvents] = useState<HistoricalEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const ledger = await fetchOutcomeLedger({ bustCache: true })
        setEvents(toHistoricalEvents(ledger))
      } catch (err) {
        setError('Unable to load history. Please refresh.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const seasonStats = useMemo(() => {
    if (events.length === 0) {
      return {
        totalEvents: 0,
        snowDays: 0,
        modelAccuracy: 0,
        realEvents: 0,
        demoEvents: 0
      }
    }

    const snowDays = events.filter(e => e.actualOutcome).length
    const realEvents = events.filter(e => e.source !== 'seed').length
    const demoEvents = events.length - realEvents
    const withProb = events.filter(e => e.modelPrediction !== null)
    const modelCorrect = withProb.filter(e => (e.modelPrediction ?? 0) >= 50 === e.actualOutcome).length

    return {
      totalEvents: events.length,
      snowDays,
      modelAccuracy: withProb.length ? Math.round((modelCorrect / withProb.length) * 100) : 0,
      realEvents,
      demoEvents
    }
  }, [events])

  const filteredEvents = events.filter(event => {
    const term = searchTerm.toLowerCase()
    if (!term) return true
    return (
      event.eventName.toLowerCase().includes(term) ||
      event.notes.toLowerCase().includes(term) ||
      new Date(event.date).toLocaleDateString().includes(term)
    )
  })

  return (
    <div className="space-y-6">
      <Card className={`${seasonStats.realEvents ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${seasonStats.realEvents ? 'bg-green-100' : 'bg-blue-100'}`}>
                {seasonStats.realEvents ? (
                  <Database size={20} className="text-green-600" />
                ) : (
                  <Sparkle size={20} className="text-blue-600" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-sm">
                  {seasonStats.realEvents ? 'Live Historical Data' : 'Demo Historical Data'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {seasonStats.realEvents 
                    ? `${seasonStats.realEvents} real event${seasonStats.realEvents !== 1 ? 's' : ''}, ${seasonStats.demoEvents} demo record${seasonStats.demoEvents !== 1 ? 's' : ''}`
                    : 'Populate outcomes via the new workflow to replace demo entries.'
                  }
                </p>
              </div>
            </div>
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock size={16} className="animate-spin" />
                Syncing...
              </div>
            )}
          </div>
          {error && (
            <p className="text-xs text-destructive mt-2">{error}</p>
          )}
        </CardContent>
      </Card>

      {seasonStats.totalEvents > 0 && (
        <div className="grid md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">{seasonStats.totalEvents}</div>
              <p className="text-sm text-muted-foreground">Total Events</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-destructive">{seasonStats.snowDays}</div>
              <p className="text-sm text-muted-foreground">Snow Days</p>
              {seasonStats.totalEvents > 0 && (
                <p className="text-xs text-muted-foreground">
                  {Math.round((seasonStats.snowDays / seasonStats.totalEvents) * 100)}% of logged events
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-accent">{seasonStats.modelAccuracy}%</div>
              <p className="text-sm text-muted-foreground">Model Accuracy</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-muted-foreground">{seasonStats.realEvents}</div>
              <p className="text-sm text-muted-foreground">Live Records</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarBlank size={20} />
              Event History
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="w-64">
                <Input
                  placeholder="Search events..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              {seasonStats.totalEvents > 0 && (
                <div className="text-xs text-muted-foreground">
                  {filteredEvents.length} of {seasonStats.totalEvents} events
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredEvents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CloudSnow size={40} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">No matching events yet.</p>
              <p className="text-xs">Record more outcomes to grow this view.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredEvents.map(event => {
                const badge = getAccuracyBadge(event.modelPrediction, event.actualOutcome)
                const brier = calculateBrierScore(event.modelPrediction, event.actualOutcome)
                return (
                  <Card key={`${event.date}-${event.recordedAt}`} className="p-4">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-lg flex items-center gap-2">
                            <CloudSnow size={20} className={event.actualOutcome ? 'text-destructive' : 'text-muted-foreground'} />
                            {event.eventName}
                          </h3>
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <span>{new Date(event.date).toLocaleDateString(undefined, { 
                              weekday: 'long', 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}</span>
                            <Badge variant="outline" className="text-xs">
                              {event.source === 'seed' ? '🟡 Demo' : '🔴 Live'}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={event.actualOutcome ? 'destructive' : 'secondary'}>
                            {event.actualOutcome ? 'Snow Day' : 'School Open'}
                          </Badge>
                          {brier !== null && (
                            <p className="text-xs text-muted-foreground mt-1">Brier {brier.toFixed(3)}</p>
                          )}
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs uppercase tracking-wide">Model</p>
                          <p className="font-medium">{event.modelPrediction !== null ? `${event.modelPrediction}%` : '—'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs uppercase tracking-wide">Confidence</p>
                          <p className="font-medium">{event.confidence || '—'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs uppercase tracking-wide">Accuracy</p>
                          <Badge variant={badge.variant}>{badge.text}</Badge>
                        </div>
                      </div>

                      <Separator />

                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.notes}</p>

                      <div className="text-xs text-muted-foreground flex flex-wrap gap-3">
                        <span>Logged by <strong>{event.recordedBy}</strong></span>
                        <span>at {new Date(event.recordedAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
