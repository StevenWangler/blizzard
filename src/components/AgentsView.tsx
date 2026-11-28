import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Markdown } from '@/components/ui/markdown'
import { StudentPageHeading } from '@/components/StudentPageHeading'
import type { SavedForecast } from '@/hooks/useSavedForecast'
import { forecastFreshness, forecastUpdateLabel, schoolDateLabel } from '@/lib/forecastPresentation'
import { normalizeProbability, readOutcomeProbability } from '@/services/outcomes'

export function AgentsView({ forecast }: { forecast: SavedForecast }) {
  const { prediction, loading, error } = forecast
  const freshness = forecastFreshness(prediction?.timestamp, prediction?.targetDate)
  const final = prediction?.final
  const probability = freshness === 'current'
    ? normalizeProbability(final?.snow_day_probability)
    : readOutcomeProbability(final?.snow_day_probability)
  const factor = final?.primary_factors?.[0]
  const reportTitle = freshness === 'archived' ? 'An archived call' : freshness === 'current' ? 'The latest call' : 'A saved call'

  return (
    <div className="student-page space-y-4">
      <StudentPageHeading title="How it works" description="Blizzard estimates the chance that Rockford Public Schools will close districtwide for a full school day because of weather. The district makes the decision." />

      <Card>
        <CardHeader><h3 data-slot="card-title">Why the morning bus run matters</h3></CardHeader>
        <CardContent className="space-y-3 text-sm leading-6">
          <p>One AI forecaster reads Rockford’s hourly weather for the next school day, skipping weekends and recorded days off. It looks at when snow or ice could affect buses, especially from 6 to 8 a.m.</p>
          <p>For example, snow that ends overnight leaves time to clear roads. Freezing rain starting at 6 a.m. could make the same trip harder, even with little snow on the ground. Wind, visibility and how cold it feels while students wait also matter.</p>
          <p>The forecaster can check a dated local report when road conditions could change the call. A report from a plowed highway leaves conditions on nearby side roads uncertain. Without a local observation, conditions on that route stay unknown.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h3 data-slot="card-title">How to read the percentage</h3></CardHeader>
        <CardContent className="space-y-3 text-sm leading-6">
          <p>A 30% call means Blizzard thinks school staying open is more likely than a closure. Snow can fall in either case. Confidence describes how strongly the available evidence supports the estimate.</p>
          {loading ? <p role="status">Loading the saved call…</p>
            : error ? <p role="status">{error} <button type="button" onClick={forecast.reload} className="underline">Try again</button></p>
            : prediction && probability !== null && (
              <div className="border-l-2 border-primary pl-3">
                <p className="font-semibold">{reportTitle}{prediction.targetDate && ` · ${schoolDateLabel(prediction.targetDate, true)}`}</p>
                <p>{probability}% chance of a snow day{final?.confidence_level && ` · ${final.confidence_level.replace(/_/g, ' ')} confidence`}</p>
                {prediction.timestamp && <p className="text-xs text-muted-foreground">Saved {forecastUpdateLabel(prediction.timestamp, true)}</p>}
                {factor && <p className="mt-2">{factor}</p>}
                {final?.decision_rationale && <details className="record-disclosure mt-2">
                  <summary>Read the reasoning behind this call</summary>
                  <Markdown content={final.decision_rationale} />
                </details>}
              </div>
            )}
          <p>While forecasting is active, Blizzard schedules updates for 9:17 a.m., 1:17 p.m. and 6:17 p.m. Eastern. If fresh weather for the school date is unavailable, the last saved call can still be on screen. Check the date on the <a href="#forecast" className="underline">forecast</a>.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h3 data-slot="card-title">Who wins the face-off?</h3></CardHeader>
        <CardContent className="space-y-3 text-sm leading-6">
          <p>Blizzard makes its call independently of the RHS statistics class. Once the outcome is recorded, the closer forecast earns a daily win. On a snow day, the target is 100%. On a school-open day, it’s 0%.</p>
          <p>If Blizzard calls 89% and the class calls 98%, the class wins on a snow day. Blizzard wins if school opens. Equal calls tie.</p>
          <p><a href="#competition" className="underline">See the head-to-head standings</a> or <a href="#past-calls" className="underline">check past calls against the results</a>.</p>
        </CardContent>
      </Card>
    </div>
  )
}
