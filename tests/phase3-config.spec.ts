import { test, expect } from '@playwright/test';
import { build } from 'vite';
import { resolve } from 'node:path';
import { resolveApiBaseUrl, resolvePlatformConfig, type PlatformConfig } from '../src/config/platform';
import { resolveOrbeConfig } from '../src/config/orbe';
import { frontendBuildBranch, productionIsolationDefines } from '../vite.config';

const development = {
  VITE_AUTH_ENABLED: 'true',
  VITE_MEETINGS_ENABLED: 'true',
  VITE_API_BASE_URL: 'https://devapi.phasscode.com/',
};
const unavailable = { authEnabled: false, meetingsEnabled: false, apiBaseUrl: '' };

for (const authEnabled of [false, true]) {
  for (const meetingsEnabled of [false, true]) {
    for (const orbeEnabled of [false, true]) {
      test(`perfil independente Auth=${authEnabled}, Reuniões=${meetingsEnabled}, Orbe=${orbeEnabled}`, () => {
        const apiBaseUrl = 'https://phase3-api.invalid';
        const environment = {
          VITE_AUTH_ENABLED: String(authEnabled),
          VITE_MEETINGS_ENABLED: String(meetingsEnabled),
          VITE_ORBE_API_ENABLED: String(orbeEnabled),
          VITE_API_BASE_URL: apiBaseUrl,
        };
        expect(resolvePlatformConfig(environment, 'devgbc.phasscode.com')).toEqual({
          authEnabled, meetingsEnabled, apiBaseUrl: authEnabled || meetingsEnabled ? apiBaseUrl : '',
        });
        expect(resolveOrbeConfig(environment, 'devgbc.phasscode.com')).toEqual({
          enabled: orbeEnabled, apiBaseUrl: orbeEnabled ? apiBaseUrl : '',
        });
      });
    }
  }
}

test('autenticação e reuniões exigem opt-ins independentes e ignoram a flag legada', () => {
  expect(resolvePlatformConfig({})).toEqual(unavailable);
  for (const flag of [undefined, '', 'false', 'TRUE', ' true ']) {
    expect(resolvePlatformConfig({ ...development, VITE_AUTH_ENABLED: flag, VITE_MEETINGS_ENABLED: flag }))
      .toEqual(unavailable);
    expect(resolvePlatformConfig({ ...development, VITE_MEETINGS_ENABLED: flag }))
      .toEqual({ authEnabled: true, meetingsEnabled: false, apiBaseUrl: 'https://devapi.phasscode.com' });
    expect(resolvePlatformConfig({ ...development, VITE_AUTH_ENABLED: flag }))
      .toEqual({ authEnabled: false, meetingsEnabled: true, apiBaseUrl: 'https://devapi.phasscode.com' });
  }
  const legacyOnly = { VITE_PHASE3_ENABLED: 'true', VITE_API_BASE_URL: development.VITE_API_BASE_URL };
  expect(resolvePlatformConfig(legacyOnly)).toEqual(unavailable);
  const legacyDisabled = { ...development, VITE_PHASE3_ENABLED: 'false' };
  expect(resolvePlatformConfig(legacyDisabled))
    .toEqual({ authEnabled: true, meetingsEnabled: true, apiBaseUrl: 'https://devapi.phasscode.com' });
});

test('plataforma compartilha a política atual de URL validada do Orbe', () => {
  expect(resolvePlatformConfig(development, 'devgbc.phasscode.com'))
    .toEqual({ authEnabled: true, meetingsEnabled: true, apiBaseUrl: 'https://devapi.phasscode.com' });
  expect(resolvePlatformConfig(development, 'gbc.phasscode.com'))
    .toEqual(unavailable);
  expect(resolvePlatformConfig({ ...development, VITE_API_BASE_URL: 'https://api.phasscode.com' }, 'gbc.phasscode.com'))
    .toEqual({ authEnabled: true, meetingsEnabled: true, apiBaseUrl: 'https://api.phasscode.com' });
  const orbe = resolveOrbeConfig({ VITE_ORBE_API_ENABLED: 'true', VITE_API_BASE_URL: development.VITE_API_BASE_URL });
  expect(orbe.apiBaseUrl).toBe(resolvePlatformConfig(development).apiBaseUrl);
});

test('configuração central rejeita credenciais, query, fragmentos e HTTP publicado', () => {
  for (const value of [undefined, '', '/api', 'ftp://example.test', 'javascript:alert(1)',
    'https://user:secret@example.test', 'https://example.test?', 'https://example.test#',
    'https://example.test?secret=private', 'https://example.test#private']) {
    expect(resolveApiBaseUrl(value), String(value)).toBeNull();
    expect(resolvePlatformConfig({ ...development, VITE_API_BASE_URL: value }), String(value)).toEqual(unavailable);
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
  expect(productionIsolationDefines('build', 'main', {})).toEqual({
    'import.meta.env.VITE_ORBE_API_ENABLED': '"false"',
    'import.meta.env.VITE_AUTH_ENABLED': '"false"',
    'import.meta.env.VITE_MEETINGS_ENABLED': '"false"',
    'import.meta.env.VITE_API_BASE_URL': '""',
  });
  for (const url of ['https://devapi.phasscode.com', 'https://api.phasscode.com',
    'https://orbe-api.invalid.example.test', 'https://phase3-api.invalid/']) {
    expect(productionIsolationDefines('build', 'main', {
      PHASSCODE_MOCK_API_BUILD: 'true', VITE_API_BASE_URL: url,
    })['import.meta.env.VITE_AUTH_ENABLED'], url).toBe('"false"');
    expect(productionIsolationDefines('build', 'main', {
      PHASSCODE_MOCK_API_BUILD: 'true', VITE_API_BASE_URL: url,
    })['import.meta.env.VITE_MEETINGS_ENABLED'], url).toBe('"false"');
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
      'import.meta.env.VITE_AUTH_ENABLED': '"true"',
      'import.meta.env.VITE_MEETINGS_ENABLED': '"true"',
      'import.meta.env.VITE_ORBE_API_ENABLED': '"true"',
      'import.meta.env.VITE_API_BASE_URL': '"https://devapi.phasscode.com"',
      ...productionIsolationDefines('build', 'main', {}),
    },
    build: { write: false, minify: false, lib: { entry: resolve('src/config/platform.ts'), formats: ['es'], fileName: 'phase3-config' } },
  });
  const bundle = Array.isArray(result) ? result[0] : result;
  if (!('output' in bundle)) throw new Error('Vite did not return a bundle.');
  const code = bundle.output.find(chunk => chunk.type === 'chunk')?.code;
  if (!code) throw new Error('Vite did not produce a configuration module.');
  const module = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`) as {
    platformConfig: PlatformConfig;
  };
  expect(module.platformConfig).toEqual(unavailable);
  expect(code).not.toContain('https://devapi.phasscode.com');
});
