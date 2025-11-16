import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, PluginOption } from "vite";

import sparkPlugin from "@github/spark/spark-vite-plugin";
import createIconImportProxy from "@github/spark/vitePhosphorIconProxyPlugin";
import { resolve } from 'path'

const projectRoot = resolve(import.meta.dirname, '..')
const basePath = process.env.VITE_BASE_PATH ?? process.env.BASE_PATH ?? '/'

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
  // Allow deployments to override the base path (default to root)
  base: basePath,
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
