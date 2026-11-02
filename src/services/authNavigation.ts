export type AuthCallbackCode =
  | 'AUTH_ADMIN_ONLY'
  | 'AUTH_REQUIRED'
  | 'AUTH_LOGIN_FAILED'
  | 'AUTH_PROVIDER_UNAVAILABLE'
  | 'AUTH_UNAVAILABLE';

export interface AuthCallbackNotice {
  readonly code: AuthCallbackCode;
  readonly message: string;
}

const messages: Readonly<Record<AuthCallbackCode, string>> = Object.freeze({
  AUTH_ADMIN_ONLY: 'Acesso negado. Apenas o administrador tem acesso.',
  AUTH_REQUIRED: 'Não foi possível validar o login. Entre novamente pelo botão de login.',
  AUTH_LOGIN_FAILED: 'Não foi possível concluir o login. Tente novamente pelo botão de login.',
  AUTH_PROVIDER_UNAVAILABLE: 'O Google está temporariamente indisponível. Tente entrar novamente mais tarde.',
  AUTH_UNAVAILABLE: 'O serviço de autenticação está temporariamente indisponível. Tente novamente mais tarde.',
});

/** An untrusted URL can supply feedback, never an identity, role or session. */
export function consumeAuthCallback(
  location: Pick<Location, 'pathname' | 'search' | 'hash'>,
  history: Pick<History, 'state' | 'replaceState'>,
): AuthCallbackNotice | null {
  const values: string[] = [];
  const remaining = location.search.replace(/^\?/, '').split('&').filter(segment => {
    const params = new URLSearchParams(segment);
    if (!params.has('auth_error')) return true;
    values.push(...params.getAll('auth_error'));
    return false;
  });
  if (!values.length) return null;
  const candidate = values.length === 1 ? values[0] : undefined;
  const code: AuthCallbackCode = candidate && Object.hasOwn(messages, candidate)
    ? candidate as AuthCallbackCode : 'AUTH_LOGIN_FAILED';
  const search = remaining.join('&');
  // A same-origin pathname can itself begin with //; keep it a path when
  // replaceState resolves the URL instead of accidentally naming another host.
  const path = location.pathname.startsWith('//') ? `/.${location.pathname}` : location.pathname;
  // Keep the other query segments byte-for-byte (including duplicate keys and
  // percent encoding), as well as the router's existing history state and hash.
  history.replaceState(history.state, '', `${path}${search ? `?${search}` : ''}${location.hash}`);
  return { code, message: messages[code] };
}

const publicPaths = new Set(['/', '/index.html', '/projetos', '/projetos.html', '/administracao']);
const publicSections = new Set([
  'sobre', 'projetos', 'portfolio', 'experiencia', 'academico', 'formacao',
  'catalogo', 'arquivo-grid', 'conteudo', 'contentDisplay', 'admin-orbe-records', 'admin-meeting-agenda',
]);
const publicFilters = new Set(['todos', 'ia', 'mobile', 'ferramentas']);
const publicTechnologies = new Set([
  'react', 'typescript', 'javascript', 'node', 'java', 'spring', 'python',
  'postgresql', 'redis', 'docker', 'html', 'css', 'tailwind', 'nextjs',
]);
function publicQueryValue(name: string, value: string): boolean {
  if (name === 'origem') return value === 'google' || value === 'legado';
  if (name === 'lang') return /^(?:pt(?:-BR)?|en(?:-US)?|es)$/.test(value);
  if (name === 'page') return /^[1-9]\d{0,2}$/.test(value);
  if (['categoria', 'filtro', 'filter'].includes(name)) return publicFilters.has(value);
  return name === 'tech' && publicTechnologies.has(value);
}

/** Only known portfolio navigation is sent through the login transaction.
 * Free-form query/fragment data, OAuth credentials and private tokens stay out.
 */
export function safeLoginReturnTo(value: string | undefined): string | undefined {
  const bytes = new TextEncoder().encode(value);
  if (!value || !value.startsWith('/') || value.startsWith('//')
    || /[\\\s\p{Cc}]/u.test(value) || /%25/i.test(value)
    || bytes.length > 1024 || new TextDecoder().decode(bytes) !== value) return;
  let decoded: string;
  try { decoded = decodeURIComponent(value); } catch { return; }
  if (decoded.startsWith('//') || /[\\\p{Cc}]/u.test(decoded)) return;
  const url = new URL(value, 'https://portfolio.invalid');
  if (url.origin !== 'https://portfolio.invalid' || !publicPaths.has(url.pathname)) return;
  const query = new URLSearchParams();
  for (const [name, entry] of url.searchParams) {
    if (publicQueryValue(name, entry)) query.append(name, entry);
  }
  const search = query.toString();
  const hash = publicSections.has(url.hash.slice(1)) ? url.hash : '';
  const returnTo = `${url.pathname}${search ? `?${search}` : ''}${hash}`;
  return new TextEncoder().encode(returnTo).length <= 1024 ? returnTo : undefined;
}
