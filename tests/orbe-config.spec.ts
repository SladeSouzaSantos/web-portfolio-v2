import { test, expect } from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
import { resolveOrbeConfig } from '../src/config/orbe';

const enabledEnvironment = {
  VITE_ORBE_API_ENABLED: 'true',
  VITE_API_BASE_URL: 'https://devapi.phasscode.com/',
};

test('Orbe exige ativação explícita e nunca usa a API dev no domínio de produção', () => {
  expect(resolveOrbeConfig({})).toEqual({ enabled: false, apiBaseUrl: '' });
  expect(resolveOrbeConfig({ ...enabledEnvironment, VITE_ORBE_API_ENABLED: 'false' }))
    .toEqual({ enabled: false, apiBaseUrl: '' });
  expect(resolveOrbeConfig({ ...enabledEnvironment, VITE_ORBE_API_ENABLED: 'TRUE' }).enabled).toBe(false);
  expect(resolveOrbeConfig(enabledEnvironment, 'devgbc.phasscode.com'))
    .toEqual({ enabled: true, apiBaseUrl: 'https://devapi.phasscode.com' });
  expect(resolveOrbeConfig(enabledEnvironment, 'gbc.phasscode.com'))
    .toEqual({ enabled: false, apiBaseUrl: '' });
  expect(resolveOrbeConfig({
    ...enabledEnvironment, VITE_API_BASE_URL: 'https://api.phasscode.com/',
  }, 'gbc.phasscode.com')).toEqual({ enabled: true, apiBaseUrl: 'https://api.phasscode.com' });
});

test('Orbe rejeita configuração insegura e permite uma API HTTP local sem credenciais', () => {
  for (const apiBaseUrl of [
    '', '/api', 'javascript:alert(1)', 'ftp://example.com',
    'https://user:password@example.com', 'https://example.com?token=secret',
    'https://example.com#secret', 'https://example.com?', 'https://example.com#',
  ]) {
    expect(resolveOrbeConfig({ ...enabledEnvironment, VITE_API_BASE_URL: apiBaseUrl }).enabled,
      apiBaseUrl).toBe(false);
  }
  expect(resolveOrbeConfig({ ...enabledEnvironment, VITE_API_BASE_URL: 'http://localhost:3000/' }))
    .toEqual({ enabled: true, apiBaseUrl: 'http://localhost:3000' });
});

test('push em DEV executa CI e par B2/F3 sem liberar release remota', () => {
  const workflow = readFileSync(resolve('.github/workflows/deploy.yml'), 'utf8');
  const pairedCi = readFileSync(resolve('.github/workflows/paired-dev-ci.yml'), 'utf8');
  expect(workflow).toContain('branches: [main, dev]');
  expect(workflow).toContain("if: github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/dev'");
  expect(workflow).toContain('needs: [sast, coordinated]');
  expect(workflow).toContain(
    "if: github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/dev' && inputs.apply_remote",
  );
  expect(workflow).toContain('test "$ENABLE_REMOTE_DEPLOY" = true');
  expect(pairedCi).toContain('branches: [dev]');
  expect(pairedCi).toContain('npm run test:e2e -- --frontend ../frontend --regression');
  expect(pairedCi).not.toContain('PHASSCODE_RELEASE_BACKEND_SHA');
  expect(pairedCi).not.toContain('ENABLE_REMOTE_DEPLOY');
  expect(pairedCi).not.toContain('appleboy/ssh-action');
  expect(pairedCi).not.toContain('docker/build-push-action');
});

test('política do CI mantém dev ativo e PRs para main em demonstração', async () => {
  const policyPath = resolve('scripts/orbe-build-policy.mjs');
  const policy = await import(pathToFileURL(policyPath).href) as {
    resolveOrbeBuildEnvironment(branch: string): {
      VITE_ORBE_API_ENABLED: string;
      VITE_AUTH_ENABLED: string;
      VITE_MEETINGS_ENABLED: string;
      VITE_API_BASE_URL: string;
    };
  };
  expect(policy.resolveOrbeBuildEnvironment('dev')).toEqual({
    VITE_ORBE_API_ENABLED: 'true', VITE_AUTH_ENABLED: 'true', VITE_MEETINGS_ENABLED: 'false',
    VITE_API_BASE_URL: 'https://devapi.phasscode.com',
  });
  for (const branch of ['main', '', 'feature/orbe']) {
    expect(policy.resolveOrbeBuildEnvironment(branch)).toEqual({
      VITE_ORBE_API_ENABLED: 'false', VITE_AUTH_ENABLED: 'false', VITE_MEETINGS_ENABLED: 'false', VITE_API_BASE_URL: '',
    });
  }

  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'orbe-build-policy-'));
  const githubEnvironmentFile = join(temporaryDirectory, 'github-env');
  try {
    execFileSync(process.execPath, [policyPath, '--github-env'], {
      env: { ...process.env, GITHUB_BASE_REF: 'main', GITHUB_REF_NAME: 'dev', GITHUB_ENV: githubEnvironmentFile },
    });
    expect(readFileSync(githubEnvironmentFile, 'utf8'))
      .toBe('VITE_ORBE_API_ENABLED=false\nVITE_AUTH_ENABLED=false\nVITE_MEETINGS_ENABLED=false\nVITE_API_BASE_URL=\n');
  } finally {
    rmSync(githubEnvironmentFile, { force: true });
    rmdirSync(temporaryDirectory);
  }
});

test('Vite incorpora a configuração de dev e main em modo production sem chamar a API', async () => {
  // Isolated in-memory builds leave the deployment's tested dist untouched.
  for (const configuration of [
    { enabled: 'true', url: 'https://devapi.phasscode.com', expected: true },
    { enabled: 'false', url: '', expected: false },
  ]) {
    const output = await build({
      configFile: false,
      envDir: false,
      mode: 'production',
      logLevel: 'silent',
      define: {
        'import.meta.env.VITE_ORBE_API_ENABLED': JSON.stringify(configuration.enabled),
        'import.meta.env.VITE_API_BASE_URL': JSON.stringify(configuration.url),
      },
      build: {
        write: false,
        minify: false,
        lib: { entry: resolve('src/config/orbe.ts'), formats: ['es'], fileName: 'orbe-config' },
      },
    });
    const bundle = (Array.isArray(output) ? output[0] : output);
    if (!('output' in bundle)) throw new Error('Vite did not return an in-memory bundle.');
    const code = bundle.output.find(chunk => chunk.type === 'chunk')?.code;
    if (!code) throw new Error('Vite did not generate the Orbe configuration.');
    const builtModule = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`) as {
      orbeConfig: { enabled: boolean; apiBaseUrl: string };
    };
    expect(builtModule.orbeConfig).toEqual({ enabled: configuration.expected, apiBaseUrl: configuration.url });
    if (!configuration.expected) expect(code).not.toContain('https://devapi.phasscode.com');
  }
});
