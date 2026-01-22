import { useEffect, useMemo, useState, type ComponentType } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Markdown } from '@/components/ui/markdown'
import {
  CloudSnow,
  Books,
  ShieldCheck,
  CirclesThreePlus,
  Sparkle,
  Newspaper,
  Truck,
  Lightning,
  ChatTeardropDots,
  ArrowsClockwise,
  CheckCircle,
  WarningCircle,
  TrendUp,
  TrendDown,
  Minus
} from '@phosphor-icons/react'
import type { IconProps } from '@phosphor-icons/react'
import type { AgentPrediction, AgentCollaboration, CollaborationRound, DebatePosition } from '@/types/agentPrediction'
import { fetchData } from '@/lib/dataPath'

const CONFIDENCE_LABELS: Record<AgentPrediction['final']['confidence_level'], string> = {
  very_low: 'Very Low',
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  very_high: 'Very High'
}

type AgentId = 'meteorology' | 'history' | 'safety' | 'news' | 'infrastructure' | 'powerGrid' | 'final'

type AgentProfile = {
  id: AgentId
  name: string
  title: string
  mission: string
  focusAreas: string[]
  tools: string[]
  deliverables: string[]
  model: string
  tone: string
  icon: ComponentType<IconProps>
  gradient: string
}

type AgentInsight = {
  headline: string
  summary: string
  callouts?: Array<{ label: string; value: string }>
}

type WorkflowStep = {
  title: string
  description: string
  handoff: string
  icon: ComponentType<IconProps>
}

const agentProfiles: AgentProfile[] = [
  {
    id: 'meteorology',
    name: 'Chief Meteorologist',
    title: 'Atmospheric Signal Hunter',
    mission: 'Blends live radar, model guidance, and alert feeds into a clean snapshot for the rest of the crew.',
    focusAreas: ['Temperature structure', 'Precip type & timing', 'Wind + visibility'],
    tools: ['get_weather_data', 'web_search'],
    deliverables: ['Quantitative weather analysis', 'Alert digest', 'Overnight vs. morning breakdowns'],
    model: 'gpt-5.2',
    tone: 'Technical + precise',
    icon: CloudSnow,
    gradient: 'from-sky-500/30 via-blue-400/15 to-transparent'
  },
  {
    id: 'history',
    name: 'Weather Pattern Historian',
    title: 'Context Archivist',
    mission: 'Finds the closest historical analogs, seasonal oddities, and local quirks that bend the odds.',
    focusAreas: ['Analog events', 'Seasonal norms', 'Microclimate flags'],
    tools: ['web_search'],
    deliverables: ['Historical hit rate', 'Seasonal adjustment', 'Confidence commentary'],
    model: 'gpt-5.2',
    tone: 'Story-driven + data-backed',
    icon: Books,
    gradient: 'from-amber-500/30 via-orange-400/15 to-transparent'
  },
  {
    id: 'safety',
    name: 'Transportation Safety Analyst',
    title: 'Mobility Risk Forecaster',
    mission: 'Scores roads, sidewalks, and bus routes so the threat to travelers is crystal clear.',
    focusAreas: ['Road surface risk', 'Commute timing', 'Emergency access'],
    tools: ['get_weather_data', 'web_search'],
    deliverables: ['Roadway scorecard', 'Safety recommendations', 'Impact timeline'],
    model: 'gpt-5.2',
    tone: 'Direct + pragmatic',
    icon: ShieldCheck,
    gradient: 'from-emerald-500/30 via-teal-400/15 to-transparent'
  },
  {
    id: 'news',
    name: 'Local News Intelligence',
    title: 'Community Signal Scanner',
    mission: 'Scours local news, social media, and community chatter for real-time signals that could tip the scales.',
    focusAreas: ['Local news', 'Social signals', 'District announcements'],
    tools: ['web_search'],
    deliverables: ['News digest', 'Community sentiment', 'Neighboring district closures'],
    model: 'gpt-5.2',
    tone: 'Investigative + thorough',
    icon: Newspaper,
    gradient: 'from-rose-500/30 via-red-400/15 to-transparent'
  },
  {
    id: 'infrastructure',
    name: 'Regional Infrastructure Monitor',
    title: 'Road Ops Ground Truth',
    mission: 'Tracks real-time plow fleet status, MDOT conditions, and county road clearing progress to validate whether roads will actually be passable.',
    focusAreas: ['Plow operations', 'Road clearing timeline', 'Salt/sand resources'],
    tools: ['web_search'],
    deliverables: ['Road clearing status by type', 'Municipal response level', 'Hours-to-clear estimates'],
    model: 'gpt-5.2',
    tone: 'Operational + time-sensitive',
    icon: Truck,
    gradient: 'from-yellow-500/30 via-amber-400/15 to-transparent'
  },
  {
    id: 'powerGrid',
    name: 'Power Grid Analyst',
    title: 'Utility Status Watchdog',
    mission: 'Monitors power outages, grid stress, and utility restoration timelines that could force closures regardless of road conditions.',
    focusAreas: ['Outage tracking', 'Grid stress', 'School facility power'],
    tools: ['web_search'],
    deliverables: ['Outage counts & trends', 'Restoration estimates', 'School-specific risk assessment'],
    model: 'gpt-5.2',
    tone: 'Alert-driven + risk-focused',
    icon: Lightning,
    gradient: 'from-cyan-500/30 via-blue-400/15 to-transparent'
  },
  {
    id: 'final',
    name: 'Decision Coordinator',
    title: 'Consensus Builder',
    mission: 'Synthesizes every specialist note into a confident call, recommendations, and next check-in time.',
    focusAreas: ['Probability modeling', 'Stakeholder guidance', 'Scenario planning'],
    tools: ['Structured agent briefs'],
    deliverables: ['Snow day probability', 'Decision rationale', 'Next evaluation timing'],
    model: 'gpt-5.2',
    tone: 'Calm + actionable',
    icon: CirclesThreePlus,
    gradient: 'from-purple-500/30 via-fuchsia-400/15 to-transparent'
  }
]

const workflowSteps: WorkflowStep[] = [
  {
    title: 'Scan & structure the atmosphere',
    description: 'The Chief Meteorologist queries the weather API, parses alerts, and normalizes wind/precip timelines.',
    handoff: 'Outputs a structured meteorology brief + alert digest.',
    icon: CloudSnow
  },
  {
    title: 'Compare with living history',
    description: 'The Historian combs through analog events and seasonal stats to nudge probabilities up or down.',
    handoff: 'Shares probability adjustments + narrative context.',
    icon: Books
  },
  {
    title: 'Stress-test travel safety',
    description: 'The Safety Analyst scores roads, buses, and walking routes hour-by-hour.',
    handoff: 'Publishes a risk tier plus actionable safety guidance.',
    icon: ShieldCheck
  },
  {
    title: 'Scour local intelligence',
    description: 'The News Intelligence agent searches local news, social media, and community chatter for real-time signals.',
    handoff: 'Delivers news digest, community sentiment, and neighboring district closure alerts.',
    icon: Newspaper
  },
  {
    title: 'Verify road clearing ops',
    description: 'The Infrastructure Monitor checks MDOT, county road commissions, and plow fleet status for ground truth on road conditions.',
    handoff: 'Reports actual clearing progress, resource levels, and hours-until-passable estimates.',
    icon: Truck
  },
  {
    title: 'Scan the power grid',
    description: 'The Power Grid Analyst monitors utility outage maps and grid stress to catch infrastructure failures that could force closures.',
    handoff: 'Flags outage counts, restoration timelines, and school facility power risks.',
    icon: Lightning
  },
  {
    title: 'Coordinate the final call',
    description: 'The Decision Coordinator blends every brief into a single recommendation, timeline, and monitoring plan.',
    handoff: 'Delivers probabilities, rationale, and who needs to do what next.',
    icon: CirclesThreePlus
  }
]

function formatPercent(value?: number | null): string {
  if (typeof value !== 'number') return '—'
  // Normalize: if value is between 0 and 1 (exclusive), treat as decimal (e.g., 0.32 -> 32%)
  const normalized = value > 0 && value <= 1 ? value * 100 : value
  return `${Math.round(normalized)}%`
}

function formatDegrees(value?: number | null): string {
  if (typeof value !== 'number') return '—'
  return `${Math.round(value)}°F`
}

function formatConfidence(value?: AgentPrediction['final']['confidence_level'] | null): string {
  if (!value) return 'Awaiting update'
  return CONFIDENCE_LABELS[value]
}

function formatTimestamp(value?: string | null): string {
  if (!value) return 'Waiting for next sync'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

export function AgentsView() {
  const [prediction, setPrediction] = useState<AgentPrediction | null>(null)
  const [loadingInsights, setLoadingInsights] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const fetchPrediction = async () => {
      try {
        const data = await fetchData<AgentPrediction>('prediction.json')
        if (!active) return
        setPrediction(data)
        setError(null)
      } catch (err) {
        if (!active) return
        console.warn('[AgentsView] Unable to load latest agent output', err)
        setError('Latest agent output is unavailable. Profiles below still summarize their roles.')
      } finally {
        if (active) {
          setLoadingInsights(false)
        }
      }
    }

    fetchPrediction()

    return () => {
      active = false
    }
  }, [])

  const insights = useMemo<Record<AgentId, AgentInsight | undefined>>(() => {
    if (!prediction) return {}

    const result: Partial<Record<AgentId, AgentInsight>> = {}

    const { meteorology, history, safety, final } = prediction

    // Check if agent data has an error (API failure) vs actual data
    const hasError = (data: unknown): data is { error: string; agent: string } =>
      typeof data === 'object' && data !== null && 'error' in data

    if (meteorology && !hasError(meteorology)) {
      result.meteorology = {
        headline: `${formatPercent(meteorology.precipitation_analysis.snow_probability_morning)} chance for morning snow`,
        summary: meteorology.overall_conditions_summary,
        callouts: [
          { label: 'Overnight Low', value: formatDegrees(meteorology.temperature_analysis.overnight_low_f) },
          { label: 'Snowfall Potential', value: `${meteorology.precipitation_analysis.total_snowfall_inches.toFixed(1)}"` },
          { label: 'Wind Gusts', value: `${Math.round(meteorology.wind_analysis.max_wind_speed_mph)} mph` }
        ]
      }
    } else if (meteorology && hasError(meteorology)) {
      result.meteorology = {
        headline: 'Data temporarily unavailable',
        summary: 'The meteorology agent encountered an issue. Will retry on next run.',
        callouts: []
      }
    }

    if (history && !hasError(history)) {
      const primaryPattern = history.similar_weather_patterns?.[0]
      const seasonalAdjustment = history.seasonal_context?.seasonal_probability_adjustment
      result.history = {
        headline: primaryPattern
          ? `${Math.round(primaryPattern.historical_snow_day_rate)}% snow days in similar setups`
          : 'No close analog located',
        summary: history.confidence_assessment,
        callouts: [
          {
            label: 'Closest Analog',
            value: primaryPattern ? primaryPattern.pattern_description : 'Still searching'
          },
          {
            label: 'Seasonal Adjustment',
            value:
              typeof seasonalAdjustment === 'number'
                ? `${seasonalAdjustment > 0 ? '+' : ''}${seasonalAdjustment}%`
                : 'Neutral'
          }
        ]
      }
    } else if (history && hasError(history)) {
      result.history = {
        headline: 'Data temporarily unavailable',
        summary: 'The history agent encountered an issue. Will retry on next run.',
        callouts: []
      }
    }

    if (safety && !hasError(safety)) {
      result.safety = {
        headline: `Risk level: ${safety.risk_level.toUpperCase()}`,
        summary: safety.safety_recommendations?.slice(0, 2).join(' ') || 'Assessing travel impacts... ',
        callouts: [
          {
            label: 'Primary Roads',
            value: safety.road_conditions?.primary_roads_score?.toString() ?? '—'
          },
          {
            label: 'Morning Commute',
            value: safety.timing_analysis?.morning_commute_impact
              ? safety.timing_analysis.morning_commute_impact.charAt(0).toUpperCase() +
                safety.timing_analysis.morning_commute_impact.slice(1)
              : 'Pending'
          }
        ]
      }
    } else if (safety && hasError(safety)) {
      result.safety = {
        headline: 'Data temporarily unavailable',
        summary: 'The safety agent encountered an issue. Will retry on next run.',
        callouts: []
      }
    }

    const { news } = prediction
    if (news && !hasError(news)) {
      const sentimentLabel = {
        expecting_closure: '🔴 Expecting closure',
        uncertain: '🟡 Uncertain',
        expecting_school: '🟢 Expecting school',
        no_buzz: '⚪ No buzz'
      }[news.community_intel?.social_media_sentiment] || 'Scanning...'
      
      const neighboringClosures = news.school_district_signals?.neighboring_district_closures?.length || 0
      
      result.news = {
        headline: sentimentLabel,
        summary: news.key_findings_summary,
        callouts: [
          {
            label: 'Neighboring Closures',
            value: neighboringClosures > 0 ? `${neighboringClosures} district${neighboringClosures > 1 ? 's' : ''}` : 'None reported'
          },
          {
            label: 'Power Outages',
            value: news.community_intel?.power_outage_reports ? 'Reported' : 'None'
          }
        ]
      }
    } else if (news && hasError(news)) {
      result.news = {
        headline: 'Data temporarily unavailable',
        summary: 'The news intelligence agent encountered an issue. Will retry on next run.',
        callouts: []
      }
    }

    const { infrastructure } = prediction
    if (infrastructure && !hasError(infrastructure)) {
      const responseLevel = infrastructure.municipal_response_level?.charAt(0).toUpperCase() + 
        infrastructure.municipal_response_level?.slice(1) || 'Unknown'
      
      result.infrastructure = {
        headline: `Municipal response: ${responseLevel}`,
        summary: infrastructure.overall_clearing_assessment,
        callouts: [
          {
            label: 'County Roads',
            value: infrastructure.road_clearing_status?.county_roads?.status?.replace('_', ' ') || 'Unknown'
          },
          {
            label: 'Hours to Bus Routes',
            value: typeof infrastructure.clearing_timeline?.hours_until_bus_routes === 'number' 
              ? `${infrastructure.clearing_timeline.hours_until_bus_routes.toFixed(1)} hrs`
              : 'Calculating'
          },
          {
            label: 'Data Confidence',
            value: infrastructure.data_confidence?.charAt(0).toUpperCase() + 
              infrastructure.data_confidence?.slice(1) || 'Unknown'
          }
        ]
      }
    } else if (infrastructure && hasError(infrastructure)) {
      result.infrastructure = {
        headline: 'Data temporarily unavailable',
        summary: 'The infrastructure monitor encountered an issue. Will retry on next run.',
        callouts: []
      }
    }

    const { powerGrid } = prediction
    if (powerGrid && !hasError(powerGrid)) {
      const gridStress = powerGrid.grid_stress_level?.charAt(0).toUpperCase() + 
        powerGrid.grid_stress_level?.slice(1) || 'Unknown'
      const riskLevel = powerGrid.school_facility_risk?.risk_level?.charAt(0).toUpperCase() +
        powerGrid.school_facility_risk?.risk_level?.slice(1) || 'Unknown'
      
      result.powerGrid = {
        headline: `Grid stress: ${gridStress}`,
        summary: powerGrid.overall_grid_assessment,
        callouts: [
          {
            label: 'Customers Affected',
            value: typeof powerGrid.current_outages?.total_customers_affected === 'number'
              ? powerGrid.current_outages.total_customers_affected.toLocaleString()
              : 'Unknown'
          },
          {
            label: 'School Risk',
            value: riskLevel
          },
          {
            label: 'Outage Trend',
            value: powerGrid.outage_trend?.charAt(0).toUpperCase() + 
              powerGrid.outage_trend?.slice(1) || 'Unknown'
          }
        ]
      }
    } else if (powerGrid && hasError(powerGrid)) {
      result.powerGrid = {
        headline: 'Data temporarily unavailable',
        summary: 'The power grid analyst encountered an issue. Will retry on next run.',
        callouts: []
      }
    }

    if (final) {
      result.final = {
        headline: `${formatPercent(final.snow_day_probability)} chance • ${formatConfidence(final.confidence_level)}`,
        summary: final.decision_rationale,
        callouts: [
          { label: 'Next Evaluation', value: final.next_evaluation_time || 'TBD' },
          { label: 'Monitoring Needed', value: final.updates_needed ? 'Yes' : 'Not currently' }
        ]
      }
    }

    return result
  }, [prediction])

  const probability = prediction?.final?.snow_day_probability ?? null
  const location = prediction?.location ?? 'Awaiting latest run'
  const confidence = prediction?.final?.confidence_level ?? null
  const timestampLabel = formatTimestamp(prediction?.timestamp)

  return (
    <div className="space-y-14 relative z-10">
      <Card className="rounded-2xl border border-primary/20 bg-background/80 backdrop-blur shadow-lg shadow-primary/5 gap-10">
        <CardHeader className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-primary">Meet the automation crew</p>
            <CardTitle className="mt-2 text-2xl sm:text-3xl">Seven specialists, one crystal-clear call</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
              Every forecast run is a round-table between meteorology, historical context, safety, local news intelligence, infrastructure monitoring, power grid analysis, and decision science.
            </p>
          </div>
          <div className="rounded-2xl border border-primary/40 bg-background/70 px-5 py-4 text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Latest collaboration</p>
            <p className="text-3xl font-semibold text-primary">
              {probability !== null ? formatPercent(probability) : 'Pending'}
            </p>
            <p className="text-sm text-muted-foreground">{formatConfidence(confidence)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{timestampLabel}</p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border/60 bg-background/80 p-5 space-y-2">
              <p className="text-xs text-muted-foreground uppercase">Location</p>
              <p className="text-lg font-semibold">{location}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/80 p-5 space-y-2">
              <p className="text-xs text-muted-foreground uppercase">Confidence</p>
              <p className="text-lg font-semibold">{formatConfidence(confidence)}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/80 p-5 space-y-2">
              <p className="text-xs text-muted-foreground uppercase">Primary focus</p>
              <p className="text-lg font-semibold">Snow day decision</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/80 p-5 space-y-2">
              <p className="text-xs text-muted-foreground uppercase">Pipeline cadence</p>
              <p className="text-lg font-semibold">Daily (or faster when storms brew)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <Sparkle size={18} />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-8 lg:gap-10 lg:grid-cols-2">
        {agentProfiles.map((agent) => {
          const insight = insights[agent.id]
          const Icon = agent.icon

          return (
            <motion.div
              key={agent.id}
              whileHover={{ translateY: -4 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="h-full"
            >
              <Card className="h-full flex flex-col rounded-2xl border border-primary/10 bg-background/80 backdrop-blur shadow-lg shadow-primary/5 gap-6">
                <CardHeader className="space-y-4">
                  <div className="flex items-center gap-3.5">
                    <div className={`rounded-2xl bg-gradient-to-br ${agent.gradient} p-3 text-primary`}>
                      <Icon size={28} weight="duotone" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{agent.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{agent.title}</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{agent.mission}</p>
                  <div className="flex flex-wrap gap-2.5">
                    <Badge variant="secondary">Model: {agent.model}</Badge>
                    <Badge variant="outline">{agent.tone}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-8 pt-2">
                  <div className="space-y-5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Focus lanes</p>
                    <div className="flex flex-wrap gap-3">
                      {agent.focusAreas.map((area) => (
                        <Badge key={area} variant="secondary" className="bg-secondary/50 text-secondary-foreground">
                          {area}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {loadingInsights ? (
                    <div className="space-y-4">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-16" />
                    </div>
                  ) : insight ? (
                    <div className="rounded-2xl border border-border/70 bg-muted/30 p-6 space-y-6">
                      <div className="space-y-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Latest dispatch</p>
                        <p className="text-sm font-medium text-primary">{insight.headline}</p>
                        <Markdown content={insight.summary} className="text-sm text-muted-foreground" />
                      </div>
                      {insight.callouts && insight.callouts.length > 0 && (
                        <div className="grid gap-5 sm:grid-cols-2">
                          {insight.callouts.map((callout) => (
                            <div key={callout.label} className="rounded-xl border border-border/60 bg-background/60 p-4 space-y-2">
                              <p className="text-xs uppercase text-muted-foreground">{callout.label}</p>
                              <p className="text-lg font-semibold">{callout.value}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-5 text-sm text-muted-foreground">
                      This profile updates right after the next agent run.
                    </div>
                  )}

                  <Accordion type="single" collapsible className="pt-1">
                    <AccordionItem value="tools">
                      <AccordionTrigger className="text-sm">Tool belt & deliverables</AccordionTrigger>
                      <AccordionContent className="space-y-4">
                        <div className="space-y-2">
                          <p className="text-xs uppercase text-muted-foreground">Tools they reach for</p>
                          <ul className="list-disc pl-5 text-sm space-y-1.5">
                            {agent.tools.map((tool) => (
                              <li key={tool}>{tool}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs uppercase text-muted-foreground">What they hand back</p>
                          <ul className="list-disc pl-5 text-sm space-y-1.5">
                            {agent.deliverables.map((deliverable) => (
                              <li key={deliverable}>{deliverable}</li>
                            ))}
                          </ul>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      <Card className="rounded-2xl border border-primary/10 bg-background/80 backdrop-blur shadow-lg shadow-primary/5 gap-12">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkle size={20} className="text-primary" />
            <CardTitle>How their hand-offs work</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            The crew runs like a miniature product team: collect signals, compare patterns, stress-test safety, then ship a single recommendation.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-5 md:grid-cols-2">
            {workflowSteps.map((step, index) => {
              const StepIcon = step.icon
              return (
                <div key={step.title} className="rounded-xl border border-border/60 bg-card/80 p-5 space-y-3 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                      <StepIcon size={20} weight="duotone" />
                    </div>
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Step {index + 1}</p>
                      <p className="text-lg font-semibold">{step.title}</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                  <div className="rounded-xl bg-background/70 p-4 text-sm space-y-1">
                    <p className="text-xs uppercase text-muted-foreground">Handoff</p>
                    <p>{step.handoff}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Deliberation Section - Shows collaboration data */}
      {prediction?.collaboration && (
        <DeliberationSection collaboration={prediction.collaboration} />
      )}
    </div>
  )
}

// Helper to get agent icon
function getAgentIcon(agentId: string): ComponentType<IconProps> {
  const iconMap: Record<string, ComponentType<IconProps>> = {
    meteorology: CloudSnow,
    history: Books,
    safety: ShieldCheck,
    news: Newspaper,
    infrastructure: Truck,
    powerGrid: Lightning,
    final: CirclesThreePlus
  }
  return iconMap[agentId] || Sparkle
}

// Helper to get agent gradient
function getAgentGradient(agentId: string): string {
  const gradientMap: Record<string, string> = {
    meteorology: 'from-sky-500/30 via-blue-400/15 to-transparent',
    history: 'from-amber-500/30 via-orange-400/15 to-transparent',
    safety: 'from-emerald-500/30 via-teal-400/15 to-transparent',
    news: 'from-rose-500/30 via-red-400/15 to-transparent',
    infrastructure: 'from-yellow-500/30 via-amber-400/15 to-transparent',
    powerGrid: 'from-cyan-500/30 via-blue-400/15 to-transparent'
  }
  return gradientMap[agentId] || 'from-purple-500/30 via-fuchsia-400/15 to-transparent'
}

// Deliberation Section Component
function DeliberationSection({ collaboration }: { collaboration: AgentCollaboration }) {
  const [expandedRound, setExpandedRound] = useState<string | undefined>(
    collaboration.rounds.length > 0 ? `round-${collaboration.rounds.length}` : undefined
  )

  const averageProbability = collaboration.rounds.length > 0
    ? Math.round(
        collaboration.rounds[collaboration.rounds.length - 1].positions
          .reduce((sum, p) => sum + p.probability, 0) / 
        collaboration.rounds[collaboration.rounds.length - 1].positions.length
      )
    : 0

  return (
    <Card className="rounded-2xl border border-primary/20 bg-background/80 backdrop-blur shadow-lg shadow-primary/5 gap-10">
      <CardHeader className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <ChatTeardropDots size={20} className="text-primary" />
            <p className="text-xs uppercase tracking-[0.3em] text-primary">Agent Deliberation</p>
          </div>
          <CardTitle className="text-2xl sm:text-3xl">How the team reached consensus</CardTitle>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
            Watch how agents debated, challenged each other, and evolved their positions through {collaboration.totalRounds} round{collaboration.totalRounds !== 1 ? 's' : ''} of collaboration.
          </p>
        </div>
        <div className="rounded-2xl border border-primary/40 bg-background/70 px-5 py-4 text-right">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Consensus status</p>
          <div className="flex items-center justify-end gap-2 mt-1">
            {collaboration.finalConsensus ? (
              <CheckCircle size={24} weight="duotone" className="text-green-500" />
            ) : (
              <WarningCircle size={24} weight="duotone" className="text-amber-500" />
            )}
            <p className="text-xl font-semibold">
              {collaboration.finalConsensus ? 'Reached' : 'Partial'}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            {collaboration.totalRounds} of {collaboration.maxRoundsAllowed} rounds
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Exit: {collaboration.exitReason}
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-8">
        {/* Summary Stats */}
        <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border/60 bg-background/80 p-5 space-y-2">
            <p className="text-xs text-muted-foreground uppercase">Final Avg Probability</p>
            <p className="text-2xl font-semibold text-primary">{averageProbability}%</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/80 p-5 space-y-2">
            <p className="text-xs text-muted-foreground uppercase">Final Spread</p>
            <p className="text-2xl font-semibold">
              {collaboration.rounds.length > 0 
                ? `±${Math.round(collaboration.rounds[collaboration.rounds.length - 1].probabilitySpread / 2)}%`
                : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/80 p-5 space-y-2">
            <p className="text-xs text-muted-foreground uppercase">Consensus Threshold</p>
            <p className="text-2xl font-semibold">±{collaboration.consensusThreshold}%</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/80 p-5 space-y-2">
            <p className="text-xs text-muted-foreground uppercase">Key Disagreements</p>
            <p className="text-2xl font-semibold">{collaboration.keyDisagreements.length}</p>
          </div>
        </div>

        {/* Confidence Journey */}
        {collaboration.confidenceJourney.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <ArrowsClockwise size={20} className="text-primary" />
              Position Shifts
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {collaboration.confidenceJourney.map((journey) => {
                const Icon = getAgentIcon(journey.agentId)
                const gradient = getAgentGradient(journey.agentId)
                const ShiftIcon = journey.totalShift > 0 ? TrendUp : journey.totalShift < 0 ? TrendDown : Minus
                const shiftColor = journey.totalShift > 0 ? 'text-green-500' : journey.totalShift < 0 ? 'text-red-500' : 'text-muted-foreground'
                
                return (
                  <div key={journey.agentId} className="rounded-xl border border-border/60 bg-card/80 p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-xl bg-gradient-to-br ${gradient} p-2 text-primary`}>
                        <Icon size={18} weight="duotone" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium capitalize">{journey.agentId}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{journey.initialProbability}%</span>
                          <span>→</span>
                          <span className="font-medium text-foreground">{journey.finalProbability}%</span>
                        </div>
                      </div>
                      <div className={`flex items-center gap-1 ${shiftColor}`}>
                        <ShiftIcon size={16} weight="bold" />
                        <span className="text-sm font-medium">
                          {journey.totalShift > 0 ? '+' : ''}{journey.totalShift}%
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Debate Rounds */}
        <Accordion 
          type="single" 
          collapsible 
          value={expandedRound}
          onValueChange={setExpandedRound}
          className="space-y-3"
        >
          {collaboration.rounds.map((round) => (
            <AccordionItem 
              key={`round-${round.round}`} 
              value={`round-${round.round}`}
              className="border border-border/60 rounded-xl overflow-hidden bg-card/50"
            >
              <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/30">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                      Round {round.round}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      Spread: {round.probabilitySpread.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {round.consensusReached ? (
                      <Badge variant="secondary" className="bg-green-500/20 text-green-600">
                        <CheckCircle size={14} className="mr-1" /> Consensus
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-amber-500/20 text-amber-600">
                        Continuing
                      </Badge>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-5">
                <div className="space-y-4">
                  {/* Agent Positions */}
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {round.positions.map((position) => {
                      const Icon = getAgentIcon(position.agentId)
                      const gradient = getAgentGradient(position.agentId)
                      
                      return (
                        <div 
                          key={position.agentId} 
                          className="rounded-xl border border-border/60 bg-background/60 p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`rounded-lg bg-gradient-to-br ${gradient} p-1.5 text-primary`}>
                                <Icon size={14} weight="duotone" />
                              </div>
                              <span className="text-sm font-medium capitalize">{position.agentId}</span>
                            </div>
                            <div className="text-lg font-bold text-primary">{position.probability}%</div>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">{position.rationale}</p>
                          {position.keyFactors.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {position.keyFactors.slice(0, 3).map((factor, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {factor.length > 25 ? factor.slice(0, 25) + '...' : factor}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Debates in this round */}
                  {round.debates.length > 0 && (
                    <div className="space-y-3 pt-3 border-t border-border/40">
                      <p className="text-xs uppercase text-muted-foreground font-medium">Challenges raised</p>
                      {round.debates.map((debate, i) => (
                        <div key={i} className="rounded-lg bg-muted/30 p-3 space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Badge variant="outline" className="capitalize">{debate.challenger}</Badge>
                            <span className="text-muted-foreground">→</span>
                            <Badge variant="outline" className="capitalize">{debate.challenged}</Badge>
                          </div>
                          <p className="text-sm">{debate.challenge}</p>
                          {debate.response && (
                            <p className="text-sm text-muted-foreground pl-4 border-l-2 border-border">
                              {debate.response}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        {/* Key Disagreements */}
        {collaboration.keyDisagreements.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <WarningCircle size={20} className="text-amber-500" />
              Key Disagreements
            </h3>
            <div className="grid gap-3">
              {collaboration.keyDisagreements.map((disagreement, i) => (
                <div key={i} className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{disagreement.topic}</p>
                    <Badge variant="outline" className={
                      disagreement.impact === 'high' ? 'border-red-500/50 text-red-600' :
                      disagreement.impact === 'medium' ? 'border-amber-500/50 text-amber-600' :
                      'border-muted-foreground/50'
                    }>
                      {disagreement.impact} impact
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="capitalize">{disagreement.agents.join(' vs ')}</span>
                    <span>•</span>
                    <span className="capitalize">{disagreement.resolution}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Collaboration Summary */}
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
          <p className="text-sm text-muted-foreground">{collaboration.collaborationSummary}</p>
        </div>
      </CardContent>
    </Card>
  )
}
