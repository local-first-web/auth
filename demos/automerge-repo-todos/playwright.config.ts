import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

const isPlaywrightUI = process.env.PLAYWRIGHT_UI === '1'

/** https://playwright.dev/docs/test-configuration */
export default defineConfig({
  testDir: './test',
  testMatch: '*.test.ts',

  timeout: 5000,

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: Boolean(process.env.CI),

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'list',

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Allow clipboard acces */
    permissions: ['clipboard-read'],
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],

  webServer: isPlaywrightUI
    ? []
    : [
        {
          command: 'pnpm dev:start',
          url: 'http://localhost:3000',
          reuseExistingServer: false,
        },
        {
          command: 'pnpm dev:syncserver',
          url: 'http://localhost:3030',
          reuseExistingServer: false,
        },
      ],
})
