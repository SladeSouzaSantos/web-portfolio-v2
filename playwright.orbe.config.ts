import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

export default defineConfig({
  ...baseConfig,
  testIgnore: [],
  testMatch: '**/orbe-api.spec.ts',
  outputDir: 'test-results/orbe',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/orbe', open: 'never' }]],
  use: {
    ...baseConfig.use,
    baseURL: 'http://127.0.0.1:4175',
    serviceWorkers: 'block',
  },
  webServer: {
    command: `${npm} run build -- --outDir dist-orbe-test && ${npm} run preview -- --outDir dist-orbe-test --port 4175 --strictPort`,
    url: 'http://127.0.0.1:4175',
    env: {
      VITE_ORBE_API_ENABLED: 'true',
      VITE_API_BASE_URL: 'https://orbe-api.invalid',
    },
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
