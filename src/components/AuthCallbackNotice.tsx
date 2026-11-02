import { useAuth } from '../contexts/AuthContext';
import '../styles/auth_callback_notice.css';

export function AuthCallbackNotice() {
  const { callbackNotice, dismissCallbackNotice } = useAuth();
  if (!callbackNotice) return null;
  return <aside className="auth-callback-notice" aria-label="Aviso de autenticação">
    <p role="alert">{callbackNotice.message}</p>
    <button type="button" aria-label="Fechar aviso de autenticação" onClick={dismissCallbackNotice}>×</button>
  </aside>;
}
