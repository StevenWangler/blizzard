# ❄️ Snow Day Predictor

A React + Vite web application for forecasting snow days, using real-time weather data and community-driven predictions. Built for rapid prototyping and experimentation with a focus on UI/UX and predictive modeling.

## 🌨️ Features

- **Real-time Weather Data**: Integration with WeatherAPI.com for accurate forecasting
- **Snow Day Predictions**: AI-powered probability calculations based on weather conditions
- **Community Voting**: Crowdsourced predictions from the community
- **Weather-Responsive Themes**: Dynamic UI themes that change based on weather conditions
- **Historical Analysis**: Track prediction accuracy over time
- **Weather Alerts**: Integration with government weather alerts
- **Mobile-Responsive**: Optimized for all device sizes

## 🚀 Quick Start

### 1. Installation

```bash
git clone <repository-url>
cd snowday-forecast
npm install
```

### 2. Configuration

Create a `.env` file in the project root:

```bash
# Required: Get your free API key from https://www.weatherapi.com/signup.aspx
VITE_WEATHER_API_KEY=your_weatherapi_key_here

# Optional: Your location (ZIP code for US, postal code for others)
VITE_ZIP_CODE=49341

# Optional: Environment setting  
VITE_BLIZZARD_ENV=development
```

### 3. Development

```bash
npm run dev
```

Open [http://localhost:5000](http://localhost:5000) to view the application.

### 4. Production Build

```bash
npm run build
npm run preview
```

## 📋 Architecture

### Core Components

- **App.tsx**: Main application layout with tab navigation
- **PredictionView**: Today's forecast and snow day probability
- **CrowdView**: Community voting and predictions
- **AccuracyView**: Historical accuracy tracking and debug panel
- **HistoryView**: Past weather events and outcomes

### Weather API System

The application includes a comprehensive weather API integration:

- **Real-time Data**: Live weather forecasts from WeatherAPI.com
- **Probability Calculations**: Sophisticated algorithms for snow day prediction
- **Error Handling**: Robust fallback systems and user-friendly error messages
- **Mock Data**: Realistic test data for development without API keys

## 📚 Documentation

Complete project documentation is available in the [docs folder](./docs/):

- **[📖 Documentation Index](./docs/README.md)** - Complete documentation overview
- **[🌡️ Weather API Integration](./docs/WEATHER_API_README.md)** - Weather system documentation
- **[🚀 Deployment Guide](./docs/DEPLOYMENT_GUIDE.md)** - Hosting and deployment instructions
- **[⚡ Quick Setup](./docs/PAGES_SETUP.md)** - Fast GitHub Pages deployment
- **[📋 Project Requirements](./docs/PRD.md)** - Product specifications and goals
- **[✅ Project Complete](./docs/PROJECT_COMPLETE.md)** - Implementation summary

### Styling & Theming

- **Tailwind CSS**: Utility-first CSS framework
- **Dynamic Themes**: Weather-responsive color schemes
- **Component Library**: Radix UI primitives with custom styling
- **Responsive Design**: Mobile-first approach

## 🛠️ Development

## 📁 Project Structure

```
snowday-forecast/
├── build-tools/              # Build and deployment scripts
│   ├── setup-deployment.mjs
│   ├── setup-keys.mjs
│   ├── validate-deployment.mjs
│   ├── create-test-data.mjs
│   └── generate-prediction.mjs
├── config/                   # Configuration files
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── components.json
│   ├── theme.json
│   └── runtime.config.json
├── docs/                     # Documentation
│   ├── README.md
│   ├── API_KEYS_SETUP.md
│   ├── DEPLOYMENT_GUIDE.md
│   ├── WEATHER_API_README.md
│   └── ...
├── public/                   # Static assets
├── src/                      # Source code
│   ├── components/           # React components
│   │   ├── ui/              # Reusable UI primitives
│   │   ├── PredictionView.tsx
│   │   ├── CrowdView.tsx
│   │   └── ...
│   ├── services/            # Business logic services
│   │   ├── weather.ts       # Main weather service
│   │   ├── weatherApi.ts    # WeatherAPI.com client
│   │   ├── weatherProcessing.ts
│   │   ├── weatherErrorHandling.ts
│   │   └── index.ts         # Service exports
│   ├── types/               # TypeScript type definitions
│   │   ├── weatherTypes.ts
│   │   └── index.ts
│   ├── utils/               # Utility functions
│   │   ├── utils.ts
│   │   └── index.ts
│   ├── styles/              # CSS and theme files
│   ├── hooks/               # Custom React hooks
│   ├── App.tsx
│   └── main.tsx
├── .env.example             # Environment variables template
├── .gitignore
├── package.json
└── README.md
```

### Available Scripts

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run preview`: Preview production build
- `npm run lint`: Run ESLint

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_WEATHER_API_KEY` | Yes | - | WeatherAPI.com API key |
| `VITE_ZIP_CODE` | No | `49341` | Location for weather data |
| `VITE_BLIZZARD_ENV` | No | `production` | Environment setting |

## 🧪 Testing

### Debug Panel

The application includes a built-in debug panel for testing weather API integration:

1. Navigate to the "Accuracy" tab
2. Use the Weather Debug Panel to:
   - Check API configuration
   - Run integration tests
   - View detailed weather analysis
   - Test error handling scenarios

### Mock Data

When no API key is configured, the system automatically uses realistic mock data for development and testing.

## 🌐 Weather API Integration

### Getting Started with Real Data

1. **Sign up** at [WeatherAPI.com](https://www.weatherapi.com/signup.aspx) (free tier available)
2. **Get your API key** from the dashboard
3. **Update** your `.env` file with the API key
4. **Restart** the development server

### Features

- **48-hour Forecasts**: Detailed hourly weather data
- **Weather Alerts**: Government-issued warnings and advisories
- **Location Services**: Support for ZIP codes and coordinates
- **Error Handling**: Comprehensive error management with fallbacks
- **Rate Limiting**: Efficient API usage with retry logic

## 🎨 Customization

### Weather Themes

The application automatically adjusts its theme based on weather conditions:

- **Clear**: Bright, sunny colors
- **Light Snow**: Cool blues and whites
- **Heavy Snow**: Deeper blues and grays
- **Blizzard**: Dark, dramatic colors

### Probability Calculations

Snow day probabilities are calculated using weighted factors:

```typescript
const weights = {
  snow: 0.35,           // Snow probability and accumulation
  temperature: 0.20,    // Temperature and wind chill
  wind: 0.20,          // Wind speed and gusts
  visibility: 0.15,    // Visibility conditions
  ground_conditions: 0.10  // Humidity, pressure, etc.
}
```

## 📊 Community Features

- **Voting System**: Users can submit their own predictions
- **Crowd Wisdom**: Aggregate community predictions
- **Historical Tracking**: Compare model vs. community accuracy
- **Voting Widgets**: Multiple input methods (slider, thumbs up/down)

## � Security & Privacy

- **API Keys**: Securely handled through environment variables
- **No Personal Data**: Only location-based weather data is used
- **HTTPS**: All API communications use secure connections
- **Client-Side**: No sensitive data stored on servers

## 🚀 Deployment

The application is built with Vite and can be deployed to any static hosting service:

- **Vercel**: `vercel --prod`
- **Netlify**: Drag and drop the `dist` folder
- **GitHub Pages**: Use GitHub Actions for automated deployment
- **AWS S3**: Upload build files to S3 bucket

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **WeatherAPI.com**: Weather data provider
- **Radix UI**: Component primitives
- **Tailwind CSS**: Styling framework
- **Phosphor Icons**: Icon library
- **Vite**: Build tool and development server

---

**Built with ❄️ for accurate snow day predictions**
