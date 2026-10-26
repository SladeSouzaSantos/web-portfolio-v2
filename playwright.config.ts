import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  outputDir: 'test-results/functional',
  testIgnore: ['**/smoke-deploy.spec.ts', '**/visual.spec.ts', '**/orbe-api.spec.ts', '**/phase3-api.spec.ts', '**/phase3-admin.spec.ts', '**/phase3-orbe.spec.ts', '**/f1-ui.spec.ts', '**/f2-session.spec.ts'],
  fullyParallel: true,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/functional', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
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
