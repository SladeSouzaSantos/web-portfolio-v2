import { useEffect, useRef, useState } from 'react';
import { assetUrl } from '../lib/assets';
import { useAuth } from '../contexts/AuthContext';
import { PlatformApiError } from '../services/platformHttp';
import { Modal } from './Modal';

interface ChestAccessProps {
  onOpenPanel: () => void;
  onLogout: () => void;
  onOpenMeetings?: () => void;
}
export function ChestAccess({ onOpenPanel, onLogout, onOpenMeetings }: ChestAccessProps) {
  const { state, client, login, logout, refresh, reload } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [now, setNow] = useState(Date.now);
  const mounted = useRef(true);
  const pending = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const authenticated = state.status === 'authenticated' && state.user !== null;
  const admin = authenticated && state.user!.roles.includes('admin');
  const close = () => { setOpen(false); setFeedback(''); };
  const unavailable = !client || state.status === 'unavailable';
  const retryAt = state.retryAt ?? 0;
  const cooldownSeconds = Math.max(0, Math.ceil((retryAt - now) / 1000));
  const coolingDown = Date.now() < retryAt;
  useEffect(() => {
    if (!open || retryAt <= Date.now()) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    const finish = window.setTimeout(() => {
      window.clearInterval(timer);
      setNow(Date.now());
    }, Math.max(0, retryAt - Date.now()));
    return () => { window.clearInterval(timer); window.clearTimeout(finish); };
  }, [open, retryAt]);
  async function action(operation: 'refresh' | 'logout' | 'reload') {
    if (pending.current || Date.now() < retryAt) return;
    pending.current = true;
    setBusy(true);
    setFeedback('Consultando as runas da sessão...');
    try {
      if (operation === 'logout') { await logout(); onLogout(); }
      else if (operation === 'refresh') await refresh();
      else await reload();
      if (mounted.current) setFeedback(operation === 'logout' ? 'Sessão encerrada.' : 'Sessão atualizada.');
    } catch (error) {
      if (operation === 'logout') onLogout();
      if (mounted.current) setFeedback(error instanceof PlatformApiError ? error.publicMessage : 'Não foi possível consultar a sessão.');
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const menuTitle = authenticated ? '[ BAÚ DO AVENTUREIRO ]' : '[ PORTAL DE AUTENTICAÇÃO ]';
  return <>
    <button id="nav-login" type="button" aria-label={authenticated ? 'Abrir baú do aventureiro' : 'Abrir prévia de login'}
      aria-expanded={open} aria-haspopup="dialog" className="botao-icone" onClick={() => { setFeedback(''); setOpen(true); }}>
      <span className="perspectiva-svg"><svg className="icon-padlock" viewBox="0 0 32 32" aria-hidden="true">
        <use href={`${assetUrl('icons.svg')}#icon-chest-${authenticated ? 'open' : 'closed'}`} />
      </svg></span>
    </button>
    {open && <Modal overlayClassName="login-modal-overlay ativo" panelClassName="login-modal-box chest-menu-panel"
      labelledBy="login-title" describedBy="login-description" onClose={close}>
      <div className="login-modal-header"><h2 id="login-title">{menuTitle}</h2>
        <button type="button" className="login-close-btn" aria-label={authenticated ? 'Fechar baú' : 'Fechar login'} onClick={close}>×</button></div>
      <div className="login-modal-body chest-menu-actions" aria-busy={busy || state.status === 'loading'}>
        {authenticated ? <>
          <p id="login-description" className="login-subtitle">Bem-vindo, {state.user!.displayName || 'aventureiro'}.
            {' '}Papel: {admin ? 'administrador' : 'usuário'}.</p>
          {onOpenMeetings && <button type="button" className="login-submit-btn" disabled={busy}
            onClick={() => { close(); onOpenMeetings(); }}>[ SOLICITAR REUNIÃO ]</button>}
          {admin && <button type="button" className="login-submit-btn chest-open-panel" disabled={busy}
            onClick={() => { close(); onOpenPanel(); }}>[ PAINEL DO MESTRE ]</button>}
          <button type="button" className="login-submit-btn" disabled={busy || coolingDown} onClick={() => { void action('reload'); }}>[ ATUALIZAR SESSÃO ]</button>
          <button type="button" className="login-submit-btn" disabled={busy || coolingDown} onClick={() => { void action('refresh'); }}>[ RENOVAR SESSÃO ]</button>
          <button type="button" className="login-submit-btn chest-logout" disabled={busy || coolingDown} onClick={() => { void action('logout'); }}>[ TRANCAR BAÚ (LOGOUT) ]</button>
        </> : <>
          <p id="login-description" className="login-subtitle">{unavailable
            ? 'O portal de autenticação está indisponível neste ambiente. Nenhuma credencial é solicitada ou enviada.'
            : 'Entre com sua conta Google. A autenticação ocorre no Google e a sessão é administrada pelo servidor. Você não precisa entrar para solicitar uma reunião.'}</p>
          {state.status === 'loading' && <p className="login-subtitle" role="status">Consultando sessão...</p>}
          {!unavailable && <button type="button" className="login-submit-btn" disabled={busy || coolingDown || state.status === 'loading'}
            onClick={login}>[ ENTRAR COM GOOGLE ]</button>}
          {client && onOpenMeetings && <button type="button" className="login-submit-btn" disabled={busy}
            onClick={() => { close(); onOpenMeetings(); }}>[ SOLICITAR REUNIÃO SEM LOGIN ]</button>}
          {state.status === 'error' && <button type="button" className="login-submit-btn" disabled={busy || coolingDown}
            onClick={() => { void action('reload'); }}>[ CONSULTAR SESSÃO NOVAMENTE ]</button>}
        </>}
        {state.error && !feedback && <p className="login-feedback" role="alert">{state.error.publicMessage}
          {state.error.correlationId && <small> Referência: {state.error.correlationId}</small>}</p>}
        <p className="login-feedback" role="status">{feedback}</p>
        {coolingDown && <p className="login-feedback" role="status">Aguarde {cooldownSeconds}s antes de consultar ou alterar a sessão novamente.</p>}
      </div>
    </Modal>}
  </>;
}
