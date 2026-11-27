<div align="center">

# ❄️ Blizzard

### *Know Before It Snows*

**AI-Powered Snow Day Predictions for Rockford, MI**

[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

[Live site](https://www.blizzardbot.ai/) • [Features](#-what-it-does) • [Quick Start](#-quick-start) • [Docs](./docs/)

---

</div>

## 🌨️ What It Does

Blizzard combines real-time weather data with intelligent prediction algorithms to forecast snow days with unprecedented accuracy. Built for the Rockford, MI community, it tracks weather patterns, analyzes historical outcomes, and delivers beautiful, weather-responsive predictions.

### ✨ Core Features

🎯 **Smart Predictions**  
Multi-factor AI analysis weighing snow accumulation, temperature, wind, visibility, and ground conditions

🌡️ **Real-Time Data**  
Scheduled forecasts use National Weather Service hourly outlooks and alerts for Rockford.

🎨 **Dynamic Theming**  
UI morphs with weather conditions—from sunny brightness to blizzard darkness

📊 **Accuracy Tracking**  
Historical analysis with Brier scores, probability calibration, and outcome logging

🔔 **Weather Alerts**  
Government-issued warnings and advisories integrated directly into the UI

📱 **Mobile-First**  
Responsive design optimized for phones, tablets, and desktops

## ⚡ Quick Start

### Installation

```bash
# Clone the repo
git clone <repository-url>
cd blizzard

# Install dependencies
npm install
```

### Configuration

Create `.env` in the project root:

```bash
# Needed only for local paid prediction generation
OPENAI_API_KEY=your_server_side_key

# Your location (default: Rockford, MI)
VITE_ZIP_CODE=49341

# Environment
VITE_BLIZZARD_ENV=development
```

### Run It

```bash
# Start dev server (localhost:5000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🏗️ How It's Built

### Tech Stack

```typescript
{
  "frontend": ["React 19", "TypeScript 5.7", "Vite 6"],
  "styling": ["Tailwind CSS 4", "Radix UI", "Framer Motion"],
  "data": ["WeatherAPI.com", "TanStack Query"],
  "icons": ["Phosphor Icons", "Heroicons"],
  "deployment": ["GitHub Pages", "GitHub Actions"]
}
```

### Architecture

**Component-Driven Design**
```
src/
├── components/
│   ├── PredictionView.tsx    # Main forecast interface
│   ├── AccuracyView.tsx       # Historical tracking
│   ├── HistoryView.tsx        # Past outcomes
│   ├── AgentsView.tsx         # How the forecast is made
│   └── ui/                    # Radix primitives
├── services/
│   ├── weather.ts             # Core weather logic
│   ├── weatherApi.ts          # API client
│   └── weatherProcessing.ts   # Data transformation
├── hooks/
│   ├── useWeatherTheme.ts     # Dynamic theming
│   └── useNotifications.ts    # Alert system
└── types/
    └── weatherTypes.ts        # TypeScript definitions
```

**Smart Features**
- 🧠 Single-agent snow-day forecasts
- 📈 Real-time accuracy calibration
- 🎭 Weather-reactive UI themes
- 🔄 Automatic GitHub Actions workflows
- 💾 Client-side data persistence

## 📚 Documentation

| Resource | Description |
|----------|-------------|
| [📖 **Docs Index**](./docs/README.md) | Complete documentation hub |
| [🌡️ **Weather API**](./docs/WEATHER_API_README.md) | Integration guide & API details |
| [🚀 **Deployment**](./docs/DEPLOYMENT_GUIDE.md) | Deploy to GitHub Pages & more |
| [📋 **PRD**](./docs/PRD.md) | Product requirements & goals |
| [🤖 **AI Agents**](./docs/AI_AGENT_SYSTEM.md) | Single-forecaster workflow |

## 🎯 The Prediction Algorithm

One forecaster weighs hourly weather and dated local evidence for the next school morning. It returns a validated probability, confidence level and explanation. Each run records its estimated API cost.

## 🛠️ Development

### Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server on port 5000 |
| `npm run build` | Typecheck and production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run build:release` | Validate private release inputs and build; does not publish |
| `npm test` | Frontend and backend regression tests |
| `npm run verify:dist` | Verify release asset boundaries |
| `npm run preview:refresh` | Replace the three preview files in `public/data/local/` with the latest snapshot from the `blizzard-data` branch on origin |
| `npm run generate-prediction` | Generate a forecast in the local preview (uses the configured provider credentials) |

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | For generation | - | Server-side model credential |
| `WEATHER_API_KEY` | Optional | - | Alternate server-side weather provider for local runs |
| `VITE_ZIP_CODE` | ⚪ Optional | `49341` | Location (ZIP/postal code) |
| `VITE_BLIZZARD_ENV` | ⚪ Optional | `production` | Environment setting |

### Debug Tools

**Built-in Debug Panel** (Accuracy tab)
- ✅ API configuration validator
- 🧪 Integration test runner
- 📊 Detailed weather analysis viewer
- 🔄 Mock data toggle for offline dev

## 🎨 Weather-Reactive Themes

The UI dynamically responds to current weather conditions:

| Condition | Theme Colors | Vibe |
|-----------|--------------|------|
| ☀️ **Clear** | Bright blues & yellows | Optimistic, energetic |
| 🌨️ **Light Snow** | Cool blues & whites | Calm, anticipatory |
| ❄️ **Heavy Snow** | Deep blues & grays | Serious, focused |
| 🌬️ **Blizzard** | Dark purples & blacks | Dramatic, intense |

Themes affect backgrounds, cards, buttons, and even animation speeds!

## 📊 Accuracy & Insights

**Track Everything**
- 📈 Historical prediction accuracy
- 🎯 Brier score calculations
- 📉 Calibration curve visualization
- 📝 Manual outcome logging
- 🔍 Per-forecast API cost reports

**Automated Workflows**
- Daily prediction generation via GitHub Actions
- Automatic outcome recording
- Historical data aggregation
- Performance trend analysis

## 🔒 Security & Privacy

The site serves public saved forecasts. Weather/model requests run in trusted Actions jobs with server-side secrets; browser builds expose only reviewed public configuration. Outcome changes require authenticated GitHub automation, not a frontend maintenance PIN. Public JSON includes outcome notes, so never enter private information there. No analytics or user accounts were added.

See the [release guide](docs/DEPLOYMENT_GUIDE.md) for scheduled generation, private music delivery and archive recovery.

## 🚀 Deployment Options

Deploy Blizzard anywhere static sites are hosted:

### GitHub Pages (Recommended)
Deployment uses the reviewed `Deploy Site` GitHub Actions workflow at the custom-domain root. Local generation/build commands never publish. Release, private music delivery, credentials and workflow activation require the separate gates in [the deployment guide](docs/DEPLOYMENT_GUIDE.md).

### Other Platforms
- **Vercel**: One-click import from GitHub
- **Netlify**: Drag & drop `dist/` folder
- **Cloudflare Pages**: Connect repo & deploy
- **AWS S3 + CloudFront**: Upload build artifacts

See the [Deployment Guide](./docs/DEPLOYMENT_GUIDE.md) for detailed instructions.

## 🤝 Contributing

We welcome contributions from the community! Here's how:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/epic-addition`
3. **Commit** your changes: `git commit -m '✨ Add epic feature'`
4. **Push** to your fork: `git push origin feature/epic-addition`
5. **Submit** a pull request

### Contribution Ideas
- 🎨 New weather themes
- 📊 Enhanced data visualizations
- 🌍 Multi-location support
- 🔔 Push notification system
- 🧪 Comprehensive test suite

## 📜 License

MIT License - see [LICENSE](LICENSE) for details.

Feel free to use, modify, and distribute this project. Just keep it open source!

## 🙏 Built With

<div align="center">

| Tool | Purpose |
|------|---------|
| [React](https://react.dev/) | UI framework |
| [TypeScript](https://www.typescriptlang.org/) | Type safety |
| [Vite](https://vitejs.dev/) | Build tool |
| [Tailwind CSS](https://tailwindcss.com/) | Styling |
| [Radix UI](https://www.radix-ui.com/) | Component primitives |
| [Framer Motion](https://www.framer.com/motion/) | Animations |
| [WeatherAPI.com](https://www.weatherapi.com/) | Weather data |
| [Phosphor Icons](https://phosphoricons.com/) | Icon system |

</div>

## 💬 Questions?

- 📖 Check the [docs](./docs/)
- 🐛 [Open an issue](../../issues)
- 💡 [Start a discussion](../../discussions)

---

<div align="center">

### ❄️ *Built with passion for snow days in Rockford, MI* ❄️

**Stay warm. Stay informed. Stay ready for that perfect snow day.**

[⬆ Back to Top](#-blizzard)

</div>
