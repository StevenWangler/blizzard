# Blizzard’s forecaster

The scheduled workflow and local generator use one OpenAI agent for each forecast. The browser reads saved reports. The earlier specialist and debate records remain readable in archived reports.

## From weather to probability

1. The generator chooses the next school date in district time, skipping weekends and recorded days off. The scheduled run fetches fresh hourly weather and active alerts from the National Weather Service for Rockford. It requires coverage of the target date.
2. The forecaster receives hourly weather for the target date and preceding day, provider alerts and the issue time. It considers snow, freezing precipitation, refreeze, visibility and extreme cold during bus hours. It can use hosted web search for a dated, geographically relevant report when one could change the probability. The prompt requires it to distinguish observed roads from forecast hazards.
3. The SDK checks the structured output. The generator validates the final forecast and saves the probability, rationale, morning weather measurements and full provider response alongside the pending outcome. Missing hourly measurements stay unknown. An unsuccessful run preserves the last valid snapshot.

The generator defaults to GPT-5.2 with high reasoning. Set `OPENAI_FORECAST_MODEL` to select a different model. Existing coordinator-model configuration is accepted as a fallback. A transient failure gets one additional attempt under a shared deadline. Each attempt is metered.

## Running and checking

- `npm run generate-prediction:local` writes a real forecast to `public/data/local/` and a private report to `logs/forecast-costs/`. It requires a server-side OpenAI key. Locally, an optional WeatherAPI key enables that provider for supported forecast dates.
- `npm run compare:reasoning -- <saved-prediction.json>` compares high and low effort on frozen weather without web access. It writes cost reports only and requires an OpenAI key.
- `npm test` exercises the normal generator and comparison entry points with offline providers.

See [forecast replay and evaluation](FORECAST_REPLAY.md) for competition scoring and the prior multi-agent reasoning trial.
