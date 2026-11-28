import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { StudentPageHeading } from '@/components/StudentPageHeading'
import { CloudSnow, Clock, ArrowsClockwise, CaretDown } from '@phosphor-icons/react'
import { fetchOutcomeLedger, SnowDayOutcome, readOutcomeProbability } from '@/services/outcomes'
import { schoolDateLabel } from '@/lib/forecastPresentation'

const CALLS_PER_PAGE = 10

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
  const prob = readOutcomeProbability(entry.modelProbability)
  
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

  const prob = readOutcomeProbability(entry.modelProbability)
  
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
      modelPrediction: readOutcomeProbability(entry.modelProbability),
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
  const [page, setPage] = useState(1)
  const resultsCount = useRef<HTMLParagraphElement>(null)
  const [events, setEvents] = useState<HistoricalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
    const term = searchTerm.trim().toLowerCase()
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
      dateText.includes(term) ||
      schoolDateLabel(event.date, true).toLowerCase().includes(term) ||
      event.date.includes(term)
    )
  })
  const pageCount = Math.ceil(filteredEvents.length / CALLS_PER_PAGE)
  const currentPage = Math.min(page, Math.max(1, pageCount))
  const start = (currentPage - 1) * CALLS_PER_PAGE
  const visibleEvents = filteredEvents.slice(start, start + CALLS_PER_PAGE)

  function changePage(nextPage: number) {
    setPage(nextPage)
    resultsCount.current?.focus({ preventScroll: true })
    resultsCount.current?.scrollIntoView({ block: 'start' })
  }

  return (
    <div className="student-page history-page space-y-6 sm:space-y-8 relative z-10">
      <StudentPageHeading title="Past calls" description="See what we predicted and what actually happened." />

      <section className="history-archive" aria-label="Forecast archive">
        <div className="history-search">
          <Input
            type="search"
            aria-label="Search past calls"
            placeholder="Search a date or storm…"
            value={searchTerm}
            onChange={event => {
              setSearchTerm(event.target.value)
              setPage(1)
            }}
          />
          <Button variant="outline" size="icon" onClick={loadHistory} disabled={loading} aria-label="Refresh past calls">
            <ArrowsClockwise size={18} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          </Button>
        </div>
        {seasonStats.totalEvents > 0 && (
          <div className="history-overview">
            <p ref={resultsCount} className="history-count" role="status" tabIndex={-1}>
              {pageCount > 1 && `${start + 1}–${start + visibleEvents.length} of `}
              {filteredEvents.length} {searchTerm.trim() && 'matching '}{filteredEvents.length === 1 ? 'record' : 'records'}
            </p>
            <details className="page-disclosure history-stats">
              <summary>Archive stats</summary>
              <div className="page-disclosure-content">
                <dl className="history-summary">
                  <div><dt>Days logged</dt><dd>{seasonStats.totalEvents}</dd></div>
                  <div><dt>Snow days</dt><dd>{seasonStats.snowDays}</dd></div>
                  <div><dt>Correct calls</dt><dd>{seasonStats.modelAccuracy !== null ? `${seasonStats.modelAccuracy}%` : '—'}</dd></div>
                </dl>
                <p className="text-xs leading-5 text-muted-foreground">
                  {seasonStats.scorableEvents} scored calls · {seasonStats.pendingSchoolDays} awaiting results.
                  {' '}{seasonStats.noSchoolDays} holidays/weekends excluded from scoring.
                  {seasonStats.demoEvents > 0 && ` Includes ${seasonStats.demoEvents} demo records; ${seasonStats.realEvents} non-demo records.`}
                </p>
              </div>
            </details>
          </div>
        )}

        {error ? (
          <div role="alert" className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <Clock size={16} className="mt-0.5" />
            <div className="flex-1">
              <p>{error}</p>
              <Button variant="link" className="px-0 text-destructive underline-offset-4" onClick={loadHistory}>
                Try again
              </Button>
            </div>
          </div>
        ) : loading && events.length === 0 ? (
          <div role="status" className="text-center py-12 text-muted-foreground">
            <Clock size={32} className="mx-auto mb-3 animate-spin" />
            <p className="text-sm">Loading history...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CloudSnow size={40} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">{searchTerm.trim() ? 'No matching records.' : 'No past calls yet.'}</p>
          </div>
        ) : (
          <div className="history-listing">
            <div className="history-listing-head" aria-hidden="true"><span>School date</span><span>Outcome / forecast</span></div>
            <ul className="history-records">
              {visibleEvents.map(event => {
                const badge = getAccuracyBadge(event.modelPrediction, event.actualOutcome, event.noSchoolScheduled)
                const brier = calculateBrierScore(event.modelPrediction, event.actualOutcome, event.noSchoolScheduled)
                const outcome = event.noSchoolScheduled ? 'No school scheduled' : event.actualOutcome === true ? 'Snow day' : event.actualOutcome === false ? 'School open' : 'Pending'
                return (
                  <li key={`${event.date}-${event.recordedAt}`}>
                    <details className="history-record">
                      <summary>
                        <span className="history-record-date"><time dateTime={event.date}>{schoolDateLabel(event.date, true)}</time><span>{event.eventName}{event.source === 'seed' && ' · Demo'}</span></span>
                        <span className="history-record-result">
                          <span className={event.actualOutcome === true && !event.noSchoolScheduled ? 'history-snow-day' : undefined}>{outcome}</span>
                          <span>{event.modelPrediction !== null ? `${event.modelPrediction}% forecast` : 'Forecast unavailable'}</span>
                        </span>
                        <CaretDown size={16} aria-hidden="true" />
                      </summary>
                      <div className="history-record-details">
                        <dl>
                          <div><dt>Confidence</dt><dd>{event.confidence?.replace(/_/g, ' ') || '—'}</dd></div>
                          <div><dt>Accuracy</dt><dd><Badge variant={badge.variant}>{badge.text}</Badge></dd></div>
                          {brier !== null && <div><dt>Brier score</dt><dd>{brier.toFixed(3)}</dd></div>}
                        </dl>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{event.notes}</p>
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2 gap-y-1">
                          {event.source === 'seed' && <Badge variant="outline">Demo record</Badge>}
                          <span>Logged by <strong>{event.recordedBy}</strong></span>
                          <span>at {new Date(event.recordedAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </details>
                  </li>
                )
              })}
            </ul>
            {pageCount > 1 && (
              <nav className="history-pagination" aria-label="Past calls pages">
                <Button variant="outline" disabled={currentPage === 1} onClick={() => changePage(currentPage - 1)}>Newer</Button>
                <span>Page {currentPage} of {pageCount}</span>
                <Button variant="outline" disabled={currentPage === pageCount} onClick={() => changePage(currentPage + 1)}>Older</Button>
              </nav>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
