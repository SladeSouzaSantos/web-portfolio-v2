import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

if (process.env.NODE_ENV !== 'test'
  || !/^[0-9a-f-]{36}$/.test(process.env.PHASSCODE_B2_OWNERSHIP_NONCE ?? '')
  || !process.env.PHASSCODE_B2_CONTROL_KEY) {
  throw new Error('Start F3 through the isolated backend test:e2e harness.');
}

export default defineConfig({
  ...baseConfig,
  testIgnore: [],
  testMatch: '**/f3-integrated.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  outputDir: process.env.PHASSCODE_B2_ARTIFACTS_DIR ? `${process.env.PHASSCODE_B2_ARTIFACTS_DIR}/test-results` : 'test-results/f3',
  reporter: [
    ['list'],
    ['html', { outputFolder: process.env.PHASSCODE_B2_ARTIFACTS_DIR ? `${process.env.PHASSCODE_B2_ARTIFACTS_DIR}/playwright-report` : 'playwright-report/f3', open: 'never' }],
    ['json', { outputFile: process.env.PHASSCODE_B2_ARTIFACTS_DIR ? `${process.env.PHASSCODE_B2_ARTIFACTS_DIR}/playwright-f3.json` : 'test-results/f3/report.json' }],
  ],
  // Runtime and services are owned by the Compose runner, not a public URL.
  webServer: undefined,
  projects: [{ name: 'integrated-chromium', use: { browserName: 'chromium' } }],
  use: {
    ...baseConfig.use,
    baseURL: 'http://127.0.0.1:5173',
    serviceWorkers: 'block',
    // OAuth URLs/cookies and private responses must not become trace attachments.
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    launchOptions: {
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH && {
        executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      }),
      proxy: { server: 'http://127.0.0.1:4402', bypass: '<-loopback>' },
      args: ['--disable-background-networking'],
    },
  },
});
