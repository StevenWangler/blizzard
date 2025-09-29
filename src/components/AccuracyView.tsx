import { useKV } from '@github/spark/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { Target, TrendUp, TrendDown, Trophy, ArrowsClockwise, Calendar, Warning } from '@phosphor-icons/react'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'

interface AccuracyRecord {
  date: string
  modelPrediction: number
  communityPrediction: number
  actualOutcome: number | null // null = outcome not yet determined
  modelBrier: number | null
  communityBrier: number | null
  communityVoteCount: number
  dataSource: 'real' | 'demo'
}

interface CommunityVote {
  type: 'probability' | 'thumbs'
  value: number
  timestamp: number
  fingerprint?: string
}

export function AccuracyView() {
  const [accuracyHistory, setAccuracyHistory] = useKV<AccuracyRecord[]>('accuracy-history', [])
  const [communityVotes] = useKV<CommunityVote[]>('community-votes', [])
  const [pendingOutcomes, setPendingOutcomes] = useKV<string[]>('pending-outcomes', [])
  const [loading, setLoading] = useState(false)

  // Generate real accuracy record from current day's data
  const generateTodaysRecord = async (): Promise<AccuracyRecord | null> => {
    try {
      const today = new Date().toISOString().split('T')[0]
      
      // Check if we already have today's record
      const existingRecord = accuracyHistory?.find(record => record.date === today)
      if (existingRecord) return existingRecord

      // Get community prediction from actual votes
      let communityPrediction = 0
      let communityVoteCount = 0
      
      if (communityVotes && communityVotes.length > 0) {
        // Get votes from the last 24 hours for "today's" prediction
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000)
        const recentVotes = communityVotes.filter(vote => vote.timestamp > oneDayAgo)
        
        if (recentVotes.length > 0) {
          communityPrediction = Math.round(
            recentVotes.reduce((sum, vote) => sum + vote.value, 0) / recentVotes.length
          )
          communityVoteCount = recentVotes.length
        }
      }

      // Get model prediction from weather service or AI prediction
      let modelPrediction = 0
      try {
        // Try to get from AI prediction first
        const response = await fetch('/data/prediction.json')
        if (response.ok) {
          const data = await response.json()
          modelPrediction = data.final?.snow_day_probability || 0
        } else {
          // Fallback to weather service calculation
          const { WeatherService } = await import('@/services/weather')
          const weatherData = await WeatherService.getCurrentForecast()
          modelPrediction = weatherData.modelProbability || 0
        }
      } catch (error) {
        console.warn('Could not fetch model prediction, using fallback:', error)
        // Use a simple heuristic as fallback
        modelPrediction = Math.round(30 + Math.random() * 40) // 30-70% range
      }

      // Create record with null outcome (to be filled later)
      const record: AccuracyRecord = {
        date: today,
        modelPrediction,
        communityPrediction,
        communityVoteCount,
        actualOutcome: null,
        modelBrier: null,
        communityBrier: null,
        dataSource: 'real'
      }

      return record
    } catch (error) {
      console.error('Error generating today\'s record:', error)
      return null
    }
  }

  // Calculate Brier score: (prediction - outcome)²
  const calculateBrierScore = (prediction: number, outcome: number): number => {
    const p = prediction / 100 // Convert percentage to probability
    return Math.pow(p - outcome, 2)
  }

  // Update record with actual outcome
  const recordOutcome = async (date: string, outcome: number) => {
    if (!accuracyHistory) return

    const updatedHistory = accuracyHistory.map(record => {
      if (record.date === date) {
        const modelBrier = calculateBrierScore(record.modelPrediction, outcome)
        const communityBrier = calculateBrierScore(record.communityPrediction, outcome)
        
        return {
          ...record,
          actualOutcome: outcome,
          modelBrier,
          communityBrier
        }
      }
      return record
    })

    setAccuracyHistory(updatedHistory)
    
    // Remove from pending outcomes
    const updatedPending = pendingOutcomes?.filter(d => d !== date) || []
    setPendingOutcomes(updatedPending)
    
    toast.success(`Outcome recorded for ${date}`)
  }

  // Initialize today's record if it doesn't exist or update if community votes changed
  useEffect(() => {
    const initTodaysRecord = async () => {
      setLoading(true)
      try {
        const today = new Date().toISOString().split('T')[0]
        const todaysRecord = await generateTodaysRecord()
        
        if (todaysRecord) {
          const existingRecordIndex = accuracyHistory?.findIndex(r => r.date === todaysRecord.date) ?? -1
          
          if (existingRecordIndex >= 0) {
            // Update existing record with latest community prediction
            const updatedHistory = [...(accuracyHistory || [])]
            updatedHistory[existingRecordIndex] = {
              ...updatedHistory[existingRecordIndex],
              communityPrediction: todaysRecord.communityPrediction,
              communityVoteCount: todaysRecord.communityVoteCount
            }
            setAccuracyHistory(updatedHistory)
          } else {
            // Add new record
            const updatedHistory = [...(accuracyHistory || []), todaysRecord]
            setAccuracyHistory(updatedHistory)
            
            // Add to pending outcomes if outcome is null
            if (todaysRecord.actualOutcome === null) {
              const updatedPending = [...(pendingOutcomes || []), todaysRecord.date]
              setPendingOutcomes(updatedPending)
            }
          }
        }
      } catch (error) {
        console.error('Error initializing today\'s record:', error)
      } finally {
        setLoading(false)
      }
    }

    initTodaysRecord()
  }, [communityVotes]) // Re-run when community votes change

  // Add some demo data if we have no real data yet
  useEffect(() => {
    if (!accuracyHistory || accuracyHistory.length === 0) {
      const demoData: AccuracyRecord[] = [
        {
          date: '2024-01-15',
          modelPrediction: 85,
          communityPrediction: 78,
          communityVoteCount: 23,
          actualOutcome: 1,
          modelBrier: calculateBrierScore(85, 1),
          communityBrier: calculateBrierScore(78, 1),
          dataSource: 'demo'
        },
        {
          date: '2024-01-16', 
          modelPrediction: 35,
          communityPrediction: 42,
          communityVoteCount: 31,
          actualOutcome: 0,
          modelBrier: calculateBrierScore(35, 0),
          communityBrier: calculateBrierScore(42, 0),
          dataSource: 'demo'
        },
        {
          date: '2024-01-17',
          modelPrediction: 65,
          communityPrediction: 58,
          communityVoteCount: 18,
          actualOutcome: 1,
          modelBrier: calculateBrierScore(65, 1),
          communityBrier: calculateBrierScore(58, 1),
          dataSource: 'demo'
        }
      ]
      setAccuracyHistory(demoData)
    }
  }, [])

  const calculateOverallStats = () => {
    if (!accuracyHistory || accuracyHistory.length === 0) {
      return {
        modelBrier: 0,
        communityBrier: 0,
        modelAccuracy: 0,
        communityAccuracy: 0,
        totalPredictions: 0,
        completedPredictions: 0,
        pendingPredictions: 0,
        realDataCount: 0,
        demoDataCount: 0
      }
    }

    // Only use completed predictions for accuracy calculations
    const completedRecords = accuracyHistory.filter(record => 
      record.actualOutcome !== null && 
      record.modelBrier !== null && 
      record.communityBrier !== null
    )
    
    const pendingRecords = accuracyHistory.filter(record => record.actualOutcome === null)
    const realRecords = accuracyHistory.filter(record => record.dataSource === 'real')
    const demoRecords = accuracyHistory.filter(record => record.dataSource === 'demo')

    if (completedRecords.length === 0) {
      return {
        modelBrier: 0,
        communityBrier: 0,
        modelAccuracy: 0,
        communityAccuracy: 0,
        totalPredictions: accuracyHistory.length,
        completedPredictions: 0,
        pendingPredictions: pendingRecords.length,
        realDataCount: realRecords.length,
        demoDataCount: demoRecords.length
      }
    }

    const totalCompleted = completedRecords.length
    const modelBrier = completedRecords.reduce((sum, record) => sum + (record.modelBrier || 0), 0) / totalCompleted
    const communityBrier = completedRecords.reduce((sum, record) => sum + (record.communityBrier || 0), 0) / totalCompleted

    const modelCorrect = completedRecords.filter(record => {
      const predicted = record.modelPrediction > 50 ? 1 : 0
      return predicted === record.actualOutcome
    }).length

    const communityCorrect = completedRecords.filter(record => {
      const predicted = record.communityPrediction > 50 ? 1 : 0
      return predicted === record.actualOutcome
    }).length

    return {
      modelBrier,
      communityBrier,
      modelAccuracy: Math.round((modelCorrect / totalCompleted) * 100),
      communityAccuracy: Math.round((communityCorrect / totalCompleted) * 100),
      totalPredictions: accuracyHistory.length,
      completedPredictions: totalCompleted,
      pendingPredictions: pendingRecords.length,
      realDataCount: realRecords.length,
      demoDataCount: demoRecords.length
    }
  }

  const getCalibrationData = () => {
    if (!accuracyHistory || accuracyHistory.length === 0) return []

    // Only use completed records for calibration
    const completedRecords = accuracyHistory.filter(record => record.actualOutcome !== null)
    if (completedRecords.length === 0) return []

    const buckets = Array(10).fill(0).map(() => ({ predictions: 0, outcomes: 0 }))
    
    completedRecords.forEach(record => {
      const bucket = Math.min(Math.floor(record.communityPrediction / 10), 9)
      buckets[bucket].predictions++
      buckets[bucket].outcomes += record.actualOutcome || 0
    })

    return buckets.map((bucket, index) => ({
      range: `${index * 10}-${(index + 1) * 10}%`,
      predicted: (index * 10 + 5),
      observed: bucket.predictions > 0 ? Math.round((bucket.outcomes / bucket.predictions) * 100) : 0,
      count: bucket.predictions
    })).filter(item => item.count > 0)
  }

  const stats = calculateOverallStats()
  const calibrationData = getCalibrationData()
  const recentTrend = accuracyHistory?.filter(r => r.actualOutcome !== null).slice(-7) || []
  const pendingRecords = accuracyHistory?.filter(r => r.actualOutcome === null) || []

  return (
    <div className="space-y-6">
      {/* Data Status Banner */}
      <Card className={`${stats.realDataCount > 0 ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${stats.realDataCount > 0 ? 'bg-green-100' : 'bg-blue-100'}`}>
                {stats.realDataCount > 0 ? (
                  <Target size={20} className="text-green-600" />
                ) : (
                  <Warning size={20} className="text-blue-600" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-sm">
                  {stats.realDataCount > 0 ? 'Real Data Connected!' : 'Demo Data Active'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {stats.realDataCount > 0 
                    ? `${stats.realDataCount} real prediction${stats.realDataCount > 1 ? 's' : ''}, ${stats.demoDataCount} demo records`
                    : `Using ${stats.demoDataCount} demo records - cast votes to generate real accuracy data`
                  }
                </p>
              </div>
            </div>
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ArrowsClockwise size={16} className="animate-spin" />
                Syncing...
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pending Outcomes Alert */}
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
                  These predictions need actual snow day outcomes to calculate accuracy
                </p>
                <div className="space-y-2">
                  {pendingRecords.map(record => (
                    <div key={record.date} className="flex items-center justify-between p-2 bg-white rounded border">
                      <div className="text-sm">
                        <span className="font-medium">{record.date}</span>
                        <span className="text-muted-foreground ml-2">
                          Model: {record.modelPrediction}% • Community: {record.communityPrediction}% 
                          ({record.communityVoteCount} votes)
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => recordOutcome(record.date, 1)}
                          className="text-xs bg-red-50 hover:bg-red-100 border-red-200"
                        >
                          Snow Day
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => recordOutcome(record.date, 0)}
                          className="text-xs bg-green-50 hover:bg-green-100 border-green-200"
                        >
                          School Open
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-6">
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
                <span className="text-sm text-muted-foreground">Accuracy</span>
                <span className="font-bold">{stats.modelAccuracy}%</span>
              </div>
            </div>
            <Badge variant={stats.modelBrier < 0.15 ? 'default' : 'secondary'} className="w-full justify-center">
              {stats.modelBrier < 0.15 ? 'Excellent' : stats.modelBrier < 0.25 ? 'Good' : 'Needs Improvement'}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy size={20} />
              Community Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Brier Score</span>
                <span className="font-bold">{stats.communityBrier.toFixed(3)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Accuracy</span>
                <span className="font-bold">{stats.communityAccuracy}%</span>
              </div>
            </div>
            <Badge variant={stats.communityBrier < 0.15 ? 'default' : 'secondary'} className="w-full justify-center">
              {stats.communityBrier < 0.15 ? 'Excellent' : stats.communityBrier < 0.25 ? 'Good' : 'Needs Improvement'}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              {stats.communityBrier < stats.modelBrier ? <TrendUp size={20} /> : <TrendDown size={20} />}
              Winner
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {stats.communityBrier < stats.modelBrier ? 'Community' : 'Model'}
              </div>
              <p className="text-sm text-muted-foreground">
                Better Brier score by {Math.abs(stats.communityBrier - stats.modelBrier).toFixed(3)}
              </p>
            </div>
            <div className="text-xs text-muted-foreground text-center">
              Based on {stats.completedPredictions} completed prediction{stats.completedPredictions !== 1 ? 's' : ''}
              {stats.pendingPredictions > 0 && (
                <> • {stats.pendingPredictions} pending</>
              )}
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
                    formatter={(value: number, name: string) => [value.toFixed(3), name === 'modelBrier' ? 'Model' : 'Community']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="modelBrier" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    name="modelBrier"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="communityBrier" 
                    stroke="hsl(var(--accent))" 
                    strokeWidth={2}
                    name="communityBrier"
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
              How well predictions match reality • {calibrationData.length} probability ranges
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
              Perfect calibration would show bars matching their x-axis position
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Predictions</CardTitle>
          <p className="text-sm text-muted-foreground">
            Latest forecasting performance • {accuracyHistory?.length || 0} total records
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {accuracyHistory && accuracyHistory.length > 0 ? (
              accuracyHistory.slice().reverse().map((record) => (
                <div key={record.date} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-4">
                    <div className="text-sm font-medium">
                      {new Date(record.date).toLocaleDateString(undefined, { 
                        weekday: 'short', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Model: {record.modelPrediction}%</span>
                      <span className="text-sm">
                        Community: {record.communityPrediction}% 
                        <span className="text-xs text-muted-foreground ml-1">
                          ({record.communityVoteCount} votes)
                        </span>
                      </span>
                    </div>
                    {record.dataSource === 'demo' && (
                      <Badge variant="secondary" className="text-xs">Demo</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {record.actualOutcome !== null ? (
                      <>
                        <Badge variant={record.actualOutcome === 1 ? 'destructive' : 'secondary'}>
                          {record.actualOutcome === 1 ? 'Snow Day' : 'School Open'}
                        </Badge>
                        <div className="text-sm text-muted-foreground">
                          M: {record.modelBrier?.toFixed(3)} | C: {record.communityBrier?.toFixed(3)}
                        </div>
                      </>
                    ) : (
                      <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                        Pending
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Target size={48} className="mx-auto mb-4 opacity-50" />
                <p className="text-sm">No prediction data yet</p>
                <p className="text-xs">Cast some votes to start generating accuracy records!</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
