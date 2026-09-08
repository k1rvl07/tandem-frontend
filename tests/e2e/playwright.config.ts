import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: [['list']],
  outputDir: 'test-results',
  globalSetup: './global-setup.ts',
  use: {
    baseURL: 'http://localhost:5173',
    storageState: 'tests/e2e/.auth/admin.json',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm run dev -- --host 127.0.0.1',
      port: 5173,
      reuseExistingServer: true,
      timeout: 90_000,
    },
    {
      command: 'go run ./cmd/server',
      port: 8080,
      cwd: '../tandem-backend',
      reuseExistingServer: true,
      timeout: 90_000,
    },
  ],
})
