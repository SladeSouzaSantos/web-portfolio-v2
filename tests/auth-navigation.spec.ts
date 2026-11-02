import { expect, test } from '@playwright/test';
import { consumeAuthCallback, safeLoginReturnTo } from '../src/services/authNavigation';

function callback(value: string) {
  const url = new URL(value, 'https://portfolio.example.test');
  const state = { idx: 3, key: 'existing-history-key', usr: { navigation: 'preserved' } };
  const calls: Array<{ state: unknown; title: string; url: string | URL | null | undefined }> = [];
  const notice = consumeAuthCallback(url, {
    state,
    replaceState(data: unknown, title: string, destination?: string | URL | null) {
      calls.push({ state: data, title, url: destination });
    },
  });
  return { notice, state, calls };
}

const messages = {
  AUTH_ADMIN_ONLY: 'Acesso negado. Apenas o administrador tem acesso.',
  AUTH_REQUIRED: 'Não foi possível validar o login. Entre novamente pelo botão de login.',
  AUTH_LOGIN_FAILED: 'Não foi possível concluir o login. Tente novamente pelo botão de login.',
  AUTH_PROVIDER_UNAVAILABLE: 'O Google está temporariamente indisponível. Tente entrar novamente mais tarde.',
  AUTH_UNAVAILABLE: 'O serviço de autenticação está temporariamente indisponível. Tente novamente mais tarde.',
};
for (const [code, message] of Object.entries(messages)) {
  test(`callback ${code} produz somente mensagem predefinida e remove marcador`, () => {
    const result = callback(`/projetos?origem=google&auth_error=${code}#catalogo`);
    expect(result.notice).toEqual({ code, message });
    expect(result.calls).toEqual([{ state: result.state, title: '', url: '/projetos?origem=google#catalogo' }]);
    expect(result.calls[0].state).toBe(result.state);
  });
}

test('callback preserva literalmente parâmetros repetidos, escapes, ordem e hash', () => {
  const result = callback('/administracao?x=a%20b&auth_error=AUTH_ADMIN_ONLY&x=a+b&origem=%67oogle&literal=%2f%2F#admin-orbe-records');
  expect(result.calls[0].url).toBe('/administracao?x=a%20b&x=a+b&origem=%67oogle&literal=%2f%2F#admin-orbe-records');
  expect(result.notice?.code).toBe('AUTH_ADMIN_ONLY');
});

test('remove todas as ocorrências, inclusive nomes codificados, sem escolher entre erros conflitantes', () => {
  const result = callback('/index.html?auth_error=AUTH_ADMIN_ONLY&origem=legado&%61uth_error=AUTH_REQUIRED&auth%5Ferror=AUTH_LOGIN_FAILED#experiencia');
  expect(result.calls).toEqual([{ state: result.state, title: '', url: '/index.html?origem=legado#experiencia' }]);
  expect(result.notice).toEqual({ code: 'AUTH_LOGIN_FAILED', message: messages.AUTH_LOGIN_FAILED });
});

for (const value of ['', 'unknown-private-provider-message', '__proto__', 'toString', '<script>alert(1)</script>', 'AUTH_ADMIN_ONLY\nprivate']) {
  test(`erro não permitido ${JSON.stringify(value)} usa fallback constante`, () => {
    const result = callback(`/?auth_error=${encodeURIComponent(value)}#sobre`);
    expect(result.notice).toEqual({ code: 'AUTH_LOGIN_FAILED', message: messages.AUTH_LOGIN_FAILED });
    expect(result.calls[0].url).toBe('/#sobre');
  });
}

test('sem auth_error não altera histórico nem trata fragmento ou parâmetros semelhantes como callback', () => {
  const result = callback('/?auth_error_extra=AUTH_ADMIN_ONLY&AUTH_ERROR=AUTH_REQUIRED#auth_error=AUTH_LOGIN_FAILED');
  expect(result.notice).toBeNull();
  expect(result.calls).toEqual([]);
});

test('marcador isolado é removido sem deixar query vazia', () => {
  const result = callback('/?auth_error');
  expect(result.calls[0].url).toBe('/');
  expect(result.notice?.code).toBe('AUTH_LOGIN_FAILED');
});

test('pathname com duas barras continua na origem atual durante replaceState', () => {
  // Build the location explicitly: // in a URL argument would name a host.
  const location = { pathname: '//legacy-path', search: '?auth_error=AUTH_REQUIRED&origem=legado', hash: '#sobre' };
  let destination = '';
  consumeAuthCallback(location, {
    state: { idx: 3 },
    replaceState(_state, _title, value) { destination = String(value); },
  });
  const resolved = new URL(destination, 'https://portfolio.example.test');
  expect(resolved.origin).toBe('https://portfolio.example.test');
  expect(resolved.pathname).toBe('//legacy-path');
  expect(resolved.search).toBe('?origem=legado');
});

for (const value of [
  '/?origem=google#experiencia', '/administracao?origem=google#admin-orbe-records',
  '/administracao#admin-meeting-agenda', '/projetos?origem=legado#catalogo',
  '/projetos.html?lang=pt-BR#arquivo-grid', '/index.html#sobre',
]) {
  test(`login mantém navegação pública permitida ${value}`, () => {
    expect(safeLoginReturnTo(value)).toBe(value);
  });
}

test('login descarta parâmetros livres, credenciais e fragmentos privados antes de enviar returnTo', () => {
  const value = '/projetos?lang=pt&auth_error=AUTH_ADMIN_ONLY&access_token=private&code=oauth-code&state=oauth-state&csrfToken=secret&email=person%40example.test&name=private&meetingToken=private&redirect=https%3A%2F%2Fevil.test&origem=google#private-token';
  expect(safeLoginReturnTo(value)).toBe('/projetos?lang=pt&origem=google');
  expect(safeLoginReturnTo('/?lang=private-token&origem=private-token&page=0001&tech=private-token&filter=private-token')).toBe('/');
});

for (const value of [
  undefined, '', 'https://evil.example.test', '//evil.example.test', '/\\evil.test',
  '/%2fevil.test', '/%252fevil.test', '/projetos%0aLocation:evil', '/projetos?lang=%250a',
  '/projetos?x=%', '/projetos?x=with space', '/projetos?x=\u0000',
  '/api/v1/auth/callback/google?code=private', '/unknown-private-path',
  '/projetos?x=\ud800', `/projetos?x=${'a'.repeat(1024)}`,
]) {
  test(`login recusa retorno inseguro ${JSON.stringify(value)?.slice(0, 80)}`, () => {
    expect(safeLoginReturnTo(value)).toBeUndefined();
  });
}

test('query pública não aceita credencial disfarçada em chave permitida', () => {
  expect(safeLoginReturnTo(`/?origem=${'a'.repeat(43)}&tech=${'b'.repeat(43)}&lang=person%40example.test&page=1#experiencia`))
    .toBe('/?page=1#experiencia');
});
