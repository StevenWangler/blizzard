# Local forecast broadcast and ticker

The optional **Watch forecast** control leaves Today’s chance/day/why readable. A current report with supported period and weather facts produces a 27-second broadcast: Rockford opening (4s), outlook (7s), overnight/morning (6s), reasons (6s), closing (4s). Missing sections are omitted; a missing or stale report gets an explicit 20-second no-current-forecast sequence. Playback stops at the closing card and offers Replay.

Pause, Previous/Next, left/right keyboard arrows and horizontal pointer swipes work without starting another player. Manual navigation pauses the cycle. Read all provides a static scrollable alternative; reduced motion opens that view by default and disables timed playback. Background/pagehide pauses, and return does not resume automatically. The dialog has 44px controls, Escape dismissal, retained focus, bounded scrolling and dynamic viewport sizing. No card changes are live-announced.

Today uses a 4:3 forecast panel with a fixed school-status bar and links to the optional broadcast, forecast details, and archive. Phones use a compact forecast with full-width actions and a safe-area-aware bottom navigation bar. The ticker remains above the content on desktop supporting pages. On phones, Forecast shows its weather readings in the report and Past Calls shows a searchable list of expandable archive records. Its right-to-left crawl contains only the saved report’s verified date, chance, one weather fact and update time, plus location and the district-decides caveat. Missing/stale states replace the old chance and weather with an explicit status. Tap LOCAL to pause/resume; paused or reduced-motion text can be scrolled horizontally with touch or keyboard. Repeated visual text is hidden from assistive technology; there is no live region announcing each pass. It pauses behind the mobile More drawer, maintainer dialog and game. Primary facts remain available elsewhere.

## Data boundaries

`forecastBroadcast.ts` uses the same freshness/date/probability helpers as Today. Current structured fields support overnight low and morning high; the saved schema does not supply a verified exact school-start observation, so none is invented. Up to three supported snow/precipitation, wind and overnight-feels-like facts become reasons. Unknown values are omitted rather than padded. Freezing rain is not hidden behind zero snowfall. Current district notes in the report remain visible and labeled as report content. The forecast estimate is separate from the district’s closure decision.

There are no live weather/model calls, fabricated radar, fabricated update schedules or new backend jobs. Today and the ticker share one saved-report load. Freshness is recomputed each minute and after returning to the tab; that does not fetch or promise new data. The existing default-on music player, explicit pause preference, private licensed MP3 and exact About credit remain unchanged.

## Seasonal standby and other surfaces

The existing `VITE_BLIZZARD_ACTIVE` / maintainer-preview rules are unchanged. Public off-season access still blocks forecast routes, navigation and music. The gate now uses the same blue/yellow station identity and says forecasts are off air until the season is reactivated. The unsupported November 1 countdown and monitoring promise were removed. About’s schedule copy distinguishes scheduled runs from successful updates, consistent with the existing workflow’s active flag.

The supporting cards, disclosures, menus, drawers, loading/error states and game’s separate phone portal use the shared colors, bitmap headings and hard edges. The game’s mechanics and original Ram artwork were preserved.

## Custom illustration

Built-in image generation now supplies a photorealistic winter school/river scene for the optional opening and seasonal standby. It is a fictional Michigan-inspired setting, not an actual Rockford photograph or current weather. The original is preserved at `generated_images/exec-5bb76adb-2fef-400f-ae11-83e2086b1776.png`. Responsive WebP assets at `public/images/broadcast/winter-school-river-v2-640.webp` (62,788 bytes) and `winter-school-river-v2-1280.webp` (230,634 bytes) retain the same 2:1 composition. Both placements use srcset/sizes and keep the visible **Illustration · not current conditions** caption. No UI text, numbers or data graphics are baked into the scene. The opening image is not requested by the closed Watch dialog. Previous pixel-art source and `rockford-opening-v1.webp` remain intact for rollback.

Current image prompt, provenance, native screenshot identities and verification are in `output/realistic-image-verification/`; the earlier pixel-art/broadcast milestone remains in `output/broadcast-verification/`. No publication or deployment is authorized by this local milestone.

## Today backdrop

Today uses a separate 4:3 winter illustration generated with the built-in image tool. The fictional school and river establish the local setting. CSS handles the cobalt overlay and scanlines so forecast text stays accessible and sourced from the saved report. The responsive assets are `public/images/broadcast/local-forecast-winter-640.webp` and `public/images/broadcast/local-forecast-winter-1280.webp`.

Image prompt

> Use case: photorealistic-natural. Asset: Blizzard local cable-weather forecast background only. Create a 4:3 landscape still of a fictional small-town West Michigan winter morning, inspired by the approved view of a brick school across a calm river. Eye-level from opposite bank. A modest historic brick school centered across the river among bare hardwoods and a few snow-dusted pines. Calm reflective river in the lower quarter. Quiet overcast sky and low-contrast atmosphere in the upper third. Photographic realism like an original early-2000s regional TV camera still, with soft cool blue-hour light and subtly muted local color. Keep the central visual tones soft and even for large white and yellow live forecast text composited later. Preserve natural winter detail and avoid an exaggerated snowstorm. Original fictional scene, no readable signage, text, people, logos, graphics, borders, scanlines, or overlays.
