import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Deployment policy is based on the destination branch, not Vite's production mode. */
export function resolveOrbeBuildEnvironment(branch) {
  if (branch === 'dev') {
    return {
      VITE_ORBE_API_ENABLED: 'true',
      VITE_PHASE3_ENABLED: 'true',
      VITE_API_BASE_URL: 'https://devapi.phasscode.com',
    };
  }

  if (branch === 'main') {
    return {
      VITE_ORBE_API_ENABLED: 'true',
      VITE_PHASE3_ENABLED: 'true',
      VITE_API_BASE_URL: 'https://api.phasscode.com',
    };
  }

  // Branches desconhecidas não ativam APIs reais.
  return {
    VITE_ORBE_API_ENABLED: 'false',
    VITE_PHASE3_ENABLED: 'false',
    VITE_API_BASE_URL: '',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const branch = process.env.GITHUB_BASE_REF || process.env.GITHUB_REF_NAME || '';
  const environment = resolveOrbeBuildEnvironment(branch);
  if (process.argv.includes('--github-env')) {
    if (!process.env.GITHUB_ENV) throw new Error('GITHUB_ENV is required.');
    appendFileSync(process.env.GITHUB_ENV,
      Object.entries(environment).map(([name, value]) => `${name}=${value}\n`).join(''));
  } else {
    process.stdout.write(`${JSON.stringify(environment)}\n`);
  }
}
