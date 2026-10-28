import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import '../styles/auth_session_notice.css';

/** Mounted above routes: hiding private UI cannot hide an uncertain logout. */
export function AuthSessionNotice() {
  const { state, client, reload } = useAuth();
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const remaining = (state.retryAt ?? 0) - Date.now();
    if (remaining <= 0) { setNow(Date.now()); return; }
    const timer = window.setTimeout(() => setNow(Date.now()), Math.min(remaining + 1, 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [state.retryAt]);
  const notice = state.notice;
  if (!notice) return null;
  const needsAttention = notice.kind === 'logout-not-sent' || notice.kind === 'logout-uncertain' || notice.kind === 'session-check-required';
  const check = async () => {
    if (busy) return;
    setBusy(true);
    try { await reload(); } catch { /* Client retains feedback; no mutation is repeated. */ }
    finally { setBusy(false); }
  };
  return <aside className="auth-session-notice" aria-label="Estado da sessão" aria-busy={busy}>
    <p role={needsAttention ? 'alert' : 'status'}>{notice.message}
      {state.error?.correlationId && <small> Referência: {state.error.correlationId}</small>}
    </p>
    {notice.kind !== 'logout-confirmed' && notice.kind !== 'logout-inactive' &&
      <button type="button" disabled={busy || now < (state.retryAt ?? 0)} onClick={() => { void check(); }}>
        VERIFICAR SESSÃO
      </button>}
    {!needsAttention && <button type="button" aria-label="Fechar aviso da sessão" onClick={() => client?.dismissNotice()}>×</button>}
  </aside>;
}
