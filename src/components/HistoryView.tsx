import { useKV } from '@github/spark/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { CloudSnow, CalendarBlank, Target, Users, Plus, Clock, Database, Sparkle } from '@phosphor-icons/react'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'

interface HistoricalEvent {
  date: string
  eventName: string
  modelPrediction: number
  communityPrediction: number
  communityVoteCount: number
  actualOutcome: number | null
  snowfall: number | null
  temperature: number | null
  notes: string
  dataSource: 'real' | 'demo' | 'imported'
  createdAt: number
}

interface AccuracyRecord {
  date: string
  modelPrediction: number
  communityPrediction: number
  communityVoteCount: number
  actualOutcome: number | null
  modelBrier: number | null
  communityBrier: number | null
  dataSource: 'real' | 'demo'
}

export function HistoryView() {
  const [searchTerm, setSearchTerm] = useState('')
  const [historicalEvents, setHistoricalEvents] = useKV<HistoricalEvent[]>('historical-events', [])
  const [accuracyHistory] = useKV<AccuracyRecord[]>('accuracy-history', [])
  const [loading, setLoading] = useState(false)

  // Convert accuracy records to historical events
  const convertAccuracyToHistory = () => {
    if (!accuracyHistory || accuracyHistory.length === 0) return []

    return accuracyHistory
      .filter(record => record.actualOutcome !== null) // Only completed records
      .map(record => {
        const event: HistoricalEvent = {
          date: record.date,
          eventName: generateEventName(record),
          modelPrediction: record.modelPrediction,
          communityPrediction: record.communityPrediction,
          communityVoteCount: record.communityVoteCount,
          actualOutcome: record.actualOutcome,
          snowfall: null, // To be filled from weather data
          temperature: null, // To be filled from weather data  
          notes: generateEventNotes(record),
          dataSource: record.dataSource,
          createdAt: Date.now()
        }
        return event
      })
  }

  // Generate realistic event names based on prediction data
  const generateEventName = (record: AccuracyRecord): string => {
    if (record.dataSource === 'demo') {
      const demoNames = [
        'January Blizzard', 'Light Snow Event', 'Pre-Holiday Storm', 
        'False Alarm', 'Thanksgiving Week Surprise', 'Winter Storm Watch'
      ]
      const index = Math.abs(record.date.split('-').reduce((a, b) => a + parseInt(b), 0)) % demoNames.length
      return demoNames[index]
    }

    const date = new Date(record.date)
    const monthName = date.toLocaleDateString('en-US', { month: 'long' })
    
    if (record.actualOutcome === 1) {
      // Snow day happened
      const modelConfident = record.modelPrediction >= 70
      const communityConfident = record.communityPrediction >= 70
      
      if (modelConfident && communityConfident) {
        return `${monthName} Storm (Predicted)`
      } else if (!modelConfident && !communityConfident) {
        return `${monthName} Surprise Storm`
      } else {
        return `${monthName} Snow Event`
      }
    } else {
      // No snow day
      const modelExpected = record.modelPrediction >= 50
      const communityExpected = record.communityPrediction >= 50
      
      if (modelExpected || communityExpected) {
        return `${monthName} False Alarm`
      } else {
        return `${monthName} Light Snow`
      }
    }
  }

  // Generate realistic notes based on prediction accuracy
  const generateEventNotes = (record: AccuracyRecord): string => {
    if (record.dataSource === 'demo') {
      const demoNotes = [
        'Heavy snow with wind gusts up to 40mph. Schools closed district-wide.',
        'Light accumulation but roads remained clear. Schools stayed open.',
        'Major storm before winter break. All activities canceled.',
        'Forecast changed overnight. Only light flurries materialized.',
        'Unexpected heavy band of snow. Late closure announcement.'
      ]
      const index = Math.abs(record.date.split('-').reduce((a, b) => a + parseInt(b), 0)) % demoNotes.length
      return demoNotes[index]
    }

    const modelAccurate = Math.abs((record.modelPrediction > 50 ? 1 : 0) - (record.actualOutcome || 0)) === 0
    const communityAccurate = Math.abs((record.communityPrediction > 50 ? 1 : 0) - (record.actualOutcome || 0)) === 0

    if (record.actualOutcome === 1) {
      // Snow day happened
      if (modelAccurate && communityAccurate) {
        return `Forecasters correctly predicted this storm. Community consensus aligned with model prediction. ${record.communityVoteCount} community votes helped confirm the forecast.`
      } else if (!modelAccurate && !communityAccurate) {
        return `Surprise snow event! Both model and community underestimated the storm potential. Weather patterns shifted unexpectedly.`
      } else if (modelAccurate) {
        return `Weather model was accurate while community was more cautious. Model correctly identified storm potential.`
      } else {
        return `Community forecast was more accurate than the model. Local knowledge proved valuable with ${record.communityVoteCount} votes.`
      }
    } else {
      // No snow day
      if (modelAccurate && communityAccurate) {
        return `Both forecasters correctly predicted light conditions. Well-calibrated predictions from model and community consensus.`
      } else if (!modelAccurate && !communityAccurate) {
        return `False alarm - both forecasters overestimated snow potential. Conditions were lighter than expected.`
      } else if (modelAccurate) {
        return `Model forecast was accurate while community was more pessimistic. Technical forecast proved correct.`
      } else {
        return `Community showed better judgment than model forecast. ${record.communityVoteCount} local votes provided accurate assessment.`
      }
    }
  }

  // Sync accuracy data to historical events
  useEffect(() => {
    const syncHistoricalData = async () => {
      if (!accuracyHistory || accuracyHistory.length === 0) return

      setLoading(true)
      try {
        const convertedEvents = convertAccuracyToHistory()
        const existingEvents = historicalEvents || []
        
        // Merge new events with existing ones, avoiding duplicates
        const mergedEvents = [...existingEvents]
        
        convertedEvents.forEach(newEvent => {
          const existingIndex = mergedEvents.findIndex(e => e.date === newEvent.date)
          if (existingIndex >= 0) {
            // Update existing event with latest data
            mergedEvents[existingIndex] = { ...mergedEvents[existingIndex], ...newEvent }
          } else {
            // Add new event
            mergedEvents.push(newEvent)
          }
        })

        // Sort by date (newest first)
        mergedEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        
        setHistoricalEvents(mergedEvents)
      } catch (error) {
        console.error('Error syncing historical data:', error)
      } finally {
        setLoading(false)
      }
    }

    syncHistoricalData()
  }, [accuracyHistory])

  // Initialize with demo data if no real data exists
  useEffect(() => {
    if ((!historicalEvents || historicalEvents.length === 0) && (!accuracyHistory || accuracyHistory.length === 0)) {
      const demoEvents: HistoricalEvent[] = [
        {
          date: '2024-01-15',
          eventName: 'January Blizzard',
          modelPrediction: 85,
          communityPrediction: 78,
          communityVoteCount: 23,
          actualOutcome: 1,
          snowfall: 8,
          temperature: 12,
          notes: 'Heavy snow with wind gusts up to 40mph. Schools closed district-wide.',
          dataSource: 'demo',
          createdAt: Date.now() - (7 * 24 * 60 * 60 * 1000)
        },
        {
          date: '2024-01-08',
          eventName: 'Light Snow Event',
          modelPrediction: 35,
          communityPrediction: 42,
          communityVoteCount: 31,
          actualOutcome: 0,
          snowfall: 2,
          temperature: 28,
          notes: 'Light accumulation but roads remained clear. Schools stayed open.',
          dataSource: 'demo',
          createdAt: Date.now() - (14 * 24 * 60 * 60 * 1000)
        },
        {
          date: '2023-12-18',
          eventName: 'Pre-Holiday Storm',
          modelPrediction: 90,
          communityPrediction: 85,
          communityVoteCount: 18,
          actualOutcome: 1,
          snowfall: 12,
          temperature: 8,
          notes: 'Major storm before winter break. All activities canceled.',
          dataSource: 'demo',
          createdAt: Date.now() - (21 * 24 * 60 * 60 * 1000)
        }
      ]
      setHistoricalEvents(demoEvents)
    }
  }, [])

  const filteredEvents = historicalEvents?.filter(event => 
    event.eventName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    event.notes.toLowerCase().includes(searchTerm.toLowerCase()) ||
    new Date(event.date).toLocaleDateString().includes(searchTerm)
  ) || []

  const getAccuracyBadge = (prediction: number, outcome: number | null) => {
    if (outcome === null) return { text: 'Pending', variant: 'outline' as const }
    
    const predictedClosure = prediction > 50
    const actualClosure = outcome === 1
    
    if (predictedClosure === actualClosure) {
      const confidence = Math.abs(prediction - 50)
      if (confidence > 30) return { text: 'Excellent', variant: 'default' as const }
      if (confidence > 15) return { text: 'Good', variant: 'secondary' as const }
      return { text: 'Lucky', variant: 'outline' as const }
    }
    
    return { text: 'Miss', variant: 'destructive' as const }
  }

  const calculateBrierScore = (prediction: number, outcome: number | null) => {
    if (outcome === null) return null
    const prob = prediction / 100
    return Math.pow(prob - outcome, 2)
  }

  const getSeasonStats = () => {
    if (!historicalEvents || historicalEvents.length === 0) return null

    const completedEvents = historicalEvents.filter(e => e.actualOutcome !== null)
    const pendingEvents = historicalEvents.filter(e => e.actualOutcome === null)
    const realEvents = historicalEvents.filter(e => e.dataSource === 'real')
    const demoEvents = historicalEvents.filter(e => e.dataSource === 'demo')
    
    if (completedEvents.length === 0) {
      return {
        totalEvents: historicalEvents.length,
        completedEvents: 0,
        pendingEvents: pendingEvents.length,
        snowDays: 0,
        modelAccuracy: 0,
        communityAccuracy: 0,
        realEvents: realEvents.length,
        demoEvents: demoEvents.length
      }
    }

    const snowDays = completedEvents.filter(e => e.actualOutcome === 1).length
    const modelCorrect = completedEvents.filter(e => {
      const predicted = e.modelPrediction > 50 ? 1 : 0
      return predicted === e.actualOutcome
    }).length
    const communityCorrect = completedEvents.filter(e => {
      const predicted = e.communityPrediction > 50 ? 1 : 0
      return predicted === e.actualOutcome
    }).length

    return {
      totalEvents: historicalEvents.length,
      completedEvents: completedEvents.length,
      pendingEvents: pendingEvents.length,
      snowDays,
      modelAccuracy: Math.round((modelCorrect / completedEvents.length) * 100),
      communityAccuracy: Math.round((communityCorrect / completedEvents.length) * 100),
      realEvents: realEvents.length,
      demoEvents: demoEvents.length
    }
  }

  const seasonStats = getSeasonStats()

  return (
    <div className="space-y-6">
      {/* Data Source Status */}
      <Card className={`${seasonStats?.realEvents ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${seasonStats?.realEvents ? 'bg-green-100' : 'bg-blue-100'}`}>
                {seasonStats?.realEvents ? (
                  <Database size={20} className="text-green-600" />
                ) : (
                  <Sparkle size={20} className="text-blue-600" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-sm">
                  {seasonStats?.realEvents ? 'Live Historical Data' : 'Demo Historical Data'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {seasonStats?.realEvents 
                    ? `${seasonStats.realEvents} real event${seasonStats.realEvents > 1 ? 's' : ''}, ${seasonStats.demoEvents} demo records`
                    : `${seasonStats?.demoEvents || 0} demo records - complete accuracy predictions to build real history`
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
        </CardContent>
      </Card>

      {/* Season Statistics */}
      {seasonStats && (
        <div className="grid md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">{seasonStats.totalEvents}</div>
              <p className="text-sm text-muted-foreground">Total Events</p>
              {seasonStats.pendingEvents > 0 && (
                <p className="text-xs text-yellow-600">{seasonStats.pendingEvents} pending</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-destructive">{seasonStats.snowDays}</div>
              <p className="text-sm text-muted-foreground">Snow Days</p>
              {seasonStats.completedEvents > 0 && (
                <p className="text-xs text-muted-foreground">
                  {Math.round((seasonStats.snowDays / seasonStats.completedEvents) * 100)}% of completed
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-accent">{seasonStats.modelAccuracy}%</div>
              <p className="text-sm text-muted-foreground">Model Accuracy</p>
              <p className="text-xs text-muted-foreground">{seasonStats.completedEvents} completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-accent">{seasonStats.communityAccuracy}%</div>
              <p className="text-sm text-muted-foreground">Community Accuracy</p>
              <p className="text-xs text-muted-foreground">{seasonStats.completedEvents} completed</p>
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
              {seasonStats && (
                <div className="text-xs text-muted-foreground">
                  {filteredEvents.length} of {seasonStats.totalEvents} events
                </div>
              )}
            </div>
          </div>
          {seasonStats && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>📊 {seasonStats.completedEvents} completed</span>
              {seasonStats.pendingEvents > 0 && (
                <span>⏳ {seasonStats.pendingEvents} pending</span>
              )}
              {seasonStats.realEvents > 0 && (
                <span>🔴 {seasonStats.realEvents} real</span>
              )}
              {seasonStats.demoEvents > 0 && (
                <span>🟡 {seasonStats.demoEvents} demo</span>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredEvents.map((event) => {
              const modelAccuracy = getAccuracyBadge(event.modelPrediction, event.actualOutcome)
              const communityAccuracy = getAccuracyBadge(event.communityPrediction, event.actualOutcome)
              const modelBrier = calculateBrierScore(event.modelPrediction, event.actualOutcome)
              const communityBrier = calculateBrierScore(event.communityPrediction, event.actualOutcome)

              return (
                <Card key={event.date} className="p-4">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                          <CloudSnow size={20} className={
                            event.actualOutcome === 1 ? 'text-destructive' : 
                            event.actualOutcome === 0 ? 'text-muted-foreground' : 'text-yellow-500'
                          } />
                          {event.eventName}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-sm text-muted-foreground">
                            {new Date(event.date).toLocaleDateString(undefined, { 
                              weekday: 'long', 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                          </p>
                          <Badge variant="outline" className="text-xs">
                            {event.dataSource === 'real' ? '🔴 Live' : '🟡 Demo'}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {event.actualOutcome !== null ? (
                          <Badge variant={event.actualOutcome === 1 ? 'destructive' : 'secondary'} className="text-sm">
                            {event.actualOutcome === 1 ? 'Snow Day' : 'School Open'}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-yellow-600 border-yellow-300 text-sm">
                            Outcome Pending
                          </Badge>
                        )}
                        {event.communityVoteCount > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {event.communityVoteCount} votes
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <h4 className="font-medium">Predictions</h4>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                            <div className="flex items-center gap-2">
                              <Target size={16} />
                              <span className="text-sm">Model</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{event.modelPrediction}%</span>
                              <Badge variant={modelAccuracy.variant} className="text-xs">
                                {modelAccuracy.text}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                            <div className="flex items-center gap-2">
                              <Users size={16} />
                              <span className="text-sm">Community</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{event.communityPrediction}%</span>
                              <Badge variant={communityAccuracy.variant} className="text-xs">
                                {communityAccuracy.text}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        {(modelBrier !== null && communityBrier !== null) && (
                          <div className="text-xs text-muted-foreground">
                            Brier scores: Model {modelBrier.toFixed(3)}, Community {communityBrier.toFixed(3)}
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <h4 className="font-medium">Conditions & Analysis</h4>
                        {(event.snowfall !== null || event.temperature !== null) ? (
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {event.snowfall !== null && (
                              <div>
                                <span className="text-muted-foreground">Snowfall:</span>
                                <span className="ml-2 font-medium">{event.snowfall}"</span>
                              </div>
                            )}
                            {event.temperature !== null && (
                              <div>
                                <span className="text-muted-foreground">Temperature:</span>
                                <span className="ml-2 font-medium">{event.temperature}°F</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground italic">
                            Weather data not available
                          </div>
                        )}
                        <p className="text-sm text-muted-foreground italic">
                          {event.notes}
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>

          {filteredEvents.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarBlank size={48} className="mx-auto mb-4 opacity-50" />
              <p className="text-sm">
                {searchTerm ? 'No events found matching your search.' : 'No historical events yet'}
              </p>
              {!searchTerm && (
                <p className="text-xs">Complete some accuracy predictions to build your history!</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}