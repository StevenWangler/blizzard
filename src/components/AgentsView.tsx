import { useEffect, useMemo, useState, type ComponentType } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import {
  CloudSnow,
  Books,
  ShieldCheck,
  CirclesThreePlus,
  Sparkle
} from '@phosphor-icons/react'
import type { IconProps } from '@phosphor-icons/react'
import type { AgentPrediction } from '@/types/agentPrediction'

const CONFIDENCE_LABELS: Record<AgentPrediction['final']['confidence_level'], string> = {
  very_low: 'Very Low',
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  very_high: 'Very High'
}

type AgentId = 'meteorology' | 'history' | 'safety' | 'final'

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
    tools: ['get_weather_data', 'search_weather_context'],
    deliverables: ['Quantitative weather analysis', 'Alert digest', 'Overnight vs. morning breakdowns'],
    model: 'gpt-5.1',
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
    tools: ['search_weather_context'],
    deliverables: ['Historical hit rate', 'Seasonal adjustment', 'Confidence commentary'],
    model: 'gpt-5.1',
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
    tools: ['get_weather_data'],
    deliverables: ['Roadway scorecard', 'Safety recommendations', 'Impact timeline'],
    model: 'gpt-5.1',
    tone: 'Direct + pragmatic',
    icon: ShieldCheck,
    gradient: 'from-emerald-500/30 via-teal-400/15 to-transparent'
  },
  {
    id: 'final',
    name: 'Decision Coordinator',
    title: 'Consensus Builder',
    mission: 'Synthesizes every specialist note into a confident call, recommendations, and next check-in time.',
    focusAreas: ['Probability modeling', 'Stakeholder guidance', 'Scenario planning'],
    tools: ['Structured agent briefs'],
    deliverables: ['Snow day probability', 'Decision rationale', 'Next evaluation timing'],
    model: 'gpt-5.1',
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
    title: 'Coordinate the final call',
    description: 'The Decision Coordinator blends every brief into a single recommendation, timeline, and monitoring plan.',
    handoff: 'Delivers probabilities, rationale, and who needs to do what next.',
    icon: CirclesThreePlus
  }
]

function formatPercent(value?: number | null): string {
  if (typeof value !== 'number') return '—'
  return `${Math.round(value)}%`
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
        const response = await fetch('/data/prediction.json')
        if (!response.ok) {
          throw new Error('Prediction data unavailable')
        }
        const data: AgentPrediction = await response.json()
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
    <div className="space-y-14">
      <Card className="border-primary/30 bg-primary/5 gap-10">
        <CardHeader className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-primary">Meet the automation crew</p>
            <CardTitle className="mt-2 text-2xl sm:text-3xl">Four specialists, one crystal-clear call</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
              Every forecast run is a round-table between meteorology, historical context, safety, and decision science.
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
              <Card className="h-full flex flex-col border-border/70 bg-background/80 gap-6">
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
                        <p className="text-sm text-muted-foreground">{insight.summary}</p>
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

      <Card className="bg-background/80 gap-12">
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
                <div key={step.title} className="rounded-2xl border border-border/70 bg-muted/20 p-5 space-y-3">
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
    </div>
  )
}
