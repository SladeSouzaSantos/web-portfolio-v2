import { test, expect } from '@playwright/test';
import { build } from 'vite';
import { resolve } from 'node:path';
import { resolveApiBaseUrl, resolvePlatformConfig } from '../src/config/platform';
import { resolveOrbeConfig } from '../src/config/orbe';
import { frontendBuildBranch, productionIsolationDefines } from '../vite.config';

const development = { VITE_PHASE3_ENABLED: 'true', VITE_API_BASE_URL: 'https://devapi.phasscode.com/' };

test('Fase 3 exige ativação explícita e compartilha a URL validada do Orbe', () => {
  expect(resolvePlatformConfig({})).toEqual({ enabled: false, apiBaseUrl: '' });
  expect(resolvePlatformConfig({ ...development, VITE_PHASE3_ENABLED: 'false' }).enabled).toBe(false);
  expect(resolvePlatformConfig({ ...development, VITE_PHASE3_ENABLED: 'TRUE' }).enabled).toBe(false);
  expect(resolvePlatformConfig(development, 'devgbc.phasscode.com'))
    .toEqual({ enabled: true, apiBaseUrl: 'https://devapi.phasscode.com' });
  expect(resolvePlatformConfig(development, 'gbc.phasscode.com'))
    .toEqual({ enabled: false, apiBaseUrl: '' });
  expect(resolvePlatformConfig({ ...development, VITE_API_BASE_URL: 'https://api.phasscode.com' }, 'gbc.phasscode.com'))
    .toEqual({ enabled: true, apiBaseUrl: 'https://api.phasscode.com' });
  const orbe = resolveOrbeConfig({ VITE_ORBE_API_ENABLED: 'true', VITE_API_BASE_URL: development.VITE_API_BASE_URL });
  expect(orbe.apiBaseUrl).toBe(resolvePlatformConfig(development).apiBaseUrl);
});

test('configuração central rejeita credenciais, query, fragmentos e HTTP publicado', () => {
  for (const value of [undefined, '', '/api', 'ftp://example.test', 'javascript:alert(1)',
    'https://user:secret@example.test', 'https://example.test?', 'https://example.test#',
    'https://example.test?secret=private', 'https://example.test#private']) {
    expect(resolveApiBaseUrl(value), String(value)).toBeNull();
  }
  expect(resolveApiBaseUrl('http://localhost:3000/')).toBe('http://localhost:3000');
  expect(resolveApiBaseUrl('http://devapi.phasscode.com', 'devgbc.phasscode.com')).toBeNull();
  expect(resolveApiBaseUrl('https://devapi.phasscode.com', 'GBC.PHASSCODE.COM.')).toBeNull();
});

test('build main ignora configuração local de desenvolvimento sem alterar o checkout', () => {
  expect(frontendBuildBranch({ GITHUB_BASE_REF: 'main', GITHUB_REF_NAME: 'dev' })).toBe('main');
  expect(frontendBuildBranch({ GITHUB_REF_NAME: 'dev' })).toBe('dev');
  expect(productionIsolationDefines('serve', 'main')).toEqual({});
  expect(productionIsolationDefines('build', 'dev')).toEqual({});
  expect(productionIsolationDefines('build', 'main')).toEqual({
    'import.meta.env.VITE_ORBE_API_ENABLED': '"false"',
    'import.meta.env.VITE_PHASE3_ENABLED': '"false"',
    'import.meta.env.VITE_API_BASE_URL': '""',
  });
  for (const url of ['https://devapi.phasscode.com', 'https://api.phasscode.com',
    'https://orbe-api.invalid.example.test', 'https://phase3-api.invalid/']) {
    expect(productionIsolationDefines('build', 'main', {
      PHASSCODE_MOCK_API_BUILD: 'true', VITE_API_BASE_URL: url,
    })['import.meta.env.VITE_PHASE3_ENABLED'], url).toBe('"false"');
  }
  for (const url of ['https://orbe-api.invalid', 'https://phase3-api.invalid']) {
    expect(productionIsolationDefines('build', 'main', {
      PHASSCODE_MOCK_API_BUILD: 'true', VITE_API_BASE_URL: url,
    })).toEqual({});
    expect(productionIsolationDefines('build', 'main', {
      VITE_API_BASE_URL: url,
    })['import.meta.env.VITE_ORBE_API_ENABLED']).toBe('"false"');
  }
});

test('bundle main permanece isolado mesmo com valores locais de DEV fornecidos ao Vite', async () => {
  const result = await build({
    configFile: false, envDir: false, logLevel: 'silent', mode: 'production',
    define: {
      // An inherited/local development configuration is overridden by the guard.
      'import.meta.env.VITE_PHASE3_ENABLED': '"true"',
      'import.meta.env.VITE_ORBE_API_ENABLED': '"true"',
      'import.meta.env.VITE_API_BASE_URL': '"https://devapi.phasscode.com"',
      ...productionIsolationDefines('build', 'main'),
    },
    build: { write: false, minify: false, lib: { entry: resolve('src/config/platform.ts'), formats: ['es'], fileName: 'phase3-config' } },
  });
  const bundle = Array.isArray(result) ? result[0] : result;
  if (!('output' in bundle)) throw new Error('Vite did not return a bundle.');
  const code = bundle.output.find(chunk => chunk.type === 'chunk')?.code;
  if (!code) throw new Error('Vite did not produce a configuration module.');
  const module = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`) as {
    platformConfig: { enabled: boolean; apiBaseUrl: string };
  };
  expect(module.platformConfig).toEqual({ enabled: false, apiBaseUrl: '' });
  expect(code).not.toContain('https://devapi.phasscode.com');
});
