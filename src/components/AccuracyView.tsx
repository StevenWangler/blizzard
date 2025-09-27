import { useKV } from '@github/spark/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { Target, TrendUp, TrendDown, Trophy, ArrowsClockwise } from '@phosphor-icons/react'

import { WeatherThemeDemo } from '@/components/WeatherThemeDemo'
import { WeatherDebugPanel } from '@/components/WeatherDebugPanel'
interface AccuracyRecord {
  date: string
  modelPrediction: number
  communityPrediction: number
  actualOutcome: number
  modelBrier: number
  communityBrier: number
}

export function AccuracyView() {
  const [accuracyHistory] = useKV<AccuracyRecord[]>('accuracy-history', [
    {
      date: '2024-01-15',
      modelPrediction: 85,
      communityPrediction: 78,
      actualOutcome: 1,
      modelBrier: 0.0225,
      communityBrier: 0.0484
    },
    {
      date: '2024-01-16',
      modelPrediction: 35,
      communityPrediction: 42,
      actualOutcome: 0,
      modelBrier: 0.1225,
      communityBrier: 0.1764
    },
    {
      date: '2024-01-17',
      modelPrediction: 65,
      communityPrediction: 58,
      actualOutcome: 1,
      modelBrier: 0.1225,
      communityBrier: 0.1764
    },
    {
      date: '2024-01-18',
      modelPrediction: 25,
      communityPrediction: 32,
      actualOutcome: 0,
      modelBrier: 0.0625,
      communityBrier: 0.1024
    },
    {
      date: '2024-01-19',
      modelPrediction: 90,
      communityPrediction: 85,
      actualOutcome: 1,
      modelBrier: 0.01,
      communityBrier: 0.0225
    }
  ])

  const calculateOverallStats = () => {
    if (!accuracyHistory || accuracyHistory.length === 0) {
      return {
        modelBrier: 0,
        communityBrier: 0,
        modelAccuracy: 0,
        communityAccuracy: 0,
        totalPredictions: 0
      }
    }

    const totalPredictions = accuracyHistory.length
    const modelBrier = accuracyHistory.reduce((sum, record) => sum + record.modelBrier, 0) / totalPredictions
    const communityBrier = accuracyHistory.reduce((sum, record) => sum + record.communityBrier, 0) / totalPredictions

    const modelCorrect = accuracyHistory.filter(record => {
      const predicted = record.modelPrediction > 50 ? 1 : 0
      return predicted === record.actualOutcome
    }).length

    const communityCorrect = accuracyHistory.filter(record => {
      const predicted = record.communityPrediction > 50 ? 1 : 0
      return predicted === record.actualOutcome
    }).length

    return {
      modelBrier,
      communityBrier,
      modelAccuracy: Math.round((modelCorrect / totalPredictions) * 100),
      communityAccuracy: Math.round((communityCorrect / totalPredictions) * 100),
      totalPredictions
    }
  }

  const getCalibrationData = () => {
    if (!accuracyHistory || accuracyHistory.length === 0) return []

    const buckets = Array(10).fill(0).map(() => ({ predictions: 0, outcomes: 0 }))
    
    accuracyHistory.forEach(record => {
      const bucket = Math.min(Math.floor(record.communityPrediction / 10), 9)
      buckets[bucket].predictions++
      buckets[bucket].outcomes += record.actualOutcome
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
  const recentTrend = accuracyHistory?.slice(-7) || []

  return (
    <div className="space-y-6">
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
              Based on {stats.totalPredictions} predictions
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Brier Score Trend</CardTitle>
            <p className="text-sm text-muted-foreground">Lower scores indicate better calibration</p>
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
            <p className="text-sm text-muted-foreground">How well predictions match reality</p>
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
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentTrend.slice().reverse().map((record) => (
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
                    <span className="text-sm">Community: {record.communityPrediction}%</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={record.actualOutcome === 1 ? 'destructive' : 'secondary'}>
                    {record.actualOutcome === 1 ? 'Snow Day' : 'School Open'}
                  </Badge>
                  <div className="text-sm text-muted-foreground">
                    M: {record.modelBrier.toFixed(3)} | C: {record.communityBrier.toFixed(3)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Weather API Debug Panel */}
      <WeatherDebugPanel />
    </div>
  )
}
