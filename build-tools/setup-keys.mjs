#!/usr/bin/env node
import { config } from 'dotenv'
import { fileURLToPath } from 'node:url'

config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true })
const hasModelKey = Boolean(process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('your_openai_api_key_here'))
console.log(hasModelKey
  ? 'OpenAI key configured. Run npm run generate-prediction:local for a paid forecast.'
  : 'Set OPENAI_API_KEY in your local environment or .env to run a paid forecast.')
console.log('Rockford weather is available from NWS without a key. WEATHER_API_KEY is optional.')
