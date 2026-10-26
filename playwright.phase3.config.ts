import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

export default defineConfig({
  ...baseConfig,
  testIgnore: [],
  testMatch: ['**/phase3-api.spec.ts', '**/phase3-admin.spec.ts', '**/phase3-orbe.spec.ts'],
  outputDir: 'test-results/phase3',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/phase3', open: 'never' }]],
  use: { ...baseConfig.use, baseURL: 'http://127.0.0.1:4176', serviceWorkers: 'block' },
  webServer: {
    command: `${npm} run build -- --outDir dist-phase3-test && ${npm} run preview -- --outDir dist-phase3-test --port 4176 --strictPort`,
    url: 'http://127.0.0.1:4176',
    env: {
      PHASSCODE_MOCK_API_BUILD: 'true',
      VITE_ORBE_API_ENABLED: 'true',
      VITE_AUTH_ENABLED: 'true',
      VITE_MEETINGS_ENABLED: 'true',
      VITE_API_BASE_URL: 'https://phase3-api.invalid',
    },
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
