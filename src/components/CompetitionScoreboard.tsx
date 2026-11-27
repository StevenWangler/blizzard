import type { CompetitionStandings } from '@/hooks/useCompetitionStandings'
import { Trophy, ArrowRight } from '@phosphor-icons/react'

export function CompetitionScoreboard({ standings, compact = false }: { standings: CompetitionStandings; compact?: boolean }) {
  const { wins, headToHead, status } = standings
  const scored = status === 'ready' && headToHead.length > 0
  const margin = Math.abs(wins.blizzard - wins.rhs)
  const leader = wins.blizzard > wins.rhs ? 'Blizzard' : 'RHS'
  const headline = margin === 0 ? 'Blizzard and RHS are tied' : `${leader} leads by ${margin} ${margin === 1 ? 'win' : 'wins'}`
  const tieCount = wins.ties === 1 ? '1 tie' : `${wins.ties} ties`
  const group = <div className="faceoff-board" data-compact={compact}>
    <div className="faceoff-banner"><Trophy weight="fill" aria-hidden="true" />
      <span>{compact ? 'Forecast face-off' : scored ? headline : 'Head-to-head standings'}</span>
      {compact && <ArrowRight aria-hidden="true" />}
    </div>
    {compact && scored && <div className="faceoff-compact-lead">{headline}</div>}
    <div className="faceoff-teams">
      <div><span>Blizzard AI</span><strong aria-label={scored ? wins.blizzard + ' wins' : undefined}>{scored ? wins.blizzard : '–'}</strong></div>
      <span className="faceoff-vs">vs</span>
      <div><span>RHS Stats</span><strong aria-label={scored ? wins.rhs + ' wins' : undefined}>{scored ? wins.rhs : '–'}</strong></div>
    </div>
    <div className="faceoff-caption">{status === 'loading' ? 'Loading standings…' : status === 'error' ? 'Standings unavailable' : scored
      ? `${headToHead.length} all-time ${headToHead.length === 1 ? 'matchup' : 'matchups'} · ${tieCount}` : 'Awaiting the first scored matchup'}</div>
  </div>
  return compact ? <a className="faceoff-link" href="#competition">{group}</a> : group
}
