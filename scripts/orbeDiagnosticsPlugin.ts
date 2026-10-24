import type { Plugin } from 'vite';
import {
  ORBE_DIAGNOSTIC_EVENT,
  sanitizeOrbeDiagnostic,
  type OrbeDiagnosticEvent,
} from '../src/services/orbeDiagnosticEvent';

function diagnosticHint(event: OrbeDiagnosticEvent): string {
  if (event.kind === 'network') {
    return ' O navegador não recebeu uma resposta HTTP acessível. Confira conexão e CORS na aba Network; isso não confirma falta de cota.';
  }
  if (event.status === 429) {
    return ' A API informou um limite ou orçamento esgotado. Confira o código e o correlationId no backend para identificar a origem.';
  }
  if (event.kind === 'timeout' || event.status === 504) {
    return ' A resposta não chegou no prazo. A pergunta pode ter sido processada; nenhuma tentativa automática foi realizada.';
  }
  if (event.status === 502 || event.status === 503) {
    return ' A API está indisponível ou o provedor falhou. Consulte o backend pelo correlationId, quando informado.';
  }
  return '';
}

/** Relays only allowlisted metadata through Vite's existing development socket. */
export function orbeDiagnosticsPlugin(): Plugin {
  return {
    name: 'orbe-development-diagnostics',
    apply: 'serve',
    configureServer(server) {
      if (server.config.isProduction) return;

      const receiveDiagnostic = (data: unknown) => {
        const event = sanitizeOrbeDiagnostic(data);
        if (!event) return;
        const message = `[Orbe] ${JSON.stringify(event)}${diagnosticHint(event)}`;
        if (event.phase === 'failed') server.config.logger.warn(message);
        else server.config.logger.info(message);
      };

      server.ws.on(ORBE_DIAGNOSTIC_EVENT, receiveDiagnostic);
      const cleanup = () => server.ws.off(ORBE_DIAGNOSTIC_EVENT, receiveDiagnostic);
      server.httpServer?.once('close', cleanup);
    },
  };
}
