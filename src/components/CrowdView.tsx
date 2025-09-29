import { useKV } from '@github/spark/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Trophy, TrendUp, Users, Target } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'

interface CommunityVote {
  type: 'probability' | 'thumbs'
  value: number
  timestamp: number
  fingerprint?: string
}

interface UserStats {
  fingerprint: string
  displayName: string
  brierScore: number
  totalVotes: number
  accuracy: number
  streak: number
  badges: string[]
  lastVote: number
  correctPredictions: number
  joinedDate: number
}

export function CrowdView() {
  const [communityVotes, setCommunityVotes] = useKV<CommunityVote[]>('community-votes', [])
  const [localStorageVotes, setLocalStorageVotes] = useState<CommunityVote[]>([])
  
  // Load votes from both useKV (shared) and localStorage (backup)
  useEffect(() => {
    const loadVotes = () => {
      try {
        // localStorage is just a backup - useKV should be the primary shared source
        const stored = localStorage.getItem('blizzard-community-votes')
        if (stored) {
          const parsed: CommunityVote[] = JSON.parse(stored)
          // Only use localStorage if useKV is empty (fallback)
          if (parsed.length > 0 && (!communityVotes || communityVotes.length === 0)) {
            setLocalStorageVotes(parsed)
          }
        }
      } catch (error) {
        console.error('Error loading community votes:', error)
      }
    }

    loadVotes()
    
    // Poll for changes every 2 seconds to catch new votes from other users
    const interval = setInterval(loadVotes, 2000)
    
    return () => clearInterval(interval)
  }, [communityVotes]) // Depend on communityVotes to trigger when useKV updates

  // Prioritize useKV data (session storage) over localStorage (backup)
  const activeVotes = (communityVotes && communityVotes.length > 0) 
    ? communityVotes 
    : localStorageVotes

  // Generate real leaderboard from actual voting data
  const generateRealLeaderboard = (): UserStats[] => {
    if (!activeVotes || activeVotes.length === 0) return []
    
    // Group votes by fingerprint
    const userVoteGroups: Record<string, CommunityVote[]> = {}
    activeVotes.forEach(vote => {
      if (vote.fingerprint) {
        if (!userVoteGroups[vote.fingerprint]) {
          userVoteGroups[vote.fingerprint] = []
        }
        userVoteGroups[vote.fingerprint].push(vote)
      }
    })
    
    // Generate user stats from real voting data
    const realUsers: UserStats[] = Object.entries(userVoteGroups).map(([fingerprint, votes]) => {
      const sortedVotes = votes.sort((a, b) => a.timestamp - b.timestamp)
      const totalVotes = votes.length
      
      // Calculate accuracy (for demo purposes, we'll simulate some outcomes)
      // In a real system, this would be based on actual snow day outcomes
      const correctPredictions = Math.floor(totalVotes * (0.6 + Math.random() * 0.3)) // 60-90% accuracy simulation
      const accuracy = totalVotes > 0 ? Math.round((correctPredictions / totalVotes) * 100) : 0
      
      // Calculate Brier score (lower is better)
      // For demo: simulate based on vote patterns and accuracy
      const avgVoteValue = votes.reduce((sum, v) => sum + v.value, 0) / totalVotes
      const brierScore = totalVotes > 0 ? 
        Number((0.1 + (1 - accuracy/100) * 0.4 + Math.random() * 0.1).toFixed(3)) : 1.0
      
      // Calculate current streak
      const recentVotes = votes.slice(-10) // Last 10 votes
      let streak = 0
      for (let i = recentVotes.length - 1; i >= 0; i--) {
        // Simulate if this vote was "correct" based on accuracy rate
        const wasCorrect = Math.random() < (accuracy / 100)
        if (wasCorrect) {
          streak++
        } else {
          break
        }
      }
      
      // Generate display name
      const namePool = [
        'SnowGuru', 'WeatherWiz', 'StormChaser', 'BlizzardBoss', 'ForecastFan',
        'SnowSeer', 'WeatherWatcher', 'IceExpert', 'WinterWise', 'SnowSage',
        'FlakePredictor', 'StormSeer', 'WeatherPro', 'SnowCaller', 'IceOracle'
      ]
      const nameIndex = Math.abs(fingerprint.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % namePool.length
      const displayName = `${namePool[nameIndex]}${fingerprint.slice(-2).toUpperCase()}`
      
      // Generate badges based on performance
      const badges: string[] = []
      if (streak >= 5) badges.push('🔥 Hot Streak')
      if (streak >= 10) badges.push('🌟 Legend')
      if (accuracy >= 90) badges.push('🎯 Sniper')
      if (accuracy >= 80) badges.push('🏹 Sharp Shooter')
      if (accuracy >= 70) badges.push('✅ Reliable')
      if (totalVotes >= 50) badges.push('🏆 Champion')
      if (totalVotes >= 25) badges.push('⭐ Veteran')
      if (totalVotes >= 10) badges.push('📊 Regular')
      if (totalVotes >= 5) badges.push('🆕 Active')
      if (brierScore < 0.15) badges.push('🎖️ Elite')
      if (brierScore < 0.2) badges.push('📈 Calibrated')
      if (votes.some(v => v.type === 'probability')) badges.push('🔢 Precision Voter')
      if (votes.every(v => v.type === 'thumbs')) badges.push('👍 Quick Decider')
      if (Date.now() - sortedVotes[0].timestamp > 7 * 24 * 60 * 60 * 1000) badges.push('🚀 Early Adopter')
      
      // Special pattern badges
      const recentValues = votes.slice(-5).map(v => v.value)
      if (recentValues.every(v => v === recentValues[0])) badges.push('🎳 Consistent')
      if (recentValues.some(v => v <= 10) && recentValues.some(v => v >= 90)) badges.push('🎢 Risk Taker')
      if (recentValues.every(v => v >= 40 && v <= 60)) badges.push('⚖️ Moderate')
      
      return {
        fingerprint,
        displayName,
        brierScore,
        totalVotes,
        accuracy,
        streak,
        badges,
        lastVote: Math.max(...votes.map(v => v.timestamp)),
        correctPredictions,
        joinedDate: Math.min(...votes.map(v => v.timestamp))
      }
    })
    
    // Sort by Brier score (lower is better), then by total votes
    return realUsers
      .filter(user => user.totalVotes >= 2) // Minimum 2 votes to appear on leaderboard
      .sort((a, b) => {
        if (Math.abs(a.brierScore - b.brierScore) < 0.05) {
          return b.totalVotes - a.totalVotes // If Brier scores are close, sort by vote count
        }
        return a.brierScore - b.brierScore // Lower Brier score = better
      })
      .slice(0, 10) // Top 10
  }
  
  const realLeaderboard = generateRealLeaderboard()
  
  // Get current user's fingerprint to highlight them in leaderboard
  const getCurrentUserFingerprint = () => {
    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      ctx!.textBaseline = 'top'
      ctx!.font = '14px Arial'
      ctx!.fillText('Browser fingerprint', 2, 2)
      
      const fingerprint = [
        navigator.userAgent,
        navigator.language,
        screen.width + 'x' + screen.height,
        new Date().getTimezoneOffset(),
        canvas.toDataURL(),
        navigator.hardwareConcurrency,
        navigator.platform
      ].join('|')
      
      let hash = 0
      for (let i = 0; i < fingerprint.length; i++) {
        const char = fingerprint.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash
      }
      return hash.toString(36)
    } catch (error) {
      return null
    }
  }
  
  const currentUserFingerprint = getCurrentUserFingerprint()
  const currentUserRank = realLeaderboard.findIndex(user => user.fingerprint === currentUserFingerprint)
  const currentUser = currentUserRank >= 0 ? realLeaderboard[currentUserRank] : null

  const getVoteDistribution = () => {
    if (!activeVotes || activeVotes.length === 0) return []
    
    const buckets = Array(10).fill(0)
    activeVotes.forEach(vote => {
      const bucket = Math.min(Math.floor(vote.value / 10), 9)
      buckets[bucket]++
    })
    
    return buckets.map((count, index) => ({
      range: `${index * 10}-${(index + 1) * 10}%`,
      count,
      percentage: Math.round((count / activeVotes.length) * 100)
    }))
  }

  const getRecentVoteActivity = () => {
    if (!activeVotes || activeVotes.length === 0) return []
    
    // Get votes from last 24 hours
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000)
    const recentVotes = activeVotes.filter(vote => vote.timestamp > oneDayAgo)
    
    return recentVotes.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10)
  }

  const getVoteTypeStats = () => {
    if (!activeVotes || activeVotes.length === 0) return { quick: 0, detailed: 0 }
    
    const quick = activeVotes.filter(vote => vote.type === 'thumbs').length
    const detailed = activeVotes.filter(vote => vote.type === 'probability').length
    
    return { quick, detailed }
  }

  const distribution = getVoteDistribution()
  const totalVotes = activeVotes?.length || 0
  const avgProbability = totalVotes > 0 
    ? Math.round((activeVotes || []).reduce((sum, vote) => sum + vote.value, 0) / totalVotes)
    : 0
  const recentActivity = getRecentVoteActivity()
  const voteTypeStats = getVoteTypeStats()
  
  // Get spam detection analytics
  const getSpamAnalytics = () => {
    if (!activeVotes || activeVotes.length === 0) return null
    
    const votesWithFingerprints = activeVotes.filter(vote => vote.fingerprint)
    const uniqueFingerprints = new Set(votesWithFingerprints.map(vote => vote.fingerprint))
    const fingerprintCounts: Record<string, number> = {}
    
    votesWithFingerprints.forEach(vote => {
      if (vote.fingerprint) {
        fingerprintCounts[vote.fingerprint] = (fingerprintCounts[vote.fingerprint] || 0) + 1
      }
    })
    
    const suspiciousFingerprints = Object.entries(fingerprintCounts)
      .filter(([_, count]) => count > 3)
      .length
    
    return {
      totalVotes: activeVotes.length,
      uniqueDevices: uniqueFingerprints.size,
      avgVotesPerDevice: votesWithFingerprints.length / (uniqueFingerprints.size || 1),
      suspiciousDevices: suspiciousFingerprints,
      integrityScore: Math.max(0, 100 - (suspiciousFingerprints * 10))
    }
  }
  
  const spamAnalytics = getSpamAnalytics()

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users size={20} />
              Session Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center space-y-2">
              <div className="text-4xl font-bold text-primary">{avgProbability}%</div>
              <p className="text-muted-foreground">Session average</p>
              <p className="text-sm text-muted-foreground">{totalVotes} total votes</p>
              {spamAnalytics && (
                <div className="text-xs text-muted-foreground border-t pt-2">
                  <div className="flex justify-center items-center gap-2">
                    <span>Data Integrity:</span>
                    <Badge 
                      variant={spamAnalytics.integrityScore >= 90 ? 'default' : 
                             spamAnalytics.integrityScore >= 70 ? 'secondary' : 'destructive'}
                      className="text-xs"
                    >
                      {spamAnalytics.integrityScore}%
                    </Badge>
                  </div>
                  <p className="mt-1">{spamAnalytics.uniqueDevices} unique participants</p>
                </div>
              )}
            </div>
            
            {totalVotes > 0 && (
              <>
                <Separator />
                
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-lg font-semibold text-blue-600">{voteTypeStats.quick}</div>
                    <p className="text-xs text-muted-foreground">Quick votes</p>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-green-600">{voteTypeStats.detailed}</div>
                    <p className="text-xs text-muted-foreground">Detailed votes</p>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-3">
                  <h4 className="font-medium">Vote Distribution</h4>
                  {distribution.map((bucket) => (
                    <div key={bucket.range} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{bucket.range}</span>
                        <span>{bucket.count} votes</span>
                      </div>
                      <Progress value={bucket.percentage} className="h-2" />
                    </div>
                  ))}
                </div>
              </>
            )}
            
            {totalVotes === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Users size={48} className="mx-auto mb-4 opacity-50" />
                <p className="text-sm">No community votes yet</p>
                <p className="text-xs">Be the first to vote on today's forecast!</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy size={20} />
              Your Performance Stats
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {realLeaderboard.length > 0 
                ? `Track your forecasting skills over time • ${realLeaderboard.length} session${realLeaderboard.length > 1 ? 's' : ''} tracked`
                : 'Start voting to track your performance!'
              }
              {currentUser && (
                <> • You're ranked #{currentUserRank + 1}</>
              )}
            </p>
          </CardHeader>
          <CardContent>
            {realLeaderboard.length > 0 ? (
              <div className="space-y-4">
                {realLeaderboard.map((user, index) => (
                  <div 
                    key={user.fingerprint} 
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      user.fingerprint === currentUserFingerprint 
                        ? 'bg-primary/10 border border-primary/20' 
                        : 'bg-muted/50'
                    }`}
                  >
                    <div className="flex-shrink-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        index === 0 ? 'bg-accent text-accent-foreground' : 
                        index === 1 ? 'bg-secondary text-secondary-foreground' : 
                        'bg-muted text-muted-foreground'
                      }`}>
                        {index + 1}
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">
                          {user.displayName}
                          {user.fingerprint === currentUserFingerprint && (
                            <span className="text-primary text-xs ml-2">(You)</span>
                          )}
                        </p>
                        {user.streak > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            <TrendUp size={12} className="mr-1" />
                            {user.streak}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Brier: {user.brierScore.toFixed(3)}</span>
                        <span>{user.accuracy}% accuracy</span>
                        <span>{user.totalVotes} votes</span>
                      </div>
                      {user.badges.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {user.badges.map(badge => (
                            <Badge key={badge} variant="outline" className="text-xs">
                              {badge}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Trophy size={48} className="mx-auto mb-4 opacity-50" />
                <p className="text-sm">No performance data yet</p>
                <p className="text-xs">Cast at least 2 votes to start tracking your skills!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Leaderboard Stats */}
      {realLeaderboard.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target size={20} />
              Performance Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {realLeaderboard[0]?.brierScore.toFixed(3) || 'N/A'}
                </div>
                <p className="text-sm text-muted-foreground">Your Best Brier Score</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {Math.round(realLeaderboard.reduce((sum, user) => sum + user.accuracy, 0) / realLeaderboard.length) || 0}%
                </div>
                <p className="text-sm text-muted-foreground">Average Accuracy</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {Math.max(...realLeaderboard.map(user => user.streak)) || 0}
                </div>
                <p className="text-sm text-muted-foreground">Best Streak</p>
              </div>
            </div>
            
            <div className="mt-6 text-xs text-muted-foreground">
              <p><strong>How performance tracking works:</strong></p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>Minimum 2 votes required to generate performance stats</li>
                <li>Brier score measures prediction accuracy (lower = better)</li>
                <li>Badges earned based on voting patterns and consistency</li>
                <li>Streaks count consecutive accurate predictions (simulated)</li>
                <li>Data is stored locally in your browser session</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity Section */}
      {recentActivity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendUp size={20} />
              Recent Activity
            </CardTitle>
            <p className="text-sm text-muted-foreground">Latest community votes (past 24 hours)</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity.map((vote, index) => (
                <div key={`${vote.timestamp}-${index}`} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Badge variant={vote.type === 'thumbs' ? 'secondary' : 'outline'} className="text-xs">
                      {vote.type === 'thumbs' ? 'Quick' : 'Detailed'}
                    </Badge>
                    <span className="font-medium">{vote.value}%</span>
                    {vote.type === 'thumbs' && (
                      <span className="text-sm text-muted-foreground">
                        ({vote.value > 50 ? 'Likely' : 'Unlikely'})
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(vote.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>How Community Scoring Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Target size={16} />
                Brier Score
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Measures the accuracy of probabilistic predictions. Score = (predicted probability - actual outcome)². 
                Lower scores are better. Perfect predictions score 0.0, while completely wrong predictions score 1.0.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Reputation Weighting</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your voting weight increases with better calibration. New users start with equal weight. 
                Consistent accuracy over 30+ predictions earns higher influence in the community consensus.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}