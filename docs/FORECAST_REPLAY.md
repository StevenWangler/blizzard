# Ice and bus-route forecast replay

The candidate runs offline with no model calls, web searches or writes to public data. To reproduce the November 2026 review in a full checkout, run:

```sh
npm run replay:forecasts -- 4051863e2ee856eb051c559762741903157f5182
```

Omit the SHA to evaluate the ledger and saved forecasts at the current local `origin/blizzard-data` (older clones fall back to `origin/main`). The command prints the revision, scores, each day's inputs and probabilities, and dates excluded by reason.

## Results

Lower Brier score means smaller squared probability errors. Mean error is the average distance in percentage points from 100 on a closure and 0 on an open day. All four estimates use exactly the same dates.

| Forecast | All 38 days, Brier | Mean error | Eight later dates, Brier | Closer / farther / tied against RHS on 21 paired dates |
| --- | ---: | ---: | ---: | ---: |
| Blizzard as issued | 0.05618 | 14.11 | 0.05381 | 5 / 6 / 10 |
| Issued forecast plus ice timing | 0.05131 | 13.84 | 0.04031 | 5 / 6 / 10 |
| Issued forecast plus ice timing and route condition | 0.04742 | 13.50 | 0.03235 | 5 / 6 / 10 |
| Snowfall alone | 0.10632 | 16.58 | 0.11500 | 10 / 11 / 0 |

Only three percentages moved. On January 21, school stayed open and 18% rose to 25%. On January 27, school closed and 20% rose to 33%, still below the class's 50%. On February 6, school closed and 41% rose to 58%. There was no recorded RHS call for February 6. On January 22, the candidate still gave 18% on a closure because the last freezing precipitation in that forecast was at 3 a.m.

The eight dates after January 27 had one closure. That case was already known from the review. All of the improvement on the later dates came from that one forecast. The seven open days were independently verified from school-day events and provide limited coverage of icy mornings. Keep the candidate offline and evaluate the same rule on newly resolved storms, including icy days when school stays open.

## What is being tested

The challenger reads the saved hourly forecast from 9 p.m. the previous evening through 8 a.m. on the target day in Rockford. It looks for measurable freezing rain, freezing drizzle or sleet, or a freezing temperature within four hours after above-freezing rain. The experiment treats an ice signal at 4 a.m. or later as a short treatment window relative to the district's 5:30 a.m. decision and morning bus travel. The hourly clock and air temperature are proxies for road conditions. [District closing guidance](https://rockford-cdn.fxbrt.com/downloads/community-services/rampage_winter_2026.pdf)

The ice-only candidate multiplies the issued odds by 1.5 on those mornings. The combined candidate uses 2 instead when the archived infrastructure assessment also reports covered county roads or local streets with light or no plowing. These are fixed experimental weights. The archived assessment is a specialist estimate of road conditions. The snowfall-only benchmark uses 5%, 20%, 50% and 75% for forecast accumulations below 1 inch, 1 to under 3, 3 to under 6 and 6 or more over the same window.

## Forecast selection and outcome evidence

Both the forecast timestamp and its first-parent archive commit must precede the target date in Detroit. The replay requires the same target date, timestamp and probability in the summary and detailed forecast. A future locked matchup uses the exact submitted forecast. For historical class calls, submission times are unknown. Midnight is a reproducible proxy for those dates. It cannot prove what either team knew at an earlier deadline.

The original ledger supplies 32 resolved outcomes. November 28 has no eligible snapshot. January 20 has an incomplete hourly window. The replay adds eight evaluation labels without rewriting the 78 records. February 6 was a confirmed full-day closure. Completed school-day drills show that February 10, 11, 18, 19, 27 and March 6 and 20 each had students on site. School being open means there was no districtwide full-day closure. [District closure announcement](https://www.rockfordschools.org/pub/news/posts/1971) · [District drill records](https://www.rockfordschools.org/departments/security/2025-26-safety-drills/)

The replay also excludes scheduled days off, March 13 because the district announced its opening before the forecast, and 24 unresolved dates. The January examples motivated this candidate. The later dates are a chronological check, and a prospective winter sample is still needed. [Midwinter break dates](https://www.rockfordschools.org/pub/news/posts/2009) · [March 13 announcement](https://www.rockfordschools.org/pub/news/posts/2063)

## Recording future competition calls

At the agreed submission time, before the district announces its decision and before local midnight, dispatch **Log Blizzard Outcome** on main. Choose **lock-matchup**, enter the target school date and the RHS percentage. The workflow pairs it with the Blizzard forecast available in the data history at dispatch and records both percentages, the forecast issue time, dispatch time and revision. A later public update can change the live forecast. Competition scoring reads the frozen pair. Use the usual outcome action after the school decision.

Historical entries can still be scored from their recorded percentages and are marked as having no submission time. The standings count which team was closer each day and report ties. The class's official season points formula is unknown.

## Prospective road evidence study

For a new `lock-matchup`, the workflow reads the detailed forecast from the same Git revision as the published percentage. It freezes the published call, an ice-only estimate, and an ice-plus-roads estimate. The two experimental values live in the public outcome ledger for evaluation. Today and the competition standings continue to use the published Blizzard call.

When a dated road observation is available at the submission deadline, fill in all four optional fields:

| Field | What to enter |
| --- | --- |
| `road_class` | The class of the observed Rockford-area road: highway, county road, or local street. |
| `road_condition` | The surface condition or treatment explicitly reported by the source. A vehicle appearing on a map alone does not establish the road condition. |
| `road_observed_at` | The observation time with its UTC offset, for example `2026-01-26T18:30:00-05:00`. |
| `road_source` | A public HTTPS link identifying the report. Use public information only. |

Enter the latest applicable secondary-road observation if available. Highway observations can also be recorded. Leave all four fields blank when coverage is unknown. This version takes an operator-entered report at dispatch. Automated secondary-road coverage for Rockford has not been verified. MDOT describes its available data and access through RIDE. [MDOT real-time data exchange](https://www.michigan.gov/mdot/travel/safety/efforts/its/its-data)

**Version 1** tapers the added ice weight over the six hours before 5:30 a.m. The weight reaches its maximum for forecast ice during the bus run through 8 a.m. Earlier ice receives credit only when forecast air temperatures stay at or below freezing through the 5 a.m. reading. The saved weather window includes the first and last ice-signal hours, the type of the last signal, and the hour through which the air stays frozen after that signal. Hours are local to the school date, with negative hours denoting the preceding evening.

At maximum weight the trial multiplies the published odds by 1.5 for ice alone or 2 for ice with corroborating road evidence. The extra adjustment requires an icy or snow-covered county road or local street observed the preceding local day and within six hours before submission. A highway, treated or clear road, stale report, or missing observation adds no extra weight. Future-dated and partial reports are rejected. These windows and weights are experiment settings. School officials' actual morning road checks can take place hours after the class submits.

If the detailed weather is missing or incomplete, both experimental probabilities are stored as unknown and the official matchup can still be locked. The command `npm run replay:forecasts` reports these cases separately. Once an outcome is recorded in the data archive, the prospective section scores the **stored** values against RHS and compares roads directly with ice alone on icy open days and icy closure days. New versions of the algorithm cannot retroactively update a submitted call. Old submissions without this study retain their original meaning.

On the original 38 eligible dates the gradual ice-only rule scored 0.05009 Brier versus 0.05131 for the original ice-only rule and 0.05618 as issued. On the eight later dates the gradual rule scored 0.04331 versus 0.04031 for the original ice-only rule. This replay has no contemporaneously locked road reports, so it tests only the new ice timing. The prospective road study starts with zero scored matchups.

## Forecast cost and reasoning trials

The single forecaster reads compact hourly weather for the preceding day and target school date, plus provider alerts. The full provider response stays in the saved report for replay. One transient failure can be retried within the same eight-minute deadline.

Every generation or comparison arm writes its own cost report in `logs/forecast-costs/`, including failed attempts. GitHub Actions adds the estimate to its summary and retains the detailed report for 90 days. Reports include the architecture, model, reasoning effort, attempts, request counts, tokens, hosted searches and estimated charges.

Estimates use standard GPT-5.2 rates, $1.75 per million uncached input tokens, $0.175 per million cached input tokens and $14 per million output tokens. Reasoning tokens are included in output. Web searches are estimated at $0.01 each and a newly observed default 1 GB container at $0.03 for this bounded run. Weather-provider subscriptions and runner time are outside this OpenAI estimate. Requests with missing usage, unrecognized model prices or unsupported service tiers leave the total unknown; `pricedUsd` retains the portion that could be priced. [OpenAI model rates](https://developers.openai.com/api/docs/models/gpt-5.2) · [OpenAI tool rates](https://developers.openai.com/api/docs/pricing)

Run a paid, private comparison with a complete saved forecast:

```sh
npm run compare:reasoning -- public/data/local/prediction.json
```

Both arms run the single forecaster on the same saved weather and issue time, at high and low reasoning effort. Both disable search. Only weather inputs reach the model, including for snapshots from the earlier multi-agent system. Neither arm writes a prediction or modifies the ledger. Paired cost reports contain the input hash, probability and confidence. This measures reasoning effort on weather alone. Scheduled and local forecasts use high reasoning and may search for timely local evidence.

### Historical multi-agent trial

On November 26, 2026 the first frozen-evidence trial produced the following results. Dollar amounts are estimated OpenAI charges for the four reassessed roles and coordinator in each arm.

| School date | Outcome | High effort | Lower effort | High cost | Lower cost |
| --- | --- | ---: | ---: | ---: | ---: |
| Feb 6 | Closed | 35% | 30% | $0.218 | $0.171 |
| Feb 11 | Open | 12% | 12% | $0.203 | $0.158 |
| Nov 30 | Pending at trial time | 5% | 3% | $0.175 | $0.126 |

The two resolved dates scored 0.21845 Brier at high effort and 0.25220 at lower effort. Lower is better. Neither date had a paired RHS call. More prospective icy mornings, including closures, are needed before changing the production default.
