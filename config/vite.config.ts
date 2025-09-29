import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, PluginOption } from "vite";

import sparkPlugin from "@github/spark/spark-vite-plugin";
import createIconImportProxy from "@github/spark/vitePhosphorIconProxyPlugin";
import { resolve } from 'path'

const projectRoot = resolve(import.meta.dirname, '..')

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react() as PluginOption,
    tailwindcss(),
    sparkPlugin({
      projectRoot,
    }),
    createIconImportProxy()
  ],
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src')
    }
  },
  // Optimize for GitHub Pages deployment
  // base: '/snowday-forecast/', // Uncomment this line when deploying to GitHub Pages
  build: {
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
})
