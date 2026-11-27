import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'
import { WeatherThemeProvider } from './hooks/useWeatherTheme.ts'

import "./main.css"
import "./styles/theme.css"
import "./index.css"
import "./styles/cable-weather.css"
import "./styles/forecast-program.css"
import "./styles/station.css"
import "./styles/station-pages.css"

createRoot(document.getElementById('root')!).render(
  <WeatherThemeProvider>
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <App />
    </ErrorBoundary>
  </WeatherThemeProvider>
)
