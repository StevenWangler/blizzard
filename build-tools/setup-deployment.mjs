#!/usr/bin/env node

/**
 * Deployment Setup Script
 * 
 * Prepares your Snow Day Pre  console.log('📚 Documentation:')
  console.log('- docs/DEPLOYMENT_GUIDE.md - Complete setup instructions')
  console.log('- docs/WEATHER_API_README.md - Weather API documentation')
  console.log('- docs/PAGES_SETUP.md - GitHub Pages setup')or for GitHub Pages deployment
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'

function setupDeployment() {
  console.log('🚀 Snow Day Predictor - Deployment Setup\n')

  let setupTasks = 0

  // Task 1: Ensure .github/workflows directory exists
  if (!existsSync('.github')) {
    mkdirSync('.github')
    console.log('✅ Created .github directory')
    setupTasks++
  }
  
  if (!existsSync('.github/workflows')) {
    mkdirSync('.github/workflows')
    console.log('✅ Created .github/workflows directory')
    setupTasks++
  }

  // Task 2: Check/create .env file
  if (!existsSync('.env')) {
    const envContent = `# Snow Day Predictor Environment Variables
# Get your free API key from https://www.weatherapi.com/

VITE_WEATHER_API_KEY=your_weatherapi_key_here
VITE_ZIP_CODE=10001

# Optional: Debug mode
VITE_DEBUG_WEATHER=false
`
    writeFileSync('.env', envContent)
    console.log('✅ Created .env file with template')
    setupTasks++
  } else {
    console.log('ℹ️  .env file already exists')
  }

  // Task 3: Update vite.config.ts for GitHub Pages (uncomment base path)
  if (existsSync('vite.config.ts')) {
    let viteConfig = readFileSync('vite.config.ts', 'utf-8')
    
    if (viteConfig.includes('// base:')) {
      console.log('⚠️  Base path is commented out in vite.config.ts')
      console.log('   Uncomment the base path line when ready to deploy to GitHub Pages')
    } else if (viteConfig.includes('base:')) {
      console.log('✅ Base path configured in vite.config.ts')
    } else {
      console.log('⚠️  Consider adding base path to vite.config.ts for GitHub Pages')
    }
  }

  // Task 4: Check git repository
  if (existsSync('.git')) {
    console.log('✅ Git repository initialized')
  } else {
    console.log('⚠️  No git repository found. Run: git init')
  }

  console.log(`\n📋 Setup Summary: ${setupTasks} tasks completed\n`)

  // Next steps
  console.log('🔧 Manual Steps Required:')
  console.log('1. Get Weather API key from https://www.weatherapi.com/')
  console.log('2. Update VITE_WEATHER_API_KEY in .env file')
  console.log('3. Set your ZIP_CODE in .env file')
  console.log('4. Commit and push your code to GitHub')
  console.log('5. Enable GitHub Pages in repository settings')
  console.log('6. Add WEATHER_API_KEY as a GitHub Secret')
  console.log('7. Uncomment base path in vite.config.ts for production')

  console.log('\n🚀 Quick Commands:')
  console.log('- npm run validate-deployment   # Check deployment readiness')
  console.log('- npm run dev                   # Start development server')
  console.log('- npm run build:gh-pages        # Build for GitHub Pages')

  console.log('\n📚 Documentation:')
  console.log('- DEPLOYMENT_GUIDE.md - Complete setup instructions')
  console.log('- WEATHER_API_README.md - Weather API documentation')
  console.log('- .github/PAGES_SETUP.md - GitHub Pages setup')
}

// Run setup
try {
  setupDeployment()
} catch (error) {
  console.error('Error running deployment setup:', error.message)
  process.exit(1)
}