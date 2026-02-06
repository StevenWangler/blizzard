# Mobile QA Checklist

This checklist defines acceptance criteria for the mobile usability refresh in core tabs:
- Home
- Details
- Accuracy
- History

## Viewport Matrix

Test each scenario at these viewport sizes:

| Label | Width x Height | Device Class |
|---|---:|---|
| Small Legacy | 320 x 568 | iPhone SE (1st gen baseline) |
| Standard iPhone | 375 x 812 | iPhone X/13 mini class |
| Large iPhone | 390 x 844 | iPhone 12/13/14 class |
| Plus Android | 412 x 915 | Pixel/Android large phones |
| Breakpoint -1 | 767 x 1024 | Tablet portrait below md |
| Breakpoint | 768 x 1024 | Tablet portrait at md |

## Navigation and Layout Checks

1. At widths 639, 640, and 767:
   - Pass: mobile bottom nav is visible.
   - Pass: desktop tab strip is hidden.
2. At width 768:
   - Pass: desktop tab strip is visible.
   - Pass: mobile bottom nav is hidden.
3. In Home, Details, Accuracy, and History at 320/375/390/412 widths:
   - Pass: no horizontal page scrolling.
   - Pass: no clipped text in cards, tabs, badges, or headers.
4. Header controls:
   - Pass: controls do not overlap title/subtitle on mobile.
   - Pass: tap targets are at least 44 x 44 CSS pixels.

## Interaction Checks

1. Theme control on mobile:
   - Pass: opens as drawer.
   - Pass: all actions are reachable without clipping near gesture bar.
2. Notification control on mobile:
   - Pass: opens as drawer.
   - Pass: status toggle and slider are fully interactive.
3. Details page:
   - Pass: Expert Analysis uses accordions on mobile.
   - Pass: first accordion panel is open by default.
4. Recommendations on Details:
   - Pass: uses accordions on mobile (Schools/Residents/Authorities).
   - Pass: first panel is open by default.
5. Accuracy charts:
   - Pass: mobile shows summary-first with collapsed chart sections.
   - Pass: desktop shows charts directly.
6. History header controls:
   - Pass: search, refresh, and counts wrap cleanly on narrow screens.

## Motion and Visual Budget Checks

1. Mobile atmosphere:
   - Pass: particle budget appears reduced versus desktop.
   - Pass: heavy glow/shimmer effects are reduced/disabled.
2. Home hero:
   - Pass: CTA is full-width on mobile and readable.
   - Pass: orb and hero block do not dominate viewport height.
3. Pointer behavior:
   - Pass: hover scaling effects are not triggered on coarse/touch-only interactions.
4. `prefers-reduced-motion`:
   - Pass: non-essential animation is reduced/disabled.

## Safe-Area Checks

On iOS-style viewport-fit devices (or emulator):
1. Bottom nav:
   - Pass: icons and labels sit above home indicator.
2. Drawers:
   - Pass: final action rows are fully visible and tappable.

## Lighthouse Targets (Mobile Profile)

Run Lighthouse in mobile emulation for Home and one dense tab (Details or Accuracy):

- Performance: >= 80
- Accessibility: >= 95
- Best Practices: >= 95

Additional performance gate:
- No new long task > 200ms during initial Home render under throttled mobile profile.

## Exit Criteria

The mobile refresh is accepted only when all pass conditions above are met on the viewport matrix and Lighthouse targets are satisfied.
