import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

export default defineConfig(baseConfig, {
  testIgnore: [],
  testMatch: '**/visual.spec.ts',
  workers: 1,
  retries: 0,
  outputDir: 'test-results/visual',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/visual', open: 'never' }]],
  // References must be reviewed and committed; CI must never create them silently.
  updateSnapshots: 'none',
  expect: { toHaveScreenshot: { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.002 } },
});
