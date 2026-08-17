import { defineConfig, devices } from '@playwright/test';

const port = 4173;
const localBrowserChannel = process.env.DP_PLAYWRIGHT_CHANNEL;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'line',
  // These drive real reel animation, feature autoplay, and win holds. Shared CI runners
  // are far slower than a development machine, so the budget is generous on purpose: it
  // only costs time when something is genuinely broken.
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    // Launch Vite directly so Playwright can stop the exact server process on Windows.
    command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(localBrowserChannel ? { channel: localBrowserChannel } : {}),
      },
    },
  ],
});
