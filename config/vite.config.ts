import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, loadEnv, PluginOption } from "vite";
import { resolve } from 'path'
import { publicEnvironment } from '../build-tools/lib/public-environment.mjs'
import { verifyReleaseInputs, copyPublicReleaseAssets } from '../build-tools/lib/release-assets.mjs'

const projectRoot = resolve(import.meta.dirname, '..')
const basePath = process.env.VITE_BASE_PATH ?? process.env.BASE_PATH ?? '/'

// https://vite.dev/config/
export default defineConfig(({ mode, command }) => ({
  envPrefix: [],
  define: publicEnvironment({ ...loadEnv(mode, projectRoot, ''), ...process.env }, command === 'build'),
  plugins: [
    react() as PluginOption,
    tailwindcss(),
    {
      name: 'blizzard-release-assets',
      apply: 'build',
      async buildStart() { await verifyReleaseInputs(projectRoot, process.env.BLIZZARD_RELEASE_BUILD === 'true') },
      async writeBundle(options) { await copyPublicReleaseAssets(projectRoot, options.dir || resolve(projectRoot, 'dist')) }
    },
  ],
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src')
    }
  },
  // Allow deployments to override the base path (default to root)
  base: basePath,
  build: {
    copyPublicDir: false,
    outDir: resolve(projectRoot, 'dist'),
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          weather: ['./src/services/weatherApi.ts', './src/services/weatherProcessing.ts']
        }
      }
    }
  }
}))
