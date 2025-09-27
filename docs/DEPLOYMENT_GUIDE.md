# GitHub Pages Deployment Setup

## Quick Setup Instructions

### 1. Enable GitHub Pages

1. Go to your repository **Settings** → **Pages**
2. Set **Source** to "GitHub Actions"
3. Your site will be available at: `https://StevenWangler.github.io/snowday-forecast`

### 2. Add Repository Secrets

Go to **Settings** → **Secrets and variables** → **Actions** and add:

```
WEATHER_API_KEY = your_weatherapi_com_key_here
ZIP_CODE = 49341  (optional, defaults to 49341)
```

### 3. Trigger First Deployment

- Push to main branch, or
- Go to **Actions** tab → **Daily Weather Update & Deploy** → **Run workflow**

## 🔄 **How Daily Updates Work**

- **Scheduled**: Runs every day at 5 AM EST
- **Fresh Data**: Fetches latest weather data during build
- **Static Generation**: Builds optimized static site
- **Auto Deploy**: Updates GitHub Pages automatically

## 📊 **Build Process**

1. **Checkout code** from your repository
2. **Install dependencies** (npm ci)
3. **Set environment variables** (API key, location)
4. **Build application** (npm run build)
5. **Deploy to Pages** (automatic upload)

## 🛠️ **Customization Options**

### Change Update Schedule

Edit `.github/workflows/deploy.yml`:

```yaml
schedule:
  - cron: '0 9 * * *'  # 5 AM EST daily
  # - cron: '0 */6 * * *'  # Every 6 hours
  # - cron: '0 9 * * 1-5'  # Weekdays only
```

### Add Custom Domain

1. Add `CNAME` file to your repository root:
   ```
   yourdomain.com
   ```

2. Configure DNS:
   ```
   CNAME record: www.yourdomain.com → StevenWangler.github.io
   A records for apex domain:
   185.199.108.153
   185.199.109.153
   185.199.110.153
   185.199.111.153
   ```

### Environment Variables in Build

The workflow automatically sets:
- `VITE_WEATHER_API_KEY` from secrets
- `VITE_ZIP_CODE` from secrets (optional)
- `VITE_BLIZZARD_ENV=production`
- `VITE_BUILD_TIME` (current timestamp)

## 🚨 **Monitoring & Alerts**

### View Build Status
- Go to **Actions** tab to see deployment history
- Green ✅ = successful deployment
- Red ❌ = build failed (check logs)

### Add Notifications
Extend the workflow to send alerts on failure:

```yaml
- name: Send Slack notification
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: failure
    text: "❄️ Snow Day Predictor build failed!"
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

## 🔐 **Security Best Practices**

- ✅ API keys stored in GitHub Secrets (encrypted)
- ✅ No sensitive data in repository
- ✅ HTTPS enforced on GitHub Pages
- ✅ Build artifacts automatically cleaned

## 📈 **Performance Features**

- **Static Site**: Lightning-fast loading
- **CDN**: Global distribution via GitHub's CDN
- **Caching**: Browser caching for assets
- **Compression**: Gzip compression enabled

## 🐛 **Troubleshooting**

### Build Fails
1. Check **Actions** tab for error logs
2. Verify `WEATHER_API_KEY` secret is set
3. Check API quota limits
4. Ensure dependencies are up to date

### Site Not Updating
1. Verify workflow runs daily (Actions tab)
2. Check if build completed successfully
3. Clear browser cache
4. Check if API key is valid

### Custom Domain Issues
1. Verify DNS settings
2. Check CNAME file exists
3. Wait 24-48 hours for DNS propagation
4. Ensure HTTPS enforcement is enabled

## 🚀 **Alternative Hosting Options**

If you need more features later:

### Vercel (Recommended Alternative)
```bash
# One-time setup
npm i -g vercel
vercel link
vercel env add VITE_WEATHER_API_KEY
vercel --prod
```

### Netlify
```bash
# One-time setup
npm i -g netlify-cli
netlify deploy --prod --dir=dist
```

## 📝 **Next Steps**

1. **Test the setup**: Push to main and verify deployment
2. **Monitor daily updates**: Check that fresh data appears daily
3. **Add analytics**: Consider Google Analytics for usage tracking
4. **SEO optimization**: Add meta tags for snow day predictions

Your site will automatically stay fresh with daily weather updates! ❄️