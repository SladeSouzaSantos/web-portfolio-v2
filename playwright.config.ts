import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testIgnore: ['**/smoke-deploy.spec.ts', '**/visual.spec.ts'],
  fullyParallel: true,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    reducedMotion: 'reduce',
  },
  projects: [{
    name: 'chromium',
    use: { ...devices['Desktop Chrome'], ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) },
  }],
  webServer: {
    command: `${process.platform === 'win32' ? 'npm.cmd' : 'npm'} run preview -- --port 4173 --strictPort`,
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
