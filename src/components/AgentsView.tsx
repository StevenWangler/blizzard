import { useMemo, useState, type ComponentType } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
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
import type { AgentPrediction, AgentCollaboration } from '@/types/agentPrediction'
import type { SavedForecast } from '@/hooks/useSavedForecast'
import { forecastFreshness, forecastUpdateLabel, schoolDateLabel } from '@/lib/forecastPresentation'
import { normalizeProbability, readOutcomeProbability } from '@/services/outcomes'
import { StudentPageHeading } from '@/components/StudentPageHeading'

const CONFIDENCE_LABELS: Record<AgentPrediction['final']['confidence_level'], string> = {
  very_low: 'Very Low',
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  very_high: 'Very High'
}

type AgentId = 'meteorology' | 'history' | 'safety' | 'news' | 'infrastructure' | 'powerGrid' | 'webWeatherVerifier' | 'final'

type AgentProfile = {
  id: AgentId
  name: string
  mission: string
  focusAreas: string[]
  tools: string[]
  deliverables: string[]
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
    mission: 'Reads the forecast for the school morning and estimates when snow, wind or poor visibility could affect travel.',
    focusAreas: ['Temperature structure', 'Precip type & timing', 'Wind + visibility'],
    tools: ['Web search', 'Code interpreter'],
    deliverables: ['Quantitative weather analysis', 'Alert digest', 'Overnight vs. morning breakdowns'],
    icon: CloudSnow,
    gradient: 'from-sky-500/30 via-blue-400/15 to-transparent'
  },
  {
    id: 'history',
    name: 'Weather Pattern Historian',
    mission: 'Looks for similar storms and describes how well those comparisons fit Rockford.',
    focusAreas: ['Analog events', 'Seasonal norms', 'Microclimate flags'],
    tools: ['Web search', 'Code interpreter'],
    deliverables: ['Estimated closure rates for similar storms', 'Seasonal adjustment', 'Confidence commentary'],
    icon: Books,
    gradient: 'from-amber-500/30 via-orange-400/15 to-transparent'
  },
  {
    id: 'safety',
    name: 'Transportation Safety Analyst',
    mission: 'Estimates how freezing temperatures and precipitation could affect drivers, buses and students walking to school.',
    focusAreas: ['Road surface risk', 'Commute timing', 'Emergency access'],
    tools: ['Web search', 'Code interpreter'],
    deliverables: ['Roadway scorecard', 'Safety recommendations', 'Impact timeline'],
    icon: ShieldCheck,
    gradient: 'from-emerald-500/30 via-teal-400/15 to-transparent'
  },
  {
    id: 'news',
    name: 'Local News Intelligence',
    mission: 'Looks for public district announcements, local news and reports from nearby communities.',
    focusAreas: ['Local news', 'Social signals', 'District announcements'],
    tools: ['Web search'],
    deliverables: ['News digest', 'Community sentiment', 'Neighboring district closures'],
    icon: Newspaper,
    gradient: 'from-rose-500/30 via-red-400/15 to-transparent'
  },
  {
    id: 'infrastructure',
    name: 'Regional Infrastructure Monitor',
    mission: 'Looks for public road-maintenance reports and estimates which roads may be clear by the morning bus run. Local street observations can be scarce.',
    focusAreas: ['Plow operations', 'Road clearing timeline', 'Salt/sand resources'],
    tools: ['Web search'],
    deliverables: ['Road clearing status by type', 'Municipal response level', 'Hours-to-clear estimates'],
    icon: Truck,
    gradient: 'from-yellow-500/30 via-amber-400/15 to-transparent'
  },
  {
    id: 'powerGrid',
    name: 'Power Grid Analyst',
    mission: 'Looks for public outage and restoration reports that could affect schools.',
    focusAreas: ['Outage tracking', 'Grid stress', 'School facility power'],
    tools: ['Web search'],
    deliverables: ['Outage counts & trends', 'Restoration estimates', 'School-specific risk assessment'],
    icon: Lightning,
    gradient: 'from-cyan-500/30 via-blue-400/15 to-transparent'
  },
  {
    id: 'webWeatherVerifier',
    name: 'Web Weather Verifier',
    mission: 'Compares forecasts for the same morning. Blizzard uses a feels-like temperature of −20°F or colder as a risk signal when supported by the National Weather Service or two independent providers.',
    focusAreas: ['Feels like temperature verification', 'Multi-source comparison', 'Discrepancy detection'],
    tools: ['Web search'],
    deliverables: ['Weather source comparison', 'Critical threshold alerts', 'API vs web analysis'],
    icon: ArrowsClockwise,
    gradient: 'from-purple-500/30 via-pink-400/15 to-transparent'
  },
  {
    id: 'final',
    name: 'Decision Coordinator',
    mission: 'Reviews the seven briefs, can ask follow-up questions, and assigns the final snow-day probability and confidence level.',
    focusAreas: ['Probability modeling', 'Stakeholder guidance', 'Scenario planning'],
    tools: ['Specialist follow-up questions', 'Cross-check between specialists'],
    deliverables: ['Snow day probability', 'Decision rationale', 'Next evaluation timing'],
    icon: CirclesThreePlus,
    gradient: 'from-purple-500/30 via-fuchsia-400/15 to-transparent'
  }
]

const workflowSteps: WorkflowStep[] = [
  {
    title: 'Choose the school date',
    description: 'Blizzard skips weekends and recorded days off, then requests weather covering the target date.',
    handoff: 'The forecast covers the target school day and the hours leading up to it.',
    icon: CloudSnow
  },
  {
    title: 'Read the evidence',
    description: 'One forecaster reads hourly temperatures, precipitation, wind and visibility through the morning bus run.',
    handoff: 'When a local report could change the call, the forecaster can check a dated public source. Conditions on unreported roads stay unknown.',
    icon: Books
  },
  {
    title: 'Estimate the chance of closure',
    description: 'The forecaster gives one probability and explains which conditions could change it.',
    handoff: 'Blizzard checks the report before saving it. Rockford Public Schools makes the closure decision.',
    icon: CirclesThreePlus
  }
]

function formatPercent(value: unknown): string {
  const percent = readOutcomeProbability(value)
  return percent === null ? 'Unavailable' : `${percent}%`
}

function formatLabel(value?: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ') : 'Not recorded'
}

function formatConfidence(value?: AgentPrediction['final']['confidence_level'] | null): string {
  return value ? CONFIDENCE_LABELS[value] ?? 'Not recorded' : 'Not recorded'
}

export function AgentsView({ forecast }: { forecast: SavedForecast }) {
  const reduceMotion = useReducedMotion()
  const { prediction, loading: loadingInsights, error } = forecast
  const freshness = forecastFreshness(prediction?.timestamp, prediction?.targetDate)
  const readProbability = freshness === 'current' ? normalizeProbability : readOutcomeProbability
  const probability = readProbability(prediction?.final?.snow_day_probability)
  const insights = useMemo<Partial<Record<AgentId, AgentInsight>>>(() => {
    if (!prediction || prediction.architecture) return {}

    const result: Partial<Record<AgentId, AgentInsight>> = {}

    const { meteorology, history, safety, final } = prediction

    // Check if agent data has an error (API failure) vs actual data
    const hasError = (data: unknown): data is { error: string; agent: string } =>
      typeof data === 'object' && data !== null && 'error' in data

    if (meteorology && !hasError(meteorology)) {
      result.meteorology = {
        headline: `${formatPercent(meteorology.precipitation_analysis?.snow_probability_morning)} chance for morning snow`,
        summary: meteorology.overall_conditions_summary,
        callouts: [
          { label: 'Overnight Low', value: typeof meteorology.temperature_analysis?.overnight_low_f === 'number' ? `${meteorology.temperature_analysis.overnight_low_f}°F` : 'Not recorded' },
          { label: 'Snowfall Potential', value: typeof meteorology.precipitation_analysis?.total_snowfall_inches === 'number' ? `${meteorology.precipitation_analysis.total_snowfall_inches} in` : 'Not recorded' },
          { label: 'Maximum wind', value: typeof meteorology.wind_analysis?.max_wind_speed_mph === 'number' ? `${meteorology.wind_analysis.max_wind_speed_mph} mph` : 'Not recorded' }
        ]
      }
    } else if (meteorology && hasError(meteorology)) {
      result.meteorology = {
        headline: 'Analysis unavailable in this report',
        summary: 'The meteorology agent encountered an issue.',
        callouts: []
      }
    }

    if (history && !hasError(history)) {
      const primaryPattern = history.similar_weather_patterns?.[0]
      const seasonalAdjustment = history.seasonal_context?.seasonal_probability_adjustment
      result.history = {
        headline: primaryPattern
          ? `Estimated closure rate for similar storms: ${formatPercent(primaryPattern.historical_snow_day_rate)}`
          : 'No close analog located',
        summary: history.confidence_assessment,
        callouts: [
          {
            label: 'Closest Analog',
            value: primaryPattern ? primaryPattern.pattern_description : 'None recorded'
          },
          {
            label: 'Seasonal Adjustment',
            value:
              typeof seasonalAdjustment === 'number'
                ? `${seasonalAdjustment > 0 ? '+' : ''}${seasonalAdjustment}%`
                : 'Not recorded'
          }
        ]
      }
    } else if (history && hasError(history)) {
      result.history = {
        headline: 'Analysis unavailable in this report',
        summary: 'The history agent encountered an issue.',
        callouts: []
      }
    }

    if (safety && !hasError(safety)) {
      result.safety = {
        headline: `Estimated travel risk: ${formatLabel(safety.risk_level)}`,
        summary: safety.safety_recommendations?.slice(0, 2).join(' ') || 'No recommendation recorded.',
        callouts: [
          {
            label: 'Estimated primary-road score (1–10)',
            value: safety.road_conditions?.primary_roads_score?.toString() ?? '—'
          },
          {
            label: 'Morning Commute',
            value: safety.timing_analysis?.morning_commute_impact
              ? safety.timing_analysis.morning_commute_impact.charAt(0).toUpperCase() +
                safety.timing_analysis.morning_commute_impact.slice(1)
              : 'Not recorded'
          }
        ]
      }
    } else if (safety && hasError(safety)) {
      result.safety = {
        headline: 'Analysis unavailable in this report',
        summary: 'The safety agent encountered an issue.',
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
      }[news.community_intel?.social_media_sentiment] || 'No sentiment recorded'
      
      const neighboringClosures = news.school_district_signals?.neighboring_district_closures
      
      result.news = {
        headline: sentimentLabel,
        summary: news.key_findings_summary,
        callouts: [
          {
            label: 'Nearby district reports',
            value: Array.isArray(neighboringClosures) ? neighboringClosures.join(' · ') || 'None reported' : 'Not recorded'
          },
          {
            label: 'Power Outages',
            value: news.community_intel?.power_outage_reports === true ? 'Reported' : news.community_intel?.power_outage_reports === false ? 'None reported' : 'Not recorded'
          }
        ]
      }
    } else if (news && hasError(news)) {
      result.news = {
        headline: 'Analysis unavailable in this report',
        summary: 'The news intelligence agent encountered an issue.',
        callouts: []
      }
    }

    const { infrastructure } = prediction
    if (infrastructure && !hasError(infrastructure)) {
      const responseLevel = formatLabel(infrastructure.municipal_response_level)
      
      result.infrastructure = {
        headline: `Municipal response: ${responseLevel}`,
        summary: infrastructure.overall_clearing_assessment,
        callouts: [
          {
            label: 'County road estimate',
            value: infrastructure.road_clearing_status?.county_roads?.status?.replace('_', ' ') || 'Unknown'
          },
          {
            label: 'Estimated hours until bus routes',
            value: typeof infrastructure.clearing_timeline?.hours_until_bus_routes === 'number' 
              ? `${infrastructure.clearing_timeline.hours_until_bus_routes.toFixed(1)} hrs`
              : 'Not recorded'
          },
          {
            label: 'Data Confidence',
            value: formatLabel(infrastructure.data_confidence)
          }
        ]
      }
    } else if (infrastructure && hasError(infrastructure)) {
      result.infrastructure = {
        headline: 'Analysis unavailable in this report',
        summary: 'The infrastructure monitor encountered an issue.',
        callouts: []
      }
    }

    const { powerGrid } = prediction
    if (powerGrid && !hasError(powerGrid)) {
      const gridStress = formatLabel(powerGrid.grid_stress_level)
      const riskLevel = formatLabel(powerGrid.school_facility_risk?.risk_level)
      
      result.powerGrid = {
        headline: `Grid stress: ${gridStress}`,
        summary: powerGrid.overall_grid_assessment,
        callouts: [
          {
            label: 'Customers affected in the report',
            value: typeof powerGrid.current_outages?.total_customers_affected === 'number'
              ? powerGrid.current_outages.total_customers_affected.toLocaleString()
              : 'Unknown'
          },
          {
            label: 'Estimated school risk',
            value: riskLevel
          },
          {
            label: 'Outage Trend',
            value: formatLabel(powerGrid.outage_trend)
          }
        ]
      }
    } else if (powerGrid && hasError(powerGrid)) {
      result.powerGrid = {
        headline: 'Analysis unavailable in this report',
        summary: 'The power grid analyst encountered an issue.',
        callouts: []
      }
    }

    const { webWeatherVerifier } = prediction
    if (webWeatherVerifier && !hasError(webWeatherVerifier)) {
      const consensus = formatLabel(webWeatherVerifier.discrepancy_analysis?.consensus_level)
      const recommendation = formatLabel(webWeatherVerifier.recommendation)
      const belowMinus20 = webWeatherVerifier.discrepancy_analysis?.feels_like_below_minus_20 === true ? 'Confirmed in report' : 'Unconfirmed'
      
      result.webWeatherVerifier = {
        headline: `Agreement between weather sources: ${consensus}`,
        summary: webWeatherVerifier.verification_summary,
        callouts: [
          {
            label: 'Feels like −20°F or colder',
            value: belowMinus20
          },
          {
            label: 'Sources listed',
            value: webWeatherVerifier.weather_sources?.length?.toString() ?? 'Not recorded'
          },
          {
            label: 'Feels-like difference',
            value: typeof webWeatherVerifier.api_comparison?.difference_f === 'number' ? `${Math.abs(webWeatherVerifier.api_comparison.difference_f)}°F` : 'Not recorded'
          },
          {
            label: 'Recommendation',
            value: recommendation
          },
          {
            label: 'Critical Alerts',
            value: webWeatherVerifier.critical_alerts?.length?.toString() ?? 'Not recorded'
          }
        ]
      }
    } else if (webWeatherVerifier && hasError(webWeatherVerifier)) {
      result.webWeatherVerifier = {
        headline: 'Analysis unavailable in this report',
        summary: 'The web weather verifier encountered an issue.',
        callouts: []
      }
    }

    if (final) {
      result.final = {
        headline: `${formatPercent(probability)} chance • ${formatConfidence(final.confidence_level)}`,
        summary: final.decision_rationale,
        callouts: [
          { label: 'Suggested next evaluation', value: final.next_evaluation_time || 'TBD' },
          { label: 'Monitoring Needed', value: final.updates_needed === true ? 'Yes' : final.updates_needed === false ? 'No' : 'Not recorded' }
        ]
      }
    }

    return result
  }, [prediction, probability])

  const location = prediction?.location ?? 'Not recorded'
  const confidence = prediction?.final?.confidence_level ?? null
  const timestampLabel = forecastUpdateLabel(prediction?.timestamp, true)

  return (
    <div className="student-page agents-page space-y-6 sm:space-y-8 relative z-10">
      <StudentPageHeading title="How it works" description="See how Blizzard estimates the chance that Rockford Public Schools will close for weather." />
      <Card className="rounded-2xl border border-primary/20 bg-background/80 backdrop-blur shadow-lg shadow-primary/5 gap-10">
        <CardHeader className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-xl sm:text-2xl">How Blizzard makes its call</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
              One forecaster estimates how the weather will affect Rockford’s morning bus run and explains the chance of a districtwide closure.
            </p>
          </div>
          <div className="rounded-2xl border border-primary/40 bg-background/70 px-5 py-4 text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{freshness === 'archived' ? 'Archived snow-day chance' : freshness === 'current' ? 'Snow-day chance' : 'Saved snow-day chance'}</p>
            <p className="text-3xl font-semibold text-primary">
              {loadingInsights ? 'Loading…' : probability === null ? 'Unavailable' : `${formatPercent(probability)} chance`}
            </p>
            <p className="text-sm text-muted-foreground">{prediction?.targetDate && schoolDateLabel(prediction.targetDate, true)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{prediction && `Saved ${timestampLabel}`}</p>
          </div>
        </CardHeader>
        <CardContent>
          <details className="record-disclosure">
            <summary>Report & run details</summary>
          <div className="grid grid-cols-2 gap-4 pt-4 lg:grid-cols-4">
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
              <p className="text-lg font-semibold">Districtwide weather closure</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/80 p-5 space-y-2">
              <p className="text-xs text-muted-foreground uppercase">Scheduled attempts</p>
              <p className="text-lg font-semibold">9:17 a.m., 1:17 p.m. and 6:17 p.m. Eastern when active</p>
            </div>
          </div>
          </details>
        </CardContent>
      </Card>

      {prediction?.architecture === 'single-forecaster-v1' && (
        <Card>
          <CardHeader><CardTitle>What shaped this forecast</CardTitle></CardHeader>
          <CardContent><Markdown content={prediction.final.decision_rationale} /></CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <Sparkle size={18} />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {prediction && !prediction.architecture && <details className="page-disclosure">
        <summary>Specialist reports from the earlier forecast system</summary>
        <div className="grid gap-8 lg:gap-10 lg:grid-cols-2">
        {agentProfiles.map((agent) => {
          const insight = insights[agent.id]
          const Icon = agent.icon

          return (
            <motion.div
              key={agent.id}
              whileHover={reduceMotion ? undefined : { translateY: -4 }}
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
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{agent.mission}</p>
                </CardHeader>
                <CardContent className="pt-0">
                  <details className="record-disclosure">
                    <summary>Saved analysis & tools</summary>
                    <div className="flex flex-col gap-5 pt-4">
                  <div className="space-y-5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Focus areas</p>
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
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">AI assessment from this report</p>
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
                      No analysis available for this role in the saved report.
                    </div>
                  )}

                  <Accordion type="single" collapsible className="pt-1">
                    <AccordionItem value="tools">
                      <AccordionTrigger className="text-sm">Tools and report contents</AccordionTrigger>
                      <AccordionContent className="space-y-4">
                        <div className="space-y-2">
                          <p className="text-xs uppercase text-muted-foreground">Available tools</p>
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
                    </div>
                  </details>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div></details>}

      <Card className="rounded-2xl border border-primary/10 bg-background/80 backdrop-blur shadow-lg shadow-primary/5 gap-12">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkle size={20} className="text-primary" />
            <CardTitle>From weather forecast to snow-day chance</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            These are the steps used by the current forecast generator.
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
                    <p className="text-xs uppercase text-muted-foreground">Result</p>
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
        <details className="page-disclosure">
          <summary>Debate recorded for this forecast</summary>
          <div className="page-disclosure-content">
        <DeliberationSection collaboration={prediction.collaboration} />
          </div>
        </details>
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
    webWeatherVerifier: ArrowsClockwise,
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
    powerGrid: 'from-cyan-500/30 via-blue-400/15 to-transparent',
    webWeatherVerifier: 'from-purple-500/30 via-pink-400/15 to-transparent'
  }
  return gradientMap[agentId] || 'from-purple-500/30 via-fuchsia-400/15 to-transparent'
}

// Deliberation Section Component
function DeliberationSection({ collaboration }: { collaboration: AgentCollaboration }) {
  const [expandedRound, setExpandedRound] = useState<string | undefined>(
    collaboration.rounds.length > 0 ? `round-${collaboration.rounds.length}` : undefined
  )

  const lastRound = collaboration.rounds[collaboration.rounds.length - 1]
  const positions = lastRound?.positions ?? []
  const averageProbability = positions.length
    ? Math.round(positions.reduce((sum, position) => sum + position.probability, 0) / positions.length)
    : null

  return (
    <Card className="rounded-2xl border border-primary/20 bg-background/80 backdrop-blur shadow-lg shadow-primary/5 gap-10">
      <CardHeader className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <ChatTeardropDots size={20} className="text-primary" />
            <p className="text-xs uppercase tracking-[0.3em] text-primary">Agent Deliberation</p>
          </div>
          <CardTitle className="text-2xl sm:text-3xl">Recorded debate rounds</CardTitle>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
            These positions come from the optional debate. The coordinator sets the published snow-day chance separately.
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
              {collaboration.finalConsensus ? 'Reached' : 'Not reached'}
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
            <p className="text-xs text-muted-foreground uppercase">Average final debate estimate</p>
            <p className="text-2xl font-semibold text-primary">{formatPercent(averageProbability)}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/80 p-5 space-y-2">
            <p className="text-xs text-muted-foreground uppercase">Final spread (highest minus lowest)</p>
            <p className="text-2xl font-semibold">
              {lastRound && positions.length > 0
                ? `${lastRound.probabilitySpread} points`
                : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/80 p-5 space-y-2">
            <p className="text-xs text-muted-foreground uppercase">Maximum spread for consensus</p>
            <p className="text-2xl font-semibold">{2 * collaboration.consensusThreshold} points</p>
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
                          {journey.totalShift > 0 ? '+' : ''}{journey.totalShift} points
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
                      Spread: {round.probabilitySpread} points
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {round.consensusReached ? (
                      <Badge variant="secondary" className="bg-green-500/20 text-green-600">
                        <CheckCircle size={14} className="mr-1" /> Consensus
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-amber-500/20 text-amber-600">
                        Threshold unmet
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
