import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { CloudSnow, CalendarBlank, Clock, ArrowsClockwise } from '@phosphor-icons/react'
import { fetchOutcomeLedger, SnowDayOutcome, normalizeProbability } from '@/services/outcomes'
import { useIsMobile } from '@/hooks/use-mobile'

interface HistoricalEvent {
  date: string
  eventName: string
  modelPrediction: number | null
  actualOutcome: boolean | null
  noSchoolScheduled: boolean
  noSchoolReason?: string
  notes: string
  recordedBy: string
  recordedAt: string
  confidence?: string | null
  source?: string
}

const generateEventName = (entry: SnowDayOutcome): string => {
  // Handle no-school days (weekends, holidays)
  if (entry.noSchoolScheduled) {
    const reasonLabels: Record<string, string> = {
      'weekend': 'Weekend',
      'thanksgiving': 'Thanksgiving Break',
      'winter-break': 'Winter Break',
      'spring-break': 'Spring Break',
      'teacher-day': 'Teacher In-Service',
      'mlk-day': 'MLK Day',
      'presidents-day': 'Presidents Day',
      'memorial-day': 'Memorial Day',
      'other': 'School Holiday'
    }
    return reasonLabels[entry.noSchoolReason || ''] || 'No School Scheduled'
  }

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

  // Add T12:00:00 to avoid timezone issues with date-only strings
  const date = new Date(entry.date + 'T12:00:00')
  const monthName = date.toLocaleDateString('en-US', { month: 'long' })
  const prob = normalizeProbability(entry.modelProbability)
  
  if (entry.actualSnowDay === true) {
    const confident = prob !== null && prob >= 70
    return confident ? `${monthName} Storm (Predicted)` : `${monthName} Surprise Storm`
  }
  
  if (entry.actualSnowDay === false) {
    const expectedClosure = prob !== null && prob >= 50
    if (expectedClosure) return `${monthName} False Alarm`
    if ((prob ?? 0) >= 30) return `${monthName} Close Call`
    return `${monthName} Light Snow`
  }

  return `${monthName} Forecast`
}

const generateNotes = (entry: SnowDayOutcome): string => {
  if (entry.notes) return entry.notes
  
  // Handle no-school days
  if (entry.noSchoolScheduled) {
    const reasonDescriptions: Record<string, string> = {
      'weekend': 'No school on weekends - prediction tracked for reference only.',
      'thanksgiving': 'School closed for Thanksgiving holiday.',
      'winter-break': 'School closed for winter break.',
      'spring-break': 'School closed for spring break.',
      'teacher-day': 'No classes - teacher in-service day.',
      'mlk-day': 'School closed for Martin Luther King Jr. Day.',
      'presidents-day': 'School closed for Presidents Day.',
      'memorial-day': 'School closed for Memorial Day.',
      'other': 'School closed for scheduled holiday.'
    }
    return reasonDescriptions[entry.noSchoolReason || ''] || 'No school scheduled for this day.'
  }

  const prob = normalizeProbability(entry.modelProbability)
  
  if (entry.actualSnowDay === true) {
    return prob !== null && prob >= 50
      ? 'Model called the closure correctly and confidence tracked well.'
      : 'Closure arrived despite low modeled probability. Capture context in notes next time.'
  }
  
  if (entry.actualSnowDay === false) {
    return prob !== null && prob >= 50
      ? 'Model leaned toward closure but schools stayed open.'
      : 'Routine day with manageable conditions.'
  }

  return 'Outcome pending verification.'
}

const toHistoricalEvents = (ledger: SnowDayOutcome[]): HistoricalEvent[] => {
  // Filter out future dates - history should only show past events
  // Use local date comparison to avoid timezone issues with date-only strings
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  
  return ledger
    .filter(entry => entry.date <= todayStr)
    .map(entry => ({
      date: entry.date,
      eventName: generateEventName(entry),
      modelPrediction: normalizeProbability(entry.modelProbability),
      actualOutcome: entry.actualSnowDay ?? null,
      noSchoolScheduled: entry.noSchoolScheduled ?? false,
      noSchoolReason: entry.noSchoolReason,
      notes: generateNotes(entry),
      recordedBy: entry.recordedBy,
      recordedAt: entry.recordedAt,
      confidence: entry.confidence ?? undefined,
      source: entry.source
    })).sort((a, b) => b.date.localeCompare(a.date))
}

const getAccuracyBadge = (prediction: number | null, outcome: boolean | null, noSchoolScheduled: boolean) => {
  if (noSchoolScheduled) return { text: 'N/A', variant: 'outline' as const }
  if (outcome === null) return { text: 'Pending', variant: 'outline' as const }
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

const calculateBrierScore = (prediction: number | null, outcome: boolean | null, noSchoolScheduled: boolean) => {
  if (noSchoolScheduled) return null
  if (prediction === null || outcome === null) return null
  const prob = prediction / 100
  return Math.pow(prob - (outcome ? 1 : 0), 2)
}

export function HistoryView() {
  const [searchTerm, setSearchTerm] = useState('')
  const [events, setEvents] = useState<HistoricalEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isMobile = useIsMobile()

  const loadHistory = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const ledger = await fetchOutcomeLedger({ bustCache: true })
      setEvents(toHistoricalEvents(ledger))
    } catch (err) {
      console.warn('Could not load history:', err)
      setEvents([])
      setError('Unable to load history right now. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const seasonStats = useMemo(() => {
    if (events.length === 0) {
      return {
        totalEvents: 0,
        snowDays: 0,
        noSchoolDays: 0,
        modelAccuracy: null as number | null,
        realEvents: 0,
        demoEvents: 0,
        pendingSchoolDays: 0,
        completedSchoolDays: 0,
        scorableEvents: 0
      }
    }

    // Filter out no-school days for accuracy calculations
    const schoolDayEvents = events.filter(e => !e.noSchoolScheduled)
    const completedEvents = schoolDayEvents.filter(e => e.actualOutcome !== null)
    const pendingSchoolDays = schoolDayEvents.filter(e => e.actualOutcome === null).length
    const noSchoolDays = events.filter(e => e.noSchoolScheduled).length
    const snowDays = completedEvents.filter(e => e.actualOutcome === true).length
    const realEvents = events.filter(e => e.source !== 'seed').length
    const demoEvents = events.length - realEvents
    const withProb = completedEvents.filter(e => e.modelPrediction !== null)
    const modelCorrect = withProb.filter(e => (e.modelPrediction ?? 0) >= 50 === e.actualOutcome).length

    return {
      totalEvents: events.length,
      snowDays,
      noSchoolDays,
      modelAccuracy: withProb.length ? Math.round((modelCorrect / withProb.length) * 100) : null,
      realEvents,
      demoEvents,
      pendingSchoolDays,
      completedSchoolDays: completedEvents.length,
      scorableEvents: withProb.length
    }
  }, [events])

  const filteredEvents = events.filter(event => {
    const term = searchTerm.toLowerCase()
    if (!term) return true
    const dateText = new Date(event.date + 'T12:00:00').toLocaleDateString(undefined, { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }).toLowerCase()
    return (
      event.eventName.toLowerCase().includes(term) ||
      event.notes.toLowerCase().includes(term) ||
      dateText.includes(term)
    )
  })

  return (
    <div className="space-y-8 relative z-10">

      {seasonStats.totalEvents > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 md:gap-5">
          <Card className="h-full rounded-2xl border border-primary/10 bg-background/80 backdrop-blur shadow-lg shadow-primary/5">
            <CardContent className="p-5 text-center">
              <div className="text-2xl font-bold text-primary">{seasonStats.totalEvents}</div>
              <p className="text-sm text-muted-foreground">Total Events</p>
              <p className="text-xs text-muted-foreground">{seasonStats.pendingSchoolDays} pending outcomes</p>
            </CardContent>
          </Card>
          <Card className="h-full rounded-2xl border border-primary/10 bg-background/80 backdrop-blur shadow-lg shadow-primary/5">
            <CardContent className="p-5 text-center">
              <div className="text-2xl font-bold text-destructive">{seasonStats.snowDays}</div>
              <p className="text-sm text-muted-foreground">Snow Days</p>
              {seasonStats.completedSchoolDays > 0 && (
                <p className="text-xs text-muted-foreground">
                  {Math.round((seasonStats.snowDays / seasonStats.completedSchoolDays) * 100)}% of completed school days
                </p>
              )}
              {seasonStats.completedSchoolDays === 0 && (
                <p className="text-xs text-muted-foreground">No verified outcomes yet</p>
              )}
            </CardContent>
          </Card>
          <Card className="h-full rounded-2xl border border-primary/10 bg-background/80 backdrop-blur shadow-lg shadow-primary/5">
            <CardContent className="p-5 text-center">
              <div className="text-2xl font-bold text-muted-foreground">{seasonStats.noSchoolDays}</div>
              <p className="text-sm text-muted-foreground">Holidays/Weekends</p>
              <p className="text-xs text-muted-foreground">Excluded from stats</p>
            </CardContent>
          </Card>
          <Card className="h-full rounded-2xl border border-primary/10 bg-background/80 backdrop-blur shadow-lg shadow-primary/5">
            <CardContent className="p-5 text-center">
              <div className="text-2xl font-bold text-accent">
                {seasonStats.modelAccuracy !== null ? `${seasonStats.modelAccuracy}%` : '—'}
              </div>
              <p className="text-sm text-muted-foreground">Model Accuracy</p>
              <p className="text-xs text-muted-foreground">
                {seasonStats.scorableEvents > 0 
                  ? `Based on ${seasonStats.scorableEvents} scored predictions`
                  : 'Need completed outcomes to score'}
              </p>
            </CardContent>
          </Card>
          <Card className="h-full rounded-2xl border border-primary/10 bg-background/80 backdrop-blur shadow-lg shadow-primary/5 col-span-2 lg:col-span-1">
            <CardContent className="p-5 text-center">
              <div className="text-2xl font-bold text-muted-foreground">{seasonStats.realEvents}</div>
              <p className="text-sm text-muted-foreground">Live Records</p>
              <p className="text-xs text-muted-foreground">Demo data: {seasonStats.demoEvents}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="rounded-2xl border border-primary/10 bg-background/80 backdrop-blur shadow-lg shadow-primary/5">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarBlank size={20} className="text-primary" />
              Event History
            </CardTitle>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="w-full sm:w-64">
                <Input
                  placeholder="Search events..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button variant="ghost" size="icon" onClick={loadHistory} disabled={loading} title="Refresh history">
                <ArrowsClockwise size={18} className={loading ? 'animate-spin' : ''} />
              </Button>
              {seasonStats.totalEvents > 0 && (
                <div className={`text-xs text-muted-foreground ${isMobile ? '' : 'sm:self-center'}`}>
                  {filteredEvents.length} of {seasonStats.totalEvents} events
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <Clock size={16} className="mt-0.5" />
              <div className="flex-1">
                <p>{error}</p>
                <Button variant="link" className="px-0 text-destructive underline-offset-4" onClick={loadHistory}>
                  Try again
                </Button>
              </div>
            </div>
          )}
          {loading && events.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock size={32} className="mx-auto mb-3 animate-spin" />
              <p className="text-sm">Loading history...</p>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CloudSnow size={40} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">No matching events yet.</p>
              <p className="text-xs">Record more outcomes to grow this view.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {filteredEvents.map(event => {
                const badge = getAccuracyBadge(event.modelPrediction, event.actualOutcome, event.noSchoolScheduled)
                const brier = calculateBrierScore(event.modelPrediction, event.actualOutcome, event.noSchoolScheduled)
                return (
                  <Card key={`${event.date}-${event.recordedAt}`} className="rounded-xl border border-border/60 bg-card/80 p-5 sm:p-6 shadow-sm">
                    <div className="space-y-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="font-semibold text-lg flex items-center gap-2.5">
                            <CloudSnow size={20} className={event.actualOutcome ? 'text-destructive' : 'text-muted-foreground'} />
                            {event.eventName}
                          </h3>
                          <div className="flex items-center gap-2 mt-1.5 text-sm text-muted-foreground">
                            <span>{new Date(event.date + 'T12:00:00').toLocaleDateString(undefined, { 
                              weekday: 'long', 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}</span>
      
                          </div>
                        </div>
                        <div className="sm:text-right">
                          {event.noSchoolScheduled ? (
                            <Badge variant="outline" className="bg-muted">
                              No School
                            </Badge>
                          ) : (
                            <Badge variant={event.actualOutcome === true ? 'destructive' : event.actualOutcome === false ? 'secondary' : 'outline'}>
                              {event.actualOutcome === true ? 'Snow Day' : event.actualOutcome === false ? 'School Open' : 'Pending'}
                            </Badge>
                          )}
                          {brier !== null && (
                            <p className="text-xs text-muted-foreground mt-1.5">Brier {brier.toFixed(3)}</p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Model</p>
                          <p className="font-medium">{event.modelPrediction !== null ? `${event.modelPrediction}%` : '—'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Confidence</p>
                          <p className="font-medium">{event.confidence || '—'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Accuracy</p>
                          <Badge variant={badge.variant}>{badge.text}</Badge>
                        </div>
                      </div>

                      <Separator />

                      <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{event.notes}</p>

                      <div className="text-xs text-muted-foreground flex flex-wrap gap-2 sm:gap-4">
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
