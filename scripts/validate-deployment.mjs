#!/usr/bin/env node

/**
 * Deployment Configuration Validator
 * 
 * Checks if your Snow Day Pred  console.log('📚 Documentation:')
  console.log('- docs/DEPLOYMENT_GUIDE.md - Complete setup instructions')
  console.log('- docs/PAGES_SETUP.md - Quick setup checklist')
  console.log('- docs/WEATHER_API_README.md - Weather API documentation')
  console.log('- docs/README.md - Documentation index')r is ready for GitHub Pages deployment
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

function validateDeployment() {
  console.log('🚀 Snow Day Predictor - Deployment Validator\n')

  let issues = 0
  let warnings = 0

  // Check 1: GitHub Actions workflow exists
  console.log('📋 Checking deployment configuration...')
  
  if (existsSync('.github/workflows/deploy.yml')) {
    console.log('✅ GitHub Actions workflow found')
  } else {
    console.log('❌ Missing .github/workflows/deploy.yml')
    issues++
  }

  // Check 2: Vite config has base path ready
  if (existsSync('vite.config.ts')) {
    const viteConfig = readFileSync('vite.config.ts', 'utf-8')
    if (viteConfig.includes('base:') && viteConfig.includes('/snowday-forecast/')) {
      console.log('✅ Vite base path configured for GitHub Pages')
    } else if (viteConfig.includes('// base:')) {
      console.log('⚠️  Vite base path commented out (uncomment for GitHub Pages)')
      warnings++
    } else {
      console.log('❌ Vite base path not configured')
      issues++
    }
  }

  // Check 3: Package.json has build script
  if (existsSync('package.json')) {
    const pkg = JSON.parse(readFileSync('package.json', 'utf-8'))
    if (pkg.scripts && pkg.scripts['build:gh-pages']) {
      console.log('✅ GitHub Pages build script available')
    } else {
      console.log('⚠️  Consider adding build:gh-pages script')
      warnings++
    }
  }

  // Check 4: Documentation exists
  if (existsSync('docs/DEPLOYMENT_GUIDE.md')) {
    console.log('✅ Deployment guide available')
  } else {
    console.log('⚠️  Deployment guide missing')
    warnings++
  }

  // Check 5: Environment variables
  console.log('\n🔐 Environment Configuration:')
  if (existsSync('.env')) {
    const env = readFileSync('.env', 'utf-8')
    if (env.includes('VITE_WEATHER_API_KEY')) {
      if (env.includes('your_weatherapi_key_here')) {
        console.log('⚠️  Weather API key is placeholder (set real key in GitHub Secrets)')
        warnings++
      } else {
        console.log('✅ Weather API key configured (remember to add to GitHub Secrets)')
      }
    } else {
      console.log('❌ Weather API key not found in .env')
      issues++
    }
  } else {
    console.log('❌ .env file not found')
    issues++
  }

  // Summary
  console.log('\n📊 Summary:')
  if (issues === 0 && warnings === 0) {
    console.log('🎉 Perfect! Your site is ready for GitHub Pages deployment!')
  } else if (issues === 0) {
    console.log(`✅ Ready to deploy! (${warnings} minor warnings)`)
  } else {
    console.log(`❌ ${issues} issues need fixing before deployment`)
  }

  // Next steps
  console.log('\n🚀 Next Steps:')
  console.log('1. Push to your main branch')
  console.log('2. Go to Settings → Pages → Source: GitHub Actions')
  console.log('3. Add WEATHER_API_KEY to GitHub Secrets')
  console.log('4. Wait for first workflow run to complete')
  console.log('5. Visit https://StevenWangler.github.io/snowday-forecast')

  console.log('\n📚 Documentation:')
  console.log('- docs/DEPLOYMENT_GUIDE.md - Complete setup instructions')
  console.log('- docs/PAGES_SETUP.md - Quick setup checklist')
  console.log('- docs/WEATHER_API_README.md - Weather API documentation')
  console.log('- docs/README.md - Documentation index')

  return issues === 0
}

// Run validator
try {
  const success = validateDeployment()
  process.exit(success ? 0 : 1)
} catch (error) {
  console.error('Error running deployment validator:', error.message)
  process.exit(1)
}