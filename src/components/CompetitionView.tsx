import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts'
import { 
  Trophy, Robot, Users, Target, TrendUp, Lightning, Snowflake, 
  Crown, Medal, ChartLine, Fire
} from '@phosphor-icons/react'
import { fetchOutcomeLedger, SnowDayOutcome } from '@/services/outcomes'

interface CompetitorStats {
  name: string
  totalPredictions: number
  correctPredictions: number
  accuracy: number
  brierScore: number
  avgError: number
  perfectCalls: number
  snowDayAccuracy: number
  schoolOpenAccuracy: number
}

interface HeadToHeadRecord {
  date: string
  blizzardPrediction: number
  rhsPrediction: number
  actual: boolean
  blizzardCorrect: boolean
  rhsCorrect: boolean
  blizzardError: number
  rhsError: number
}

const calculateCompetitorStats = (
  outcomes: SnowDayOutcome[], 
  getPrediction: (o: SnowDayOutcome) => number | null | undefined,
  name: string
): CompetitorStats => {
  const validOutcomes = outcomes.filter(o => {
    const pred = getPrediction(o)
    return typeof pred === 'number' && o.actualSnowDay !== null && o.actualSnowDay !== undefined && !o.noSchoolScheduled
  })

  if (validOutcomes.length === 0) {
    return {
      name,
      totalPredictions: 0,
      correctPredictions: 0,
      accuracy: 0,
      brierScore: 0,
      avgError: 0,
      perfectCalls: 0,
      snowDayAccuracy: 0,
      schoolOpenAccuracy: 0
    }
  }

  let correct = 0
  let perfectCalls = 0
  let totalBrier = 0
  let totalError = 0
  let snowDayCorrect = 0
  let snowDayTotal = 0
  let schoolOpenCorrect = 0
  let schoolOpenTotal = 0

  validOutcomes.forEach(o => {
    const pred = getPrediction(o)!
    const actual = o.actualSnowDay!
    const predBool = pred >= 50
    const actualNum = actual ? 1 : 0

    if (predBool === actual) correct++
    if ((pred >= 90 && actual) || (pred <= 10 && !actual)) perfectCalls++
    
    totalBrier += Math.pow(pred / 100 - actualNum, 2)
    totalError += Math.abs(pred - (actual ? 100 : 0))

    if (actual) {
      snowDayTotal++
      if (predBool) snowDayCorrect++
    } else {
      schoolOpenTotal++
      if (!predBool) schoolOpenCorrect++
    }
  })

  return {
    name,
    totalPredictions: validOutcomes.length,
    correctPredictions: correct,
    accuracy: Math.round((correct / validOutcomes.length) * 100),
    brierScore: Number((totalBrier / validOutcomes.length).toFixed(3)),
    avgError: Math.round(totalError / validOutcomes.length),
    perfectCalls,
    snowDayAccuracy: snowDayTotal > 0 ? Math.round((snowDayCorrect / snowDayTotal) * 100) : 0,
    schoolOpenAccuracy: schoolOpenTotal > 0 ? Math.round((schoolOpenCorrect / schoolOpenTotal) * 100) : 0
  }
}

export function CompetitionView() {
  const [outcomes, setOutcomes] = useState<SnowDayOutcome[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchOutcomeLedger({ bustCache: true })
        setOutcomes(data)
      } catch (err) {
        console.error('Failed to load outcomes:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const blizzardStats = useMemo(() => 
    calculateCompetitorStats(outcomes, o => o.modelProbability, 'Blizzard AI'),
    [outcomes]
  )

  const rhsStats = useMemo(() => 
    calculateCompetitorStats(outcomes, o => o.rhsPrediction, 'RHS Students'),
    [outcomes]
  )

  const headToHead = useMemo((): HeadToHeadRecord[] => {
    return outcomes
      .filter(o => 
        typeof o.modelProbability === 'number' && 
        typeof o.rhsPrediction === 'number' &&
        o.actualSnowDay !== null && 
        o.actualSnowDay !== undefined &&
        !o.noSchoolScheduled
      )
      .map(o => {
        const blizzard = o.modelProbability!
        const rhs = o.rhsPrediction!
        const actual = o.actualSnowDay!
        const actualNum = actual ? 100 : 0
        return {
          date: o.date,
          blizzardPrediction: blizzard,
          rhsPrediction: rhs,
          actual,
          blizzardCorrect: (blizzard >= 50) === actual,
          rhsCorrect: (rhs >= 50) === actual,
          blizzardError: Math.abs(blizzard - actualNum),
          rhsError: Math.abs(rhs - actualNum)
        }
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [outcomes])

  const leader = useMemo(() => {
    if (blizzardStats.accuracy > rhsStats.accuracy) return 'blizzard'
    if (rhsStats.accuracy > blizzardStats.accuracy) return 'rhs'
    // Tie-breaker: better Brier score
    if (blizzardStats.brierScore < rhsStats.brierScore) return 'blizzard'
    if (rhsStats.brierScore < blizzardStats.brierScore) return 'rhs'
    return 'tie'
  }, [blizzardStats, rhsStats])

  const winCounts = useMemo(() => {
    let blizzard = 0
    let rhs = 0
    let ties = 0
    headToHead.forEach(h => {
      if (h.blizzardError < h.rhsError) blizzard++
      else if (h.rhsError < h.blizzardError) rhs++
      else ties++
    })
    return { blizzard, rhs, ties }
  }, [headToHead])

  const radarData = useMemo(() => [
    { stat: 'Accuracy', Blizzard: blizzardStats.accuracy, RHS: rhsStats.accuracy },
    { stat: 'Snow Day Calls', Blizzard: blizzardStats.snowDayAccuracy, RHS: rhsStats.snowDayAccuracy },
    { stat: 'School Open Calls', Blizzard: blizzardStats.schoolOpenAccuracy, RHS: rhsStats.schoolOpenAccuracy },
    { stat: 'Confidence (inv. error)', Blizzard: Math.max(0, 100 - blizzardStats.avgError), RHS: Math.max(0, 100 - rhsStats.avgError) },
    { stat: 'Calibration', Blizzard: Math.max(0, 100 - blizzardStats.brierScore * 200), RHS: Math.max(0, 100 - rhsStats.brierScore * 200) },
  ], [blizzardStats, rhsStats])

  const trendData = useMemo(() => {
    let blizzardWins = 0
    let rhsWins = 0
    return headToHead.map(h => {
      if (h.blizzardError < h.rhsError) blizzardWins++
      else if (h.rhsError < h.blizzardError) rhsWins++
      return {
        date: h.date,
        blizzardWins,
        rhsWins,
        displayDate: new Date(h.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      }
    })
  }, [headToHead])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Loading competition data...</div>
      </div>
    )
  }

  const hasCompetitionData = headToHead.length > 0

  if (!hasCompetitionData) {
    return (
      <div className="space-y-6">
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Trophy size={64} className="mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-xl font-semibold mb-2">No Competition Data Yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Once you start logging outcomes with both Blizzard AI and RHS predictions, 
              the competition leaderboard will light up here!
            </p>
            <div className="flex items-center justify-center gap-8 mt-8">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Robot size={24} />
                <span>Blizzard AI</span>
              </div>
              <span className="text-2xl font-bold text-muted-foreground">vs</span>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users size={24} />
                <span>RHS Students</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8 relative z-10">
      {/* Hero Section - Current Leader */}
      <Card className={`relative overflow-hidden rounded-2xl border border-primary/10 bg-background/80 backdrop-blur shadow-lg shadow-primary/5 ${
        leader === 'blizzard' ? 'bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-background' :
        leader === 'rhs' ? 'bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-background' :
        'bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-background'
      }`}>
        <div className="absolute top-4 right-4">
          <Crown size={48} className={`${
            leader === 'blizzard' ? 'text-blue-500' :
            leader === 'rhs' ? 'text-orange-500' :
            'text-purple-500'
          }`} weight="fill" />
        </div>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-2xl">
            <Trophy size={28} weight="fill" className="text-yellow-500" />
            Competition Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-8">
            {/* Blizzard Side */}
            <div className={`p-6 rounded-xl border-2 transition-all ${
              leader === 'blizzard' ? 'border-blue-500 bg-blue-500/5 ring-2 ring-blue-500/20' : 'border-border'
            }`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-3 rounded-full ${leader === 'blizzard' ? 'bg-blue-500/20' : 'bg-muted'}`}>
                  <Robot size={32} weight="duotone" className={leader === 'blizzard' ? 'text-blue-500' : 'text-muted-foreground'} />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Blizzard AI</h3>
                  <p className="text-sm text-muted-foreground">Machine Learning Model</p>
                </div>
                {leader === 'blizzard' && (
                  <Badge className="ml-auto bg-blue-500">
                    <Crown size={14} className="mr-1" weight="fill" />
                    Leader
                  </Badge>
                )}
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-muted-foreground">Accuracy</span>
                    <span className="text-2xl font-bold">{blizzardStats.accuracy}%</span>
                  </div>
                  <Progress value={blizzardStats.accuracy} className="h-3" />
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Brier Score</span>
                    <p className="font-semibold">{blizzardStats.brierScore}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Avg Error</span>
                    <p className="font-semibold">{blizzardStats.avgError}%</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Predictions</span>
                    <p className="font-semibold">{blizzardStats.totalPredictions}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Perfect Calls</span>
                    <p className="font-semibold">{blizzardStats.perfectCalls}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* RHS Side */}
            <div className={`p-6 rounded-xl border-2 transition-all ${
              leader === 'rhs' ? 'border-orange-500 bg-orange-500/5 ring-2 ring-orange-500/20' : 'border-border'
            }`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-3 rounded-full ${leader === 'rhs' ? 'bg-orange-500/20' : 'bg-muted'}`}>
                  <Users size={32} weight="duotone" className={leader === 'rhs' ? 'text-orange-500' : 'text-muted-foreground'} />
                </div>
                <div>
                  <h3 className="text-xl font-bold">RHS Students</h3>
                  <p className="text-sm text-muted-foreground">Rockford High School</p>
                </div>
                {leader === 'rhs' && (
                  <Badge className="ml-auto bg-orange-500">
                    <Crown size={14} className="mr-1" weight="fill" />
                    Leader
                  </Badge>
                )}
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-muted-foreground">Accuracy</span>
                    <span className="text-2xl font-bold">{rhsStats.accuracy}%</span>
                  </div>
                  <Progress value={rhsStats.accuracy} className="h-3" />
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Brier Score</span>
                    <p className="font-semibold">{rhsStats.brierScore}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Avg Error</span>
                    <p className="font-semibold">{rhsStats.avgError}%</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Predictions</span>
                    <p className="font-semibold">{rhsStats.totalPredictions}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Perfect Calls</span>
                    <p className="font-semibold">{rhsStats.perfectCalls}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Head-to-Head Summary */}
          <div className="mt-8 p-4 rounded-lg bg-muted/50">
            <div className="flex items-center justify-center gap-8">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-500">{winCounts.blizzard}</div>
                <div className="text-sm text-muted-foreground">Blizzard Wins</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-muted-foreground">{winCounts.ties}</div>
                <div className="text-sm text-muted-foreground">Ties</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-500">{winCounts.rhs}</div>
                <div className="text-sm text-muted-foreground">RHS Wins</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Radar Chart - Skills Comparison */}
        <Card className="rounded-2xl border border-primary/10 bg-background/80 backdrop-blur shadow-lg shadow-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target size={20} className="text-primary" />
              Skills Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="stat" tick={{ fontSize: 12 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Radar
                    name="Blizzard AI"
                    dataKey="Blizzard"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                  <Radar
                    name="RHS Students"
                    dataKey="RHS"
                    stroke="#f97316"
                    fill="#f97316"
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Win Trend Over Time */}
        <Card className="rounded-2xl border border-primary/10 bg-background/80 backdrop-blur shadow-lg shadow-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendUp size={20} className="text-primary" />
              Cumulative Wins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="displayDate" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="blizzardWins" 
                    name="Blizzard AI" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    dot={{ fill: '#3b82f6' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="rhsWins" 
                    name="RHS Students" 
                    stroke="#f97316" 
                    strokeWidth={3}
                    dot={{ fill: '#f97316' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Head-to-Head History */}
      <Card className="rounded-2xl border border-primary/10 bg-background/80 backdrop-blur shadow-lg shadow-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightning size={20} weight="fill" className="text-primary" />
            Head-to-Head Matchups
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Every prediction where both competitors made a call
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {headToHead.slice().reverse().map((match, idx) => (
              <div 
                key={match.date} 
                className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-card/80 shadow-sm hover:bg-card transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="text-center min-w-[80px]">
                    <div className="text-sm font-medium">
                      {new Date(match.date).toLocaleDateString(undefined, { 
                        weekday: 'short', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </div>
                    <Badge variant={match.actual ? 'destructive' : 'secondary'} className="mt-1">
                      <Snowflake size={12} className="mr-1" />
                      {match.actual ? 'Snow Day' : 'School'}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {/* Blizzard */}
                  <div className={`text-center p-3 rounded-lg min-w-[100px] ${
                    match.blizzardError < match.rhsError ? 'bg-blue-500/10 ring-2 ring-blue-500/30' : ''
                  }`}>
                    <div className="text-xs text-muted-foreground mb-1">Blizzard</div>
                    <div className="text-lg font-bold">{match.blizzardPrediction}%</div>
                    <div className={`text-xs ${match.blizzardCorrect ? 'text-green-500' : 'text-red-500'}`}>
                      {match.blizzardCorrect ? '✓ Correct' : '✗ Wrong'}
                    </div>
                    {match.blizzardError < match.rhsError && (
                      <Medal size={16} className="mx-auto mt-1 text-blue-500" weight="fill" />
                    )}
                  </div>

                  <span className="text-muted-foreground font-bold">vs</span>

                  {/* RHS */}
                  <div className={`text-center p-3 rounded-lg min-w-[100px] ${
                    match.rhsError < match.blizzardError ? 'bg-orange-500/10 ring-2 ring-orange-500/30' : ''
                  }`}>
                    <div className="text-xs text-muted-foreground mb-1">RHS</div>
                    <div className="text-lg font-bold">{match.rhsPrediction}%</div>
                    <div className={`text-xs ${match.rhsCorrect ? 'text-green-500' : 'text-red-500'}`}>
                      {match.rhsCorrect ? '✓ Correct' : '✗ Wrong'}
                    </div>
                    {match.rhsError < match.blizzardError && (
                      <Medal size={16} className="mx-auto mt-1 text-orange-500" weight="fill" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Fun Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border border-primary/10 bg-background/80 backdrop-blur shadow-lg shadow-primary/5">
          <CardContent className="pt-6 text-center">
            <Fire size={32} className="mx-auto mb-2 text-red-500" weight="fill" />
            <div className="text-2xl font-bold">{headToHead.length}</div>
            <div className="text-sm text-muted-foreground">Total Matchups</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-primary/10 bg-background/80 backdrop-blur shadow-lg shadow-primary/5">
          <CardContent className="pt-6 text-center">
            <ChartLine size={32} className="mx-auto mb-2 text-blue-500" />
            <div className="text-2xl font-bold">
              {Math.abs(blizzardStats.accuracy - rhsStats.accuracy)}%
            </div>
            <div className="text-sm text-muted-foreground">Accuracy Gap</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-primary/10 bg-background/80 backdrop-blur shadow-lg shadow-primary/5">
          <CardContent className="pt-6 text-center">
            <Snowflake size={32} className="mx-auto mb-2 text-cyan-500" weight="fill" />
            <div className="text-2xl font-bold">
              {headToHead.filter(h => h.actual).length}
            </div>
            <div className="text-sm text-muted-foreground">Snow Days Predicted</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-primary/10 bg-background/80 backdrop-blur shadow-lg shadow-primary/5">
          <CardContent className="pt-6 text-center">
            <Trophy size={32} className="mx-auto mb-2 text-yellow-500" weight="fill" />
            <div className="text-2xl font-bold">
              {leader === 'blizzard' ? 'AI' : leader === 'rhs' ? 'RHS' : 'Tied'}
            </div>
            <div className="text-sm text-muted-foreground">Current Champion</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
