# 🔑 API Keys Setup Guide

## Quick Setup

Your `.env` file is ready! Just add your API keys:

```bash
# Edit the .env file in your project root
OPENAI_API_KEY=sk-your-actual-openai-key-here
VITE_WEATHER_API_KEY=your-actual-weatherapi-key-here
VITE_ZIP_CODE=49341
```

## Get Your API Keys

### 1. OpenAI API Key
- **URL**: https://platform.openai.com/api-keys
- **Cost**: ~$0.01-0.10 per prediction
- **Steps**:
  1. Sign up/login to OpenAI
  2. Go to API keys section
  3. Click "Create API key"
  4. Copy the key (starts with `sk-`)

### 2. WeatherAPI.com Key  
- **URL**: https://www.weatherapi.com/signup.aspx
- **Cost**: Free (1M calls/month)
- **Steps**:
  1. Sign up for free account
  2. Go to your dashboard
  3. Copy your API key

## Commands

```bash
# Check API key status
npm run setup-keys

# Test with mock data (no keys needed)
npm run create-test-data
npm run dev

# Generate real AI prediction (requires keys)
npm run generate-prediction
```

## Testing Without Keys

The system works perfectly with test data:

```bash
npm run create-test-data  # Creates realistic mock prediction
npm run dev              # View the full AI interface
```

## When You're Ready

1. Get API keys from the links above
2. Add them to your `.env` file  
3. Run `npm run generate-prediction`
4. See real AI agent analysis!

The `.env` file is in `.gitignore` so your keys stay private.