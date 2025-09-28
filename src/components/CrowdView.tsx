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
  username: string
  brierScore: number
  totalVotes: number
  accuracy: number
  streak: number
  badges: string[]
}

export function CrowdView() {
  const [communityVotes, setCommunityVotes] = useKV<CommunityVote[]>('community-votes', [])
  const [localStorageVotes, setLocalStorageVotes] = useState<CommunityVote[]>([])
  
  // Load votes from localStorage and sync with useKV
  useEffect(() => {
    const loadVotes = () => {
      try {
        const stored = localStorage.getItem('blizzard-community-votes')
        if (stored) {
          const parsed: CommunityVote[] = JSON.parse(stored)
          setLocalStorageVotes(parsed)
          
          // If useKV is empty but localStorage has votes, sync them
          if (parsed.length > 0 && (!communityVotes || communityVotes.length === 0)) {
            setCommunityVotes(parsed)
          }
        }
      } catch (error) {
        console.error('Error loading community votes:', error)
      }
    }

    loadVotes()
    
    // Poll for changes every 2 seconds to catch new votes from other tabs/components
    const interval = setInterval(loadVotes, 2000)
    
    return () => clearInterval(interval)
  }, [])

  // Use localStorage votes as primary source since they're more reliable
  const activeVotes = localStorageVotes.length > 0 ? localStorageVotes : communityVotes || []

  // Test function to add sample votes
  const addTestVotes = () => {
    const testVotes: CommunityVote[] = [
      { type: 'thumbs', value: 75, timestamp: Date.now() - 1000 },
      { type: 'probability', value: 60, timestamp: Date.now() - 2000 },
      { type: 'thumbs', value: 25, timestamp: Date.now() - 3000 }
    ]
    
    const updatedVotes = [...activeVotes, ...testVotes]
    setLocalStorageVotes(updatedVotes)
    setCommunityVotes(updatedVotes)
    localStorage.setItem('blizzard-community-votes', JSON.stringify(updatedVotes))
  }

  // Clear all votes
  const clearAllVotes = () => {
    setLocalStorageVotes([])
    setCommunityVotes([])
    localStorage.removeItem('blizzard-community-votes')
  }

  const [userStats] = useKV<UserStats[]>('user-stats', [
    {
      username: 'WeatherWiz',
      brierScore: 0.15,
      totalVotes: 45,
      accuracy: 78,
      streak: 7,
      badges: ['Hot Streak', 'Blizzard Caller']
    },
    {
      username: 'SnowDay_Sarah',
      brierScore: 0.18,
      totalVotes: 52,
      accuracy: 73,
      streak: 3,
      badges: ['Early Bird', 'Community Favorite']
    },
    {
      username: 'StormChaser21',
      brierScore: 0.22,
      totalVotes: 38,
      accuracy: 68,
      streak: 1,
      badges: ['Rookie of the Month']
    },
    {
      username: 'MeteoMike',
      brierScore: 0.25,
      totalVotes: 41,
      accuracy: 65,
      streak: 0,
      badges: ['Data Driven']
    }
  ])

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
              Community Consensus
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center space-y-2">
              <div className="text-4xl font-bold text-primary">{avgProbability}%</div>
              <p className="text-muted-foreground">Average prediction</p>
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
              Top Forecasters
            </CardTitle>
            <p className="text-sm text-muted-foreground">Ranked by Brier score (lower is better)</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {userStats?.map((user, index) => (
                <div key={user.username} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
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
                      <p className="font-medium truncate">{user.username}</p>
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
                      <div className="flex gap-1 mt-2">
                        {user.badges.map(badge => (
                          <Badge key={badge} variant="outline" className="text-xs">
                            {badge}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )) || []}
            </div>
          </CardContent>
        </Card>
      </div>

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