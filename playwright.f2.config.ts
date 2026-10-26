import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const baseURL = 'http://127.0.0.1:4178';

export default defineConfig({
  ...baseConfig,
  // Each scenario already opens concurrent tabs. Keep separate scenarios from
  // competing for browser resources while real lock/HTTP deadlines are tested.
  workers: 1,
  timeout: 45_000,
  testIgnore: [],
  testMatch: '**/f2-session.spec.ts',
  outputDir: 'test-results/f2',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/f2', open: 'never' }]],
  projects: [{ name: 'f2-session-tabs', use: { ...baseConfig.projects?.[0]?.use, baseURL } }],
  use: { ...baseConfig.use, baseURL, serviceWorkers: 'block' },
  webServer: {
    command: `${npm} run dev -- --port 4178 --strictPort`,
    url: baseURL,
    env: {
      VITE_AUTH_ENABLED: 'true',
      VITE_MEETINGS_ENABLED: 'true',
      VITE_ORBE_API_ENABLED: 'false',
      VITE_API_BASE_URL: baseURL,
    },
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
