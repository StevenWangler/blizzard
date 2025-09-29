# AI Agent Snow Day Prediction System

## Overview

This project now features an advanced multi-agent AI system that analyzes weather data and collaboratively predicts snow day probabilities with detailed reasoning and expert analysis.

## System Architecture

### Multi-Agent Design

The system employs four specialized AI agents that work together:

1. **Chief Meteorologist Agent** - Analyzes weather conditions, forecasts, and meteorological data
2. **Weather Pattern Historian Agent** - Provides historical context and climatological patterns  
3. **Transportation Safety Analyst Agent** - Evaluates travel conditions and safety risks
4. **Decision Coordinator Agent** - Synthesizes all expert input into final predictions

### Agent Workflow

```
Weather API → Agent Analysis (Parallel) → Decision Coordination → Structured Prediction
     ↓              ↓                            ↓                        ↓
1. Fetch Data   2. Expert Analysis         3. Synthesis          4. JSON Output
   - Current      - Meteorology              - Weigh factors       - Probability
   - Forecast     - Historical patterns      - Resolve conflicts   - Confidence  
   - Alerts       - Safety assessment        - Final decision      - Reasoning
```

### Structured Output

The agents produce comprehensive, structured JSON predictions including:

- **Snow day probability** (0-100%) with confidence levels
- **Detailed weather analysis** (temperature, precipitation, wind, visibility)
- **Historical context** and similar weather patterns
- **Safety assessment** for roads, travel, and transportation
- **Timeline** of weather events and impacts
- **Recommendations** for schools, residents, and authorities
- **Alternative scenarios** and contingency planning

## Technical Implementation

### Backend Components

- **`src/lib/agentSystem.ts`** - Core multi-agent orchestration system
- **`scripts/generate-prediction.mjs`** - Node.js script for prediction generation
- **`.github/workflows/snow-day-prediction.yml`** - Automated GitHub Action

### Frontend Components  

- **`src/components/EnhancedPredictionView.tsx`** - Rich UI for displaying agent predictions
- **Tabbed interface** showing weather analysis, historical context, safety assessment, and timeline
- **Interactive recommendations** for different stakeholders
- **Confidence indicators** and uncertainty communication

### Data Flow

1. **GitHub Action triggers** daily at 6 PM EST
2. **Weather API fetches** current conditions and forecast
3. **AI agents analyze** data in parallel using OpenAI models
4. **Structured prediction** saved to `public/data/prediction.json`
5. **Frontend displays** comprehensive analysis and recommendations

## Configuration

### Environment Variables

```bash
# Required for agent system
OPENAI_API_KEY=your_openai_api_key

# Required for weather data  
VITE_WEATHER_API_KEY=your_weatherapi_key
VITE_ZIP_CODE=49341  # Default: Rockford, MI
```

### Agent Models

- **Primary model**: GPT-4o for complex reasoning and analysis
- **Structured outputs**: Zod schemas ensure consistent JSON format
- **Parallel execution**: Agents run simultaneously for efficiency

## Usage

### Development

```bash
# Install dependencies (includes @openai/agents)
npm install

# Create test data for development
node scripts/create-test-data.mjs  

# Start development server
npm run dev
```

### Production Deployment

The system automatically runs via GitHub Actions:

- **Schedule**: Daily at 6 PM EST (23:00 UTC)
- **Manual trigger**: Via GitHub Actions workflow_dispatch
- **Automatic updates**: Predictions committed to repository

### Testing the Agent System

```bash
# Generate test prediction data
node scripts/create-test-data.mjs

# Run actual prediction (requires API keys)
node scripts/generate-prediction.mjs
```

## Features

### Enhanced Prediction Display

- **Multi-tab interface** with expert analysis sections
- **Visual confidence indicators** and risk color coding  
- **Interactive timeline** showing weather event progression
- **Stakeholder-specific recommendations** 
- **Alternative scenarios** with probability assessments

### Intelligent Analysis

- **Meteorological expertise** - Temperature trends, precipitation analysis, wind impact
- **Historical pattern matching** - Similar weather events and success rates
- **Safety risk assessment** - Road conditions, travel safety, emergency access
- **Decision coordination** - Balanced reasoning considering all factors

### Reliability Features

- **Graceful fallback** to legacy weather service if agents unavailable
- **Error handling** and retry logic in prediction generation
- **Structured validation** using Zod schemas
- **Confidence tracking** and uncertainty quantification

## Architecture Benefits

1. **Modular expertise** - Each agent focuses on specific domain knowledge
2. **Parallel processing** - Faster analysis through concurrent agent execution
3. **Structured reasoning** - JSON schemas ensure consistent, parseable output
4. **Transparency** - Detailed rationale and confidence levels provided
5. **Extensibility** - Easy to add new agents or modify existing analysis

## Future Enhancements

- **Web search integration** for real-time weather pattern research
- **Historical data integration** with local school district records  
- **Voice interface** using OpenAI Realtime API
- **Fine-tuning** on local weather patterns and outcomes
- **Human-in-the-loop** for decision validation and feedback

## Contributing

The agent system is designed for easy extension and modification:

1. **Add new agents** by creating Agent instances with specialized instructions
2. **Modify analysis criteria** by updating Zod schemas and prompts
3. **Extend tool capabilities** by adding new tool definitions
4. **Customize for other locations** by updating weather sources and local factors

---

*Powered by OpenAI Agents SDK and advanced language models for intelligent, collaborative decision-making.*