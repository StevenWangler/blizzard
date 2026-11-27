import type { ReactNode } from 'react'
import { forecastFreshness, forecastReason, forecastUpdateLabel, schoolDateLabel } from '@/lib/forecastPresentation'
import { normalizeProbability } from '@/services/outcomes'
import type { AgentPrediction } from '@/types/agentPrediction'
import { WatchForecast } from '@/components/WatchForecast'

interface TodayForecastProps {
  prediction: AgentPrediction | null
  onNavigateToDetails: () => void
  children?: ReactNode
  onNavigateToHistory: () => void
}

const backdrop = `${import.meta.env.BASE_URL}images/broadcast/`

export function TodayForecast({ prediction, onNavigateToDetails, onNavigateToHistory, children }: TodayForecastProps) {
  const probability = normalizeProbability(prediction?.final?.snow_day_probability)
  const freshness = forecastFreshness(prediction?.timestamp, prediction?.targetDate)
  const current = freshness === 'current'
  const hasEstimate = current && probability !== null
  const date = schoolDateLabel(prediction?.targetDate)
  const hasLastForecast = freshness === 'archived' && date !== 'School-morning outlook'
  const headline = hasEstimate ? 'Chance of a snow day' : current ? 'Chance unavailable' : freshness === 'archived' ? 'No forecast yet' : 'No current forecast'
  const message = current ? 'No snow-day estimate has been posted for this date.' : freshness === 'archived' ? 'For the next school day.' : 'We can’t verify the date and time of this forecast.'

  return (
    <div className="station-today">
      <section className="local-broadcast" aria-labelledby="today-verdict">
        <header className="local-broadcast-title">
          <span>Local forecast</span>
          {current ? <time dateTime={prediction?.targetDate}>{date}</time> : freshness === 'archived' ? <span>Next school day</span> : null}
        </header>
        <div className="local-broadcast-screen">
          <picture className="local-broadcast-art" aria-hidden="true">
            <source media="(max-width: 767px)" srcSet={`${backdrop}local-forecast-winter-640.webp`} />
            <img
              src={`${backdrop}local-forecast-winter-1280.webp`}
              srcSet={`${backdrop}local-forecast-winter-640.webp 640w, ${backdrop}local-forecast-winter-1280.webp 1280w`}
              sizes="(min-width: 1024px) 710px, 70vw"
              width={1280}
              height={960}
              decoding="async"
              alt=""
            />
          </picture>
          <div className="local-broadcast-copy">
            <p className="local-broadcast-district">Rockford Public Schools</p>
            <h2 id="today-verdict" className={hasEstimate ? 'local-broadcast-chance' : undefined}>{headline}</h2>
            {hasEstimate && <strong className="local-broadcast-probability"><span>{probability}</span><small>%</small></strong>}
            <p className="local-broadcast-summary">{hasEstimate ? forecastReason(prediction) : message}</p>
          </div>
        </div>
      </section>
      <aside className="station-today-rail" aria-label="Forecast links">
        <section className="station-link-box">
          <h3>Forecast center</h3>
          <WatchForecast prediction={prediction} />
          {(current || hasLastForecast) && (
            <button type="button" onClick={onNavigateToDetails} className="station-link">
              <span aria-hidden="true">»</span>
              <span>{hasEstimate ? 'Why this chance?' : current ? 'Weather details' : `Last forecast: ${schoolDateLabel(prediction?.targetDate, true)}`}</span>
              {hasEstimate && <small>Updated {forecastUpdateLabel(prediction?.timestamp)}</small>}
            </button>
          )}
        </section>
        {children}
        <section className="station-link-box station-archive-box">
          <h3>Forecast archive</h3>
          <button type="button" onClick={onNavigateToHistory} className="station-link">
            <span aria-hidden="true">»</span><span>Past calls</span>
          </button>
        </section>
      </aside>
    </div>
  )
}
