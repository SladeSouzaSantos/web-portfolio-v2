import { defineConfig, devices } from '@playwright/test';

// No local server: this suite must exercise the site actually served by Nginx/Cloudflare.
const siteURL = process.env.SMOKE_BASE_URL;
if (!siteURL) throw new Error('Defina SMOKE_BASE_URL com a URL publicada antes de executar test:smoke.');
const parsedURL = new URL(siteURL);
if (!['http:', 'https:'].includes(parsedURL.protocol) || parsedURL.username || parsedURL.password) {
  throw new Error('SMOKE_BASE_URL deve ser uma URL HTTP(S) sem credenciais.');
}

export default defineConfig({
  testDir: './tests',
  testMatch: '**/smoke-deploy.spec.ts',
  outputDir: 'test-results/smoke',
  fullyParallel: true,
  workers: 2,
  timeout: 45_000,
  expect: { timeout: 15_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/smoke', open: 'never' }]],
  use: {
    baseURL: parsedURL.origin,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    reducedMotion: 'reduce',
    navigationTimeout: 30_000,
  },
  projects: [{
    name: 'chromium-smoke',
    use: { ...devices['Desktop Chrome'], ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) },
  }],
});
