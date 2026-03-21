# GitHub Pages Deployment Setup

## Quick Setup Instructions

### 1. Enable GitHub Pages

1. Go to your repository **Settings** → **Pages**
2. Set **Source** to "GitHub Actions"
3. Your site will be available at: `https://StevenWangler.github.io/snowday-forecast`

### 2. Add Repository Secrets and Variables

Go to **Settings** → **Secrets and variables** → **Actions** and add:

**Repository secrets**

- `WEATHER_API_KEY` — WeatherAPI.com key for forecast data
- `OPENAI_API_KEY` — used by the scheduled prediction generator
- `VITE_OUTCOME_ADMIN_SECRET` — passphrase for maintainer tooling / preview mode
- `PAT_TOKEN` — token used by the prediction workflow to commit updated data
- `ZIP_CODE` — optional, defaults to `49341`

**Repository variable**

- `BLIZZARD_ACTIVE=true` — turns the forecasting experience on

Set `BLIZZARD_ACTIVE=false` to switch the public site into the lightweight off-season landing page and skip scheduled AI prediction generation.

### 3. Trigger First Deployment

- Push to main branch, or
- Go to **Actions** tab → **Daily Weather Update & Deploy** → **Run workflow**

## 🔄 **How Scheduled Updates Work**

- **Scheduled**: Prediction generation runs at 9 AM, 1 PM, and 6 PM EST
- **Fresh Data**: Each run fetches current forecast data and generates updated prediction artifacts
- **Static Generation**: GitHub Pages deploys the latest built site after prediction updates
- **Off-season aware**: When `BLIZZARD_ACTIVE=false`, scheduled prediction generation is skipped on purpose

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
- `VITE_BLIZZARD_ACTIVE` from the `BLIZZARD_ACTIVE` repository variable
- `VITE_BLIZZARD_ENV=production`
- `VITE_BUILD_TIME` (current timestamp)

## 🌼 Off-Season Mode

Blizzard now supports a repository-variable-driven off-season mode.

### Turn forecasting off

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Set repository variable `BLIZZARD_ACTIVE` to `false`
3. Run the **Deploy Site** workflow (or push a commit) so GitHub Pages rebuilds with the new flag

Result:

- The site renders a spring/summer landing page instead of the full winter app
- The scheduled `Generate Blizzard Prediction` workflow skips OpenAI/weather generation work
- Maintainers can still unlock a preview of the full app using the admin passphrase

### Turn forecasting back on

1. Set `BLIZZARD_ACTIVE` to `true`
2. Redeploy the site
3. Scheduled prediction generation resumes on the next workflow run

> GitHub Pages is a static deployment, so changing the repository variable is a build-time switch. Flip the variable, then redeploy.

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