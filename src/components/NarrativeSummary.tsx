import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Sparkle } from '@phosphor-icons/react'
import { generateFullSummary } from '@/lib/narrativeGenerator'
import { motion } from 'framer-motion'

interface NarrativeSummaryProps {
  prediction: any // Using any for now, should match AgentPrediction type
}

export function NarrativeSummary({ prediction }: NarrativeSummaryProps) {
  if (!prediction?.meteorology || !prediction?.final || !prediction?.safety) {
    return null
  }

  const narrative = generateFullSummary(prediction)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkle size={20} weight="duotone" className="text-primary" />
            AI Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold mb-1 text-primary">Conditions</h4>
            <p className="text-sm text-muted-foreground">{narrative.weatherSummary}</p>
          </div>
          
          <div>
            <h4 className="text-sm font-semibold mb-1 text-primary">Impact</h4>
            <p className="text-sm text-muted-foreground">{narrative.impactStatement}</p>
          </div>
          
          <div>
            <h4 className="text-sm font-semibold mb-1 text-primary">Timeline</h4>
            <p className="text-sm text-muted-foreground">{narrative.timelineNarrative}</p>
          </div>
          
          <div>
            <h4 className="text-sm font-semibold mb-1 text-primary">Safety</h4>
            <p className="text-sm text-muted-foreground">{narrative.safetyAdvisory}</p>
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
