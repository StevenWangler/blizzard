# Snowday Forecast GitHub Pages Configuration

## Setup Steps

### 1. Repository Settings
- Go to Settings → Pages
- Set Source to "GitHub Actions"
- Your site will be at: `https://StevenWangler.github.io/snowday-forecast`

### 2. Required Secrets
Add these in Settings → Secrets and variables → Actions:

```
WEATHER_API_KEY = your_weatherapi_key_from_weatherapi.com
ZIP_CODE = 49341  (optional)
```

### 3. Vite Configuration
Before deploying, uncomment this line in `vite.config.ts`:

```typescript
// Change this:
// base: '/snowday-forecast/', // Uncomment this line when deploying to GitHub Pages

// To this:
base: '/snowday-forecast/',
```

### 4. GitHub Actions Workflow
The workflow will:
- Run daily at 5 AM EST
- Build fresh weather data
- Deploy to GitHub Pages
- Handle failures gracefully

## Manual Deployment

To deploy manually:
1. Go to Actions tab
2. Select "Daily Weather Update & Deploy"  
3. Click "Run workflow"

## Custom Domain (Optional)

To use your own domain:
1. Add a `CNAME` file with your domain
2. Configure DNS records as shown in DEPLOYMENT_GUIDE.md
3. Enable HTTPS in Pages settings

## Monitoring

- Check Actions tab for build status
- Site updates daily automatically
- Fallback to mock data if API fails
- Email notifications on build failures (optional)

Your snow day predictor will stay fresh with daily weather updates! ❄️