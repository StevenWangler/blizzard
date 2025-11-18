import { type ComponentType, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CloudSnow, Clock, ShieldCheck, Sparkle, TrendUp } from '@phosphor-icons/react'
import { generateFullSummary } from '@/lib/narrativeGenerator'
import { AnimatePresence, motion } from 'framer-motion'

interface HighlightItem {
  title: string
  text: string
  icon: ComponentType<{ size?: number }>
}

interface NarrativeSummaryProps {
  prediction: any // Using any for now, should match AgentPrediction type
}

export function NarrativeSummary({ prediction }: NarrativeSummaryProps) {
  if (!prediction?.meteorology || !prediction?.final || !prediction?.safety) {
    return null
  }

  const narrative = useMemo(() => generateFullSummary(prediction), [prediction])
  const highlights = useMemo<HighlightItem[]>(() => [
    {
      title: 'Weather setup',
      text: narrative.weatherSummary,
      icon: CloudSnow
    },
    {
      title: 'Impact outlook',
      text: narrative.impactStatement,
      icon: TrendUp
    },
    {
      title: 'Timeline beats',
      text: narrative.timelineNarrative,
      icon: Clock
    },
    {
      title: 'Safety pulse',
      text: narrative.safetyAdvisory,
      icon: ShieldCheck
    }
  ], [narrative])
  const [activeHighlight, setActiveHighlight] = useState(0)

  useEffect(() => {
    setActiveHighlight(0)
  }, [prediction])

  useEffect(() => {
    if (highlights.length <= 1) return
    const timer = setInterval(() => {
      setActiveHighlight((prev) => (prev + 1) % highlights.length)
    }, 7000)
    return () => clearInterval(timer)
  }, [highlights.length])

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader className="px-6 pt-6 pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkle size={20} weight="duotone" className="text-primary" />
            AI Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 px-6 pb-6 pt-0">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-primary/80 font-semibold">
            {highlights.map((highlight, index) => (
              <button
                key={highlight.title}
                type="button"
                onClick={() => setActiveHighlight(index)}
                className={`flex items-center gap-1 px-2 py-1 rounded-full transition-colors ${
                  index === activeHighlight ? 'bg-primary/10 text-primary' : 'text-primary/50 hover:text-primary'
                }`}
              >
                <highlight.icon size={14} />
                {highlight.title}
              </button>
            ))}
          </div>

          <div className="relative min-h-[120px] pt-2">
            <AnimatePresence mode="wait">
              <motion.div
                key={highlights[activeHighlight]?.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4 }}
                className="space-y-2"
              >
                <p className="text-sm font-semibold text-primary flex items-center gap-2">
                  {(() => {
                    const Icon = highlights[activeHighlight].icon
                    return <Icon size={16} />
                  })()}
                  {highlights[activeHighlight].title}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {highlights[activeHighlight].text}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {narrative.residentRecommendations.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-1 text-primary">Quick Tips</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                {narrative.residentRecommendations.map((rec: string, index: number) => (
                  <li key={index} className="flex items-start gap-1.5">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
