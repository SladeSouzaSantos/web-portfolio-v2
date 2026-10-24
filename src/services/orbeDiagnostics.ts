import { ORBE_DIAGNOSTIC_EVENT, sanitizeOrbeDiagnostic, type OrbeDiagnosticEvent } from './orbeDiagnosticEvent';

/** DEV only: use Vite's existing HMR connection, with no proxy or HTTP collector. */
export function reportOrbeDiagnostic(value: OrbeDiagnosticEvent): void {
  if (!import.meta.env?.DEV) return;
  const event = sanitizeOrbeDiagnostic(value);
  if (!event) return;
  try {
    if (event.phase === 'failed') console.warn('[Orbe]', event);
    else console.info('[Orbe]', event);
    import.meta.hot?.send(ORBE_DIAGNOSTIC_EVENT, event);
  } catch {
    // Diagnostics must never fail, retry or otherwise affect a chat request.
  }
}
