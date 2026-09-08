import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['**/*.test.ts', 'tests/**'],
      reporter: ['text', 'html'],
    },
  },
})
