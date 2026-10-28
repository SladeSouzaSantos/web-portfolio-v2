import { test, expect } from '@playwright/test';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { createLogger, createServer, resolveConfig, type InlineConfig, type ViteDevServer } from 'vite';
import { orbeDiagnosticsPlugin } from '../scripts/orbeDiagnosticsPlugin';
import { ORBE_DIAGNOSTIC_EVENT } from '../src/services/orbeDiagnosticEvent';
import { chatResponse, mockChat, MOCK_CONVERSATION_TOKEN, MOCK_CORRELATION_ID } from './helpers/orbe-mock';

async function createDevelopmentServer(configuration: InlineConfig): Promise<ViteDevServer> {
  // Other configuration tests build production bundles in reused workers.
  // Keep DEV for the server's entire lifetime: dependency optimization runs
  // after createServer() and must agree with React's development JSX transform.
  const previousNodeEnvironment = process.env.NODE_ENV;
  const restoreNodeEnvironment = () => {
    if (previousNodeEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnvironment;
  };
  try {
    process.env.NODE_ENV = 'development';
    const server = await createServer(configuration);
    const close = server.close.bind(server);
    server.close = async () => {
      try { await close(); }
      finally { restoreNodeEnvironment(); }
    };
    return server;
  } catch (error) {
    restoreNodeEnvironment();
    throw error;
  }
}

async function listenOnEphemeralPort(server: ViteDevServer): Promise<string> {
  // Vite's listen() maps port 0 to 5173. The underlying server preserves the
  // OS-assigned ephemeral port and still initializes Vite's real hot channel.
  await new Promise<void>((resolve, reject) => {
    const httpServer = server.httpServer;
    if (!httpServer) throw new Error('Development server did not create an HTTP listener.');
    httpServer.once('error', reject);
    httpServer.listen(0, '127.0.0.1', () => {
      httpServer.off('error', reject);
      resolve();
    });
  });
  const address = server.httpServer?.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

async function openDiagnosticSocket() {
  const messages: { level: 'info' | 'warn'; text: string }[] = [];
  const logger = createLogger('silent');
  logger.info = text => { messages.push({ level: 'info', text }); };
  logger.warn = text => { messages.push({ level: 'warn', text }); };
  const server = await createDevelopmentServer({
    configFile: false,
    envDir: false,
    customLogger: logger,
    plugins: [orbeDiagnosticsPlugin()],
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { host: '127.0.0.1', port: 0, strictPort: true, watch: null },
  });
  try {
    const origin = await listenOnEphemeralPort(server);
    const socket = new WebSocket(
      `${origin.replace('http:', 'ws:')}/?token=${server.config.webSocketToken}`,
      'vite-hmr',
    );
    await Promise.race([
      once(socket, 'open', { signal: AbortSignal.timeout(5_000) }),
      once(socket, 'error', { signal: AbortSignal.timeout(5_000) })
        .then(() => { throw new Error('Development diagnostic socket did not open.'); }),
    ]);
    return {
      messages,
      send(data: unknown) {
        socket.send(JSON.stringify({ type: 'custom', event: ORBE_DIAGNOSTIC_EVENT, data }));
      },
      async close() {
        socket.close();
        await server.close();
      },
    };
  } catch (error) {
    await server.close();
    throw error;
  }
}

test('metadados do Orbe chegam ao terminal pelo WebSocket de desenvolvimento sem conteúdo sensível', async () => {
  const connection = await openDiagnosticSocket();
  try {
    connection.send({ phase: 'started' });
    connection.send({
      phase: 'failed', kind: 'http', status: 429, code: 'LLM_BUDGET_EXHAUSTED',
      correlationId: '5f861d79-04b5-4ada-9aa3-7612c3b3ad6f', retryAfterSeconds: 30, durationMs: 129,
      message: 'PRIVATE_QUESTION', answer: 'PRIVATE_ANSWER', conversationToken: 'PRIVATE_TOKEN',
      headers: { Authorization: 'PRIVATE_HEADER' }, url: 'https://private.invalid/PRIVATE_URL',
    });
    connection.send({ phase: 'failed', kind: 'network', durationMs: 8 });
    connection.send({ phase: 'failed', kind: 'timeout', durationMs: 45_000 });
    connection.send({ phase: 'succeeded', durationMs: 7 });
    await expect.poll(() => connection.messages.filter(message => message.text.startsWith('[Orbe]')).length)
      .toBe(5);
    const diagnostics = connection.messages.filter(message => message.text.startsWith('[Orbe]'));
    expect(diagnostics.map(message => message.level)).toEqual(['info', 'warn', 'warn', 'warn', 'info']);
    expect(diagnostics[1].text).toContain('"status":429');
    expect(diagnostics[1].text).toContain('LLM_BUDGET_EXHAUSTED');
    expect(diagnostics[1].text).toContain('5f861d79-04b5-4ada-9aa3-7612c3b3ad6f');
    expect(diagnostics[1].text).toContain('"retryAfterSeconds":30');
    expect(diagnostics[2].text).toContain('CORS');
    expect(diagnostics[2].text).toContain('não confirma falta de cota');
    expect(diagnostics[3].text).toContain('nenhuma tentativa automática');
    expect(JSON.stringify(diagnostics)).not.toContain('PRIVATE_');
    expect(JSON.stringify(diagnostics)).not.toContain('private.invalid');
  } finally {
    await connection.close();
  }
});

test('relay descarta eventos inválidos e impede que valores livres sejam impressos', async () => {
  const connection = await openDiagnosticSocket();
  try {
    for (const data of [
      null, [], 'PRIVATE_RAW', { phase: 'PRIVATE_PHASE' }, { message: 'PRIVATE_QUESTION' },
      { phase: ['started'] }, { phase: { toString: null } },
    ]) {
      connection.send(data);
    }
    connection.send({
      phase: 'failed', kind: 'network', status: 'PRIVATE_STATUS', code: 'PRIVATE\nINJECTION',
      correlationId: 'PRIVATE_CORRELATION', retryAfterSeconds: 'PRIVATE_RETRY', durationMs: -1,
    });
    connection.send({ phase: 'succeeded', durationMs: 0 });
    await expect.poll(() => connection.messages.some(message => message.text.includes('"phase":"succeeded"')))
      .toBe(true);
    const diagnostics = connection.messages.filter(message => message.text.startsWith('[Orbe]'));
    expect(diagnostics.length).toBeLessThanOrEqual(2);
    expect(JSON.stringify(diagnostics)).not.toContain('PRIVATE');
    expect(JSON.stringify(diagnostics)).not.toContain('"durationMs":-1');
  } finally {
    await connection.close();
  }
});

test('plugin de diagnóstico não participa do build de produção', async () => {
  const previousNodeEnvironment = process.env.NODE_ENV;
  try {
    const configuration = await resolveConfig({
      configFile: false,
      envDir: false,
      plugins: [orbeDiagnosticsPlugin()],
      logLevel: 'silent',
    }, 'build', 'production');
    expect(configuration.plugins.map(plugin => plugin.name)).not.toContain('orbe-development-diagnostics');
  } finally {
    if (previousNodeEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnvironment;
  }
});

test('consulta HTTP simulada percorre cliente, HMR e terminal no Vite real sem registrar conteúdo privado', async ({ page }, testInfo) => {
  const messages: string[] = [];
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const logger = createLogger('silent');
  logger.info = text => { messages.push(text); };
  logger.warn = text => { messages.push(text); };
  const server = await createDevelopmentServer({
    configFile: resolve('vite.config.ts'),
    envDir: false,
    mode: 'development',
    customLogger: logger,
    // Keep optimized dependencies under node_modules so React's DEV plugin
    // does not re-transform the generated vendor bundle as application code.
    cacheDir: resolve('node_modules/.vite-orbe-diagnostics', `worker-${testInfo.parallelIndex}`),
    // These are the app's actual bare imports, including JSX's implicit runtime.
    // Skip repository-wide HTML crawling and late dependency discovery; the
    // isolated server can finish its explicit prebundle before browser navigation.
    optimizeDeps: {
      noDiscovery: true,
      include: [
        'react', 'react/jsx-runtime', 'react/jsx-dev-runtime',
        'react-dom', 'react-dom/client', 'react-router', 'gsap', 'gsap/ScrollTrigger',
      ],
    },
    define: {
      'import.meta.env.VITE_ORBE_API_ENABLED': JSON.stringify('true'),
      'import.meta.env.VITE_AUTH_ENABLED': JSON.stringify('false'),
      'import.meta.env.VITE_MEETINGS_ENABLED': JSON.stringify('false'),
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify('https://orbe-api.invalid'),
    },
    server: { host: '127.0.0.1', port: 0, strictPort: true, watch: null },
  });
  try {
    const mock = await mockChat(page, [
      { body: chatResponse({ answer: 'PRIVATE_RESPONSE' }) },
      {
        status: 429,
        headers: { 'Retry-After': '15' },
        body: {
          error: {
            code: 'LLM_BUDGET_EXHAUSTED', message: 'PRIVATE_UPSTREAM_ERROR',
            correlationId: MOCK_CORRELATION_ID,
          },
        },
      },
    ]);
    const origin = await listenOnEphemeralPort(server);
    // Transform the static module graph before requesting the page. This only
    // prepares Vite's cache; the real browser still mounts React and uses HMR.
    await server.environments.client.warmupRequest('/src/main.tsx');
    await server.environments.client.waitForRequestsIdle();
    await page.goto(`${origin}/#sobre`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Abrir guia do portfólio', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: /CONSULTAR ORBE MÁGICO/ });
    const input = dialog.getByRole('textbox', { name: 'Sua pergunta ao orbe', exact: true });
    const send = dialog.getByRole('button', { name: 'ENVIAR', exact: true });
    await input.fill('PRIVATE_QUESTION_ONE');
    await send.click();
    await expect(dialog.getByRole('log')).toContainText('PRIVATE_RESPONSE');
    await input.fill('PRIVATE_QUESTION_TWO');
    await send.click();
    await expect(dialog.getByRole('alert')).toContainText(MOCK_CORRELATION_ID);
    await expect.poll(() => messages.filter(message => message.startsWith('[Orbe]')).length).toBe(4);

    expect(mock.requests).toHaveLength(2);
    expect(mock.requests.every(request => request.url() === 'https://orbe-api.invalid/api/v1/chat')).toBe(true);
    expect(mock.requests[1].headers()['x-conversation-token']).toBe(MOCK_CONVERSATION_TOKEN);
    const diagnostics = messages.filter(message => message.startsWith('[Orbe]'));
    expect(diagnostics.filter(message => message.includes('"phase":"started"'))).toHaveLength(2);
    expect(diagnostics.some(message => message.includes('"phase":"succeeded"'))).toBe(true);
    const failure = diagnostics.find(message => message.includes('"phase":"failed"'));
    expect(failure).toContain('"status":429');
    expect(failure).toContain('LLM_BUDGET_EXHAUSTED');
    expect(failure).toContain(MOCK_CORRELATION_ID);
    expect(failure).toContain('"retryAfterSeconds":15');
    expect(messages.join('\n')).not.toContain('PRIVATE_');
    expect(messages.join('\n')).not.toContain(MOCK_CONVERSATION_TOKEN);
    expect(pageErrors).toEqual([]);
  } finally {
    await page.close();
    await server.close();
  }
});
