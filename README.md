<div align="center">

# ❄️ Blizzard

### *Know Before It Snows*

**AI-Powered Snow Day Predictions for Rockford, MI**

[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

[Live Demo](#) • [Features](#-what-it-does) • [Quick Start](#-quick-start) • [Docs](./docs/)

---

</div>

## 🌨️ What It Does

Blizzard combines real-time weather data with intelligent prediction algorithms to forecast snow days with unprecedented accuracy. Built for the Rockford, MI community, it tracks weather patterns, analyzes historical outcomes, and delivers beautiful, weather-responsive predictions.

### ✨ Core Features

🎯 **Smart Predictions**  
Multi-factor AI analysis weighing snow accumulation, temperature, wind, visibility, and ground conditions

🌡️ **Real-Time Data**  
Live weather integration via WeatherAPI.com with 48-hour forecasting and government alerts

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
# Get your free key: https://www.weatherapi.com/signup.aspx
VITE_WEATHER_API_KEY=your_api_key_here

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
│   ├── AgentsView.tsx         # AI prediction agents
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
- 🧠 Multi-agent AI prediction system
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
| [🤖 **AI Agents**](./docs/AI_AGENT_SYSTEM.md) | Multi-agent prediction system |

## 🎯 The Prediction Algorithm

Blizzard uses a sophisticated multi-factor weighting system:

```typescript
const predictionFactors = {
  snow: 0.35,              // Probability & accumulation
  temperature: 0.20,       // Temperature & wind chill
  wind: 0.20,              // Wind speed & gusts
  visibility: 0.15,        // Visibility conditions
  ground_conditions: 0.10  // Humidity, pressure, etc.
}
```

**Decision Thresholds**
- 🟢 **0-30%**: Low probability—pack your backpack
- 🟡 **31-60%**: Moderate—keep an eye on updates
- 🟠 **61-80%**: High—start planning that day off
- 🔴 **81-100%**: Very high—it's happening!

### AI Agent System

Multiple specialized agents analyze weather data:
- **Conservative Agent**: Risk-averse predictions
- **Balanced Agent**: Moderate approach
- **Aggressive Agent**: Optimistic forecasts
- **Ensemble**: Weighted combination of all agents

## 🛠️ Development

### Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server on port 5000 |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run deploy:github` | Deploy to GitHub Pages |
| `npm run generate-prediction` | Run AI prediction workflow |

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_WEATHER_API_KEY` | ✅ Yes | - | WeatherAPI.com API key |
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
- 🔍 Per-agent performance metrics

**Automated Workflows**
- Daily prediction generation via GitHub Actions
- Automatic outcome recording
- Historical data aggregation
- Performance trend analysis

## 🔒 Security & Privacy

✅ **What We Do**
- Store API keys in environment variables
- Use HTTPS for all API calls
- Process data client-side only
- No user tracking or analytics

❌ **What We Don't Do**
- Store personal information
- Share data with third parties
- Require authentication
- Track user behavior

## 🚀 Deployment Options

Deploy Blizzard anywhere static sites are hosted:

### GitHub Pages (Recommended)
```bash
npm run deploy:github
```
Includes automated workflows for daily predictions!

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
- 🤖 Additional AI prediction agents
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
