import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const profiles = [false, true].flatMap(authEnabled => [false, true].flatMap(meetingsEnabled =>
  [false, true].map(orbeEnabled => ({ authEnabled, meetingsEnabled, orbeEnabled })))).map((profile, index) => ({
  ...profile,
  name: `f1-auth-${Number(profile.authEnabled)}-meetings-${Number(profile.meetingsEnabled)}-orbe-${Number(profile.orbeEnabled)}`,
  baseURL: `http://127.0.0.1:${4180 + index}`,
  port: 4180 + index,
}));

export default defineConfig({
  ...baseConfig,
  testIgnore: [],
  testMatch: '**/f1-ui.spec.ts',
  outputDir: 'test-results/f1',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/f1', open: 'never' }]],
  projects: profiles.map(profile => ({
    name: profile.name,
    grep: profile.authEnabled && !profile.meetingsEnabled && profile.orbeEnabled ? undefined : /flags:/,
    metadata: profile,
    use: { ...baseConfig.projects?.[0]?.use, baseURL: profile.baseURL },
  })),
  webServer: profiles.map(profile => ({
    command: `${npm} run dev -- --port ${profile.port} --strictPort`,
    url: profile.baseURL,
    env: {
      VITE_ORBE_API_ENABLED: String(profile.orbeEnabled),
      VITE_AUTH_ENABLED: String(profile.authEnabled),
      VITE_MEETINGS_ENABLED: String(profile.meetingsEnabled),
      // Deliberately present: the retired shared flag must never activate a module.
      VITE_PHASE3_ENABLED: 'true',
      VITE_API_BASE_URL: 'https://phase3-api.invalid',
    },
    reuseExistingServer: false,
    timeout: 60_000,
  })),
});
