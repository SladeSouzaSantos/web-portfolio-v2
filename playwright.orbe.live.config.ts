import { defineConfig, devices } from '@playwright/test';

const enabled = process.env.ORBE_LIVE_E2E_ENABLED === 'true';
const suite = process.env.ORBE_LIVE_SUITE ?? 'smoke';
const expectedSha = process.env.ORBE_LIVE_EXPECTED_BACKEND_SHA ?? '';

if (!enabled) {
  throw new Error('Live DEV E2E requires explicit ORBE_LIVE_E2E_ENABLED=true; mock suites remain unchanged.');
}
if (!['smoke', 'extended'].includes(suite)) {
  throw new Error('ORBE_LIVE_SUITE must be smoke or extended.');
}
if (!/^[0-9a-f]{40}$/.test(expectedSha)) {
  throw new Error('ORBE_LIVE_EXPECTED_BACKEND_SHA must be the verified, deployed DEV commit SHA.');
}

export default defineConfig({
  testDir: './tests',
  testMatch: '**/orbe-live.spec.ts',
  testIgnore: [],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  maxFailures: 1,
  timeout: 300_000,
  expect: { timeout: 12_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/orbe-live', open: 'never' }],
  ],
  outputDir: 'test-results/orbe-live',
  forbidOnly: true,
  use: {
    baseURL: 'https://devgbc.phasscode.com',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    serviceWorkers: 'block',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [{ name: 'chromium-live-dev', use: devices['Desktop Chrome'] }],
  // Intentionally no webServer: exercise the deployed frontend and API.
  // Never import tests/fixtures.ts, which installs a fake Orbe API.
});
