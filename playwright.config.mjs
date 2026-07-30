import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: 'http://localhost:3456',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    navigationTimeout: 15_000,
  },

  webServer: {
    command: 'python3 -m http.server 3456',
    url: 'http://localhost:3456',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /responsive\.spec\.mjs/,
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testIgnore: /responsive\.spec\.mjs/,
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testIgnore: /responsive\.spec\.mjs/,
    },
    {
      name: 'chromium-small',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 667 } },
      testMatch: /responsive\.spec\.mjs/,
    },
    {
      name: 'chromium-medium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } },
      testMatch: /responsive\.spec\.mjs/,
    },
    {
      name: 'chromium-large',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      testMatch: /responsive\.spec\.mjs/,
    },
  ],
});
