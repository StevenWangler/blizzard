import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

const projectRoot = resolve(import.meta.dirname, '..')

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src')
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    reporters: ['default']
  }
})
