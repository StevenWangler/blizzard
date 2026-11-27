import type { AgentPrediction } from '@/types/agentPrediction'
import { normalizeProbability, readOutcomeProbability } from '@/services/outcomes'
import { reportWeather, forecastFreshness, forecastReason, forecastUpdateLabel, schoolDateLabel, studentOutlook } from '@/lib/forecastPresentation'

interface FallbackForecast {
  snowfall: number
  windSpeed: number
  visibility: number
  temperature: number
  alerts: string[]
  modelProbability: number
  lastUpdated: string
}

export function ForecastBrief({ prediction, fallback }: { prediction: AgentPrediction | null; fallback: FallbackForecast | null; nextRefresh: string }) {
  const timestamp = prediction?.timestamp ?? fallback?.lastUpdated
  const freshness = forecastFreshness(timestamp, prediction?.targetDate)
  const rawProbability = prediction?.final?.snow_day_probability ?? fallback?.modelProbability
  const readProbability = prediction && freshness === 'archived' ? readOutcomeProbability : normalizeProbability
  const probability = freshness === 'unknown' ? null : readProbability(rawProbability)
  const outlook = studentOutlook(probability)
  const metric = (value: number | undefined, unit: string) => typeof value === 'number' && Number.isFinite(value) ? `${Number(value.toFixed(1))}${unit}` : '—'
  const weather = reportWeather(prediction)
  const signals = [
    { label: 'Snowfall', value: metric(weather.snowInches ?? fallback?.snowfall, ' in') },
    { label: 'Wind', value: metric(weather.maxWindMph ?? fallback?.windSpeed, ' mph') },
    { label: prediction ? 'Overnight low' : 'Temperature', value: metric(weather.overnightLowF ?? fallback?.temperature, '°F') },
    { label: 'Visibility', value: metric(weather.minVisibilityMiles ?? fallback?.visibility, ' mi') },
  ]
  const alerts = prediction ? weather.alerts : fallback?.alerts ?? []
  const generatedLabel = forecastUpdateLabel(timestamp, true)
  const dateLabel = schoolDateLabel(prediction?.targetDate, freshness !== 'current')

  return <div className="forecast-brief-content">
    <section className="forecast-school-brief" aria-labelledby="forecast-verdict">
      <header className="forecast-brief-strip">
        <p className="forecast-date">{dateLabel === 'School-morning outlook' ? 'Forecast date unavailable' : dateLabel}</p>
      </header>
      <div className="forecast-brief-readout">
        {freshness !== 'current' && <p className="forecast-saved-notice" role="status">{freshness === 'archived' ? 'Earlier estimate' : 'We can’t verify this forecast’s date and time.'}</p>}
        <div className="forecast-verdict-row">
          <h3 id="forecast-verdict">{probability === null ? 'Chance unavailable' : 'Chance of a snow day'}</h3>
          <div className="forecast-mini-probability"><strong>{probability ?? '—'}{probability !== null && <small>%</small>}</strong><span>{freshness === 'archived' ? 'for this date' : 'estimate'}</span></div>
        </div>
        {freshness === 'current' && probability !== null && <p className="forecast-takeaway">{outlook.headline}.</p>}
        {prediction && <p className="forecast-brief-reason">{forecastReason(prediction)}</p>}
        <p className="forecast-district-note">Forecast only. Rockford Public Schools makes the final call.</p>
      </div>
      <div className="forecast-report-meta"><span>{generatedLabel === 'Update time unavailable' ? generatedLabel : `Updated ${generatedLabel}`}</span></div>
    </section>
    {alerts.length > 0 && <section className="forecast-alerts" aria-labelledby="forecast-alert-title"><h3 id="forecast-alert-title">Weather alerts in this report</h3><ul>{alerts.map((alert, index) => <li key={index}>{alert}</li>)}</ul></section>}
    <section className="forecast-weather" aria-labelledby="forecast-weather-title">
      <h3 id="forecast-weather-title">The morning weather</h3>
      <dl className="forecast-signals">{signals.map(signal => <div key={signal.label}><dt>{signal.label}</dt><dd>{signal.value}</dd></div>)}</dl>
    </section>
  </div>
}
