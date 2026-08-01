import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  expect: { timeout: 30_000 },
  fullyParallel: false,
  outputDir: 'test-results',
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  reporter: [['list'], ['html', { open: 'never' }]],
  testDir: './tests/browser',
  timeout: 180_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm build && vite preview --host 127.0.0.1 --port 4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    url: 'http://127.0.0.1:4173',
  },
})
