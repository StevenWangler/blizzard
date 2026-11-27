# Forecast credentials

The site, tests and public NWS weather feed work without API keys. A real prediction requires an OpenAI API key with model access and billing enabled.

Set `OPENAI_API_KEY` in your local environment or in an ignored `.env` at the repository root. For a local forecast, run `npm run generate-prediction:local`. Look in `logs/forecast-costs/` for the estimated cost. An optional server-side `WEATHER_API_KEY` selects WeatherAPI when it can supply the exact target date.

GitHub Actions reads the repository’s `OPENAI_API_KEY` secret during scheduled generation. Use the provider dashboard to revoke or replace compromised keys. Keep all credentials out of browser build variables. [OpenAI API keys](https://platform.openai.com/api-keys)
