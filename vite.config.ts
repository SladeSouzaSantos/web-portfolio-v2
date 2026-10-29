import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';
import { defineConfig } from 'vite';
import { orbeDiagnosticsPlugin } from './scripts/orbeDiagnosticsPlugin';

/** CI destination wins; reading the local branch never modifies the checkout. */
export function frontendBuildBranch(environment = process.env): string {
  const destination = environment.GITHUB_BASE_REF || environment.GITHUB_REF_NAME;
  if (destination) return destination;
  try {
    return execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

export function productionIsolationDefines(command: string, branch: string, environment = process.env): Record<string, string> {
  if (command !== 'build' || branch !== 'main') return {};
  // Production always uses the production Orbe API, never a developer's local .env.
  // Authentication and meetings are disabled on both public sites.
  if (environment.PHASSCODE_MOCK_API_BUILD === 'true'
    && ['https://orbe-api.invalid', 'https://phase3-api.invalid'].includes(environment.VITE_API_BASE_URL ?? '')) return {};
  return {
    'import.meta.env.VITE_ORBE_API_ENABLED': JSON.stringify('true'),
    'import.meta.env.VITE_AUTH_ENABLED': JSON.stringify('false'),
    'import.meta.env.VITE_MEETINGS_ENABLED': JSON.stringify('false'),
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify('https://api.phasscode.com'),
  };
}

export default defineConfig(({ command }) => ({
  plugins: [react(), orbeDiagnosticsPlugin()],
  define: productionIsolationDefines(command, frontendBuildBranch()),
  server: {
    port: 5173,
    strictPort: true,
  },
}));
