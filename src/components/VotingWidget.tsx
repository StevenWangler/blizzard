import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { ThumbsUp, ThumbsDown } from '@phosphor-icons/react'
import { useState } from 'react'

interface Vote {
  type: 'probability' | 'thumbs'
  value: number
}

interface VotingWidgetProps {
  onVote: (vote: Vote) => void
  userVote: Vote | null
  disabled: boolean
  voteStatus?: {
    canVote: boolean
    votesToday: number
    maxVotes?: number
    timeUntilReset?: number | null
  }
}

export function VotingWidget({ onVote, userVote, disabled, voteStatus }: VotingWidgetProps) {
  const [voteMode, setVoteMode] = useState<'quick' | 'advanced'>('quick')
  const [probability, setProbability] = useState('')

  const handleQuickVote = (likely: boolean) => {
    const vote = {
      type: 'thumbs' as const,
      value: likely ? 75 : 25
    }
    onVote(vote)
  }

  const handleProbabilityVote = () => {
    const value = parseInt(probability)
    if (value >= 0 && value <= 100) {
      const vote = {
        type: 'probability' as const,
        value
      }
      onVote(vote)
    }
  }

  if (disabled && userVote) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg sm:text-xl">Your Vote</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-3 sm:space-y-4">
            <div className="text-xl sm:text-2xl font-bold text-primary">
              {userVote.value}%
            </div>
            <p className="text-muted-foreground text-sm sm:text-base">
              {userVote.type === 'thumbs' 
                ? (userVote.value > 50 ? 'You think it\'s likely!' : 'You think it\'s unlikely.')
                : 'Your probability estimate'
              }
            </p>
            {voteStatus && (
              <div className="text-xs text-muted-foreground border-t pt-2">
                <p>Daily votes: {voteStatus.votesToday}/{voteStatus.maxVotes || 3}</p>
                {!voteStatus.canVote && voteStatus.timeUntilReset && (
                  <p>Resets in {Math.ceil(voteStatus.timeUntilReset / (1000 * 60 * 60))} hours</p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg sm:text-xl">Cast Your Vote</CardTitle>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Help improve the community forecast
        </p>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4">
        {voteStatus && (
          <div className="text-center text-xs text-muted-foreground mb-4">
            Daily votes: {voteStatus.votesToday}/{voteStatus.maxVotes || 3}
            {!voteStatus.canVote && voteStatus.timeUntilReset && (
              <> • Resets in {Math.ceil(voteStatus.timeUntilReset / (1000 * 60 * 60))} hours</>
            )}
          </div>
        )}
        
        <div className="flex gap-2">
          <Button 
            variant={voteMode === 'quick' ? 'default' : 'outline'}
            onClick={() => setVoteMode('quick')}
            className="flex-1 text-xs sm:text-sm"
            size="sm"
          >
            Quick Vote
          </Button>
          <Button 
            variant={voteMode === 'advanced' ? 'default' : 'outline'}
            onClick={() => setVoteMode('advanced')}
            className="flex-1 text-xs sm:text-sm"
            size="sm"
          >
            Probability
          </Button>
        </div>

        <Separator />

        {voteMode === 'quick' ? (
          <div className="space-y-3 sm:space-y-4">
            <p className="text-xs sm:text-sm text-muted-foreground text-center">
              Do you think school will be closed tomorrow?
            </p>
            <div className="grid grid-cols-2 gap-2 sm:gap-4">
              <Button 
                onClick={() => handleQuickVote(true)}
                className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 h-12 sm:h-16 bg-accent hover:bg-accent/80 text-xs sm:text-sm"
                disabled={disabled || (voteStatus && !voteStatus.canVote)}
              >
                <ThumbsUp size={18} className="sm:w-6 sm:h-6" />
                Likely
              </Button>
              <Button 
                onClick={() => handleQuickVote(false)}
                variant="outline"
                className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 h-12 sm:h-16 text-xs sm:text-sm"
                disabled={disabled || (voteStatus && !voteStatus.canVote)}
              >
                <ThumbsDown size={18} className="sm:w-6 sm:h-6" />
                Unlikely
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            <div>
              <label className="text-xs sm:text-sm font-medium">
                Enter probability (0-100%)
              </label>
              <div className="flex gap-2 mt-2">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={probability}
                  onChange={(e) => setProbability(e.target.value)}
                  placeholder="50"
                  disabled={disabled || (voteStatus && !voteStatus.canVote)}
                  className="text-sm"
                />
                <Button 
                  onClick={handleProbabilityVote}
                  disabled={disabled || !probability || parseInt(probability) < 0 || parseInt(probability) > 100 || (voteStatus && !voteStatus.canVote)}
                  size="sm"
                  className="text-xs sm:text-sm"
                >
                  Vote
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}