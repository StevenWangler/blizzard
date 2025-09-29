# Copilot Instructions for snowday-forecast

## Project Overview
This is a React + Vite web application for forecasting snow days, using a modular component architecture. The project is designed for rapid prototyping and experimentation, with a focus on UI/UX and community-driven prediction features.

## Architecture & Key Patterns
- **Entry Point:** `src/main.tsx` bootstraps the app, loading `App.tsx` as the root component.
- **Component Organization:**
  - General components are in `src/components/`
  - UI primitives (buttons, dialogs, etc.) are in `src/components/ui/` and follow a consistent, reusable pattern.
  - Feature views (e.g., `PredictionView`, `CrowdView`, `HistoryView`) encapsulate major app sections.
- **Hooks:** Custom React hooks are in `src/hooks/` (e.g., `use-theme`, `useWeatherTheme`).
- **Styling:**
  - Uses Tailwind CSS (`tailwind.config.js`, `src/main.css`, `src/styles/theme.css`).
  - Theme switching is handled via `ThemeToggle` and related hooks.
- **Utilities:** Shared logic lives in `src/lib/` (e.g., `utils.ts`, `weather.ts`).

## Developer Workflows
- **Start Dev Server:**
  ```sh
  npm install
  npm run dev
  ```
- **Build for Production:**
  ```sh
  npm run build
  ```
- **Preview Production Build:**
  ```sh
  npm run preview
  ```
- **No formal test suite is present.**

## Conventions & Patterns
- **Component Naming:** Use PascalCase for components. UI primitives are named after their function (e.g., `Button`, `Dialog`).
- **Props:** Favor explicit props; avoid spreading unless necessary for flexibility.
- **State Management:** Local state via React hooks; no global state library is used.
- **Error Handling:** Use `ErrorFallback.tsx` for top-level error boundaries.
- **Theme Management:** Use `use-theme` and `ThemeToggle` for dark/light mode.
- **Prediction Logic:** Encapsulated in `PredictionView` and `VotingWidget`.

## Integration Points
- **External:**
  - Tailwind CSS for styling
  - Vite for build tooling
- **Internal:**
  - All cross-component communication is via props and hooks; no context or Redux.

## Examples
- To add a new UI primitive, place it in `src/components/ui/` and follow the pattern in `button.tsx` or `dialog.tsx`.
- To add a new feature view, create a component in `src/components/` and import it in `App.tsx`.

## References
- `src/App.tsx` — main app layout and routing
- `src/components/ui/` — UI primitives
- `src/hooks/` — custom hooks
- `src/lib/` — shared utilities
- `tailwind.config.js` — Tailwind setup
- `vite.config.ts` — Vite setup

---
**For AI agents:**
- Follow the above conventions for new code.
- Reference existing components for style and structure.
- Prefer composition over inheritance.
- Ask for clarification if a pattern is unclear or missing.
