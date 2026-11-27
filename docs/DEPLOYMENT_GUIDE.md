# Releasing Blizzard

GitHub Pages serves the site at https://www.blizzardbot.ai/. Merge reviewed site and generator changes into `main`. The Pages workflow builds the reviewed code, fetches the current forecast snapshot, and includes the licensed music. It checks both Git revisions again before publishing.

## What the runner needs

| Setting | Purpose |
| --- | --- |
| Actions secret `OPENAI_API_KEY` | Used by the forecast generation step only. |
| Actions secret `BLIZZARD_MEDIA_DEPLOY_KEY` | Read-only SSH deploy key scoped to the private release-media repository. |
| Repository variable `BLIZZARD_RELEASE_READY=true` | Enables Pages builds on main pushes and deployment requests. |
| Repository variable `BLIZZARD_AUTOMATION_WRITES_APPROVED=true` | Enables forecast and outcome writers on the data branch. |
| Repository variable `BLIZZARD_SEASON_ACTIVE=true` | Enables scheduled prediction attempts and the in-season site. Set false to pause and dispatch Deploy Site to update the site. |

The scheduled workflow uses public NWS hourly weather and alerts for Rockford. It needs no weather-provider key. Keep provider credentials server-side. Revoke any previously exposed credentials at their issuer.

## Forecasts and archive

The **Generate Blizzard Prediction** workflow attempts one forecast at 9:17 a.m., 1:17 p.m. and 6:17 p.m. Detroit time, including across daylight saving changes. GitHub can delay scheduled jobs. The generator skips weekends, recorded days off and the configured district breaks when selecting the next school date. It skips a target beyond the provider horizon and rejects an incomplete target-day forecast. Each completed model run has an estimated cost report in its workflow artifacts.

`blizzard-data` stores exactly three files under `public/data` — prediction.json, summary.json and outcomes.json. Its history continues from the pre-cutover main archive. The release and outcome workflows run code from main. They restore the three JSON blobs and validate the ledger before use. Writers share a GitHub concurrency queue, compare their input revision with the current data branch, and push a fast-forward commit only when the data changed. A conflicting write requires a fresh run. Successful changes dispatch Deploy Site. Main keeps its code-owner review requirement.

For class submissions use **Log Blizzard Outcome** on main. Lock the matchup at submission and record the school decision separately. Stored percentages use the 0–100 scale, including historical fractional values. Before correcting a published entry, inspect the data history. Use the outcome workflow for ordinary corrections. [Replay and scoring](FORECAST_REPLAY.md)

## Local verification and release

Use Node 22.12+ and run `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` and `npm run verify:dist`. PR CI performs these checks without private media or provider credentials.

For a release build, supply the licensed file at `.local-assets/music/fireside-romance.mp3`, then run `npm run build:release` and `npm run verify:dist`. The deploy workflow obtains the pinned file with the read-only deploy key and verifies its size and SHA-256. The asset manifest excludes preview data, raw artwork and source credentials. [Music and attribution](FORECAST_MUSIC.md)

After merge, check the **Deploy Site** run for the reviewed revision and the live Today screen. Check the next scheduled **Generate Blizzard Prediction** run, its cost report, the new data commit and its follow-up Pages deployment. A failed generation leaves the previous published snapshot available.
