import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { assetUrl } from '../lib/assets';
import { Modal } from './Modal';

export function ChestAccess({ onOpenPanel, onLogout }: { onOpenPanel: () => void; onLogout: () => void }) {
  const [unlocked, setUnlocked] = useState(false);
  const [modal, setModal] = useState<'login' | 'menu' | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const close = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setModal(null);
    setBusy(false);
    setFeedback('');
    setShowPassword(false);
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setFeedback('Verificando runas ancestrais...');
    timers.current.push(setTimeout(() => {
      setUnlocked(true);
      setFeedback('TESOURO DESTRAVADO! PRÉVIA ATIVADA.');
      timers.current.push(setTimeout(close, 900));
    }, 700));
  };
  return <>
    <button id="nav-login" type="button" aria-label={unlocked ? 'Abrir baú do mestre' : 'Abrir prévia de login'} className="botao-icone"
      onClick={() => setModal(unlocked ? 'menu' : 'login')}>
      <span className="perspectiva-svg"><svg className="icon-padlock" viewBox="0 0 32 32" aria-hidden="true">
        <use href={`${assetUrl('icons.svg')}#icon-chest-${unlocked ? 'open' : 'closed'}`} />
      </svg></span>
    </button>
    {modal === 'login' && <Modal overlayClassName="login-modal-overlay ativo" panelClassName="login-modal-box" labelledBy="login-title" describedBy="login-description" onClose={close}>
      <div className="login-modal-header"><h2 id="login-title">[ PORTAL DE AUTENTICAÇÃO ]</h2>
        <button type="button" className="login-close-btn" aria-label="Fechar login" onClick={close}>×</button></div>
      <div className="login-modal-body">
        <p id="login-description" className="login-subtitle">Prévia visual do portal. Use dados fictícios: nenhuma credencial é enviada ou validada.</p>
        <form className="login-form" onSubmit={submit}>
          <div className="login-input-group"><label htmlFor="usuario">IDENTIFICAÇÃO (USER):</label>
            <input type="text" id="usuario" name="usuario" required placeholder="Ex: PedroSantos" autoComplete="off" disabled={busy} /></div>
          <div className="login-input-group"><label htmlFor="senha">CHAVE MÁGICA (SENHA):</label>
            <div className="login-password-wrapper">
              <input type={showPassword ? 'text' : 'password'} id="senha" name="senha" required placeholder="••••••••" autoComplete="off" disabled={busy} />
              <button type="button" className="login-toggle-pass-btn" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                aria-pressed={showPassword} onClick={() => setShowPassword(current => !current)}>
                <svg className="icon-eye-svg" viewBox="0 0 32 32" aria-hidden="true"><use href={`${assetUrl('icons.svg')}#icon-eye${showPassword ? '-off' : ''}`} /></svg>
              </button>
            </div>
          </div>
          <button type="submit" className="login-submit-btn" disabled={busy}>{busy ? 'AGUARDE...' : 'DESTRAVAR PORTAL'}</button>
        </form>
        <p className="login-feedback" role="status">{feedback}</p>
      </div>
    </Modal>}
    {modal === 'menu' && <Modal overlayClassName="login-modal-overlay ativo" panelClassName="login-modal-box chest-menu-panel" labelledBy="chest-title" onClose={close}>
      <div className="login-modal-header"><h2 id="chest-title">[ BAÚ DO MESTRE: ATIVO ]</h2>
        <button type="button" className="login-close-btn" aria-label="Fechar baú" onClick={close}>×</button></div>
      <div className="login-modal-body chest-menu-actions">
        <p className="login-subtitle">O tesouro está acessível. O que deseja fazer, Mestre?</p>
        <button type="button" className="login-submit-btn chest-open-panel" onClick={() => { close(); onOpenPanel(); }}>[ IR PARA ÁREA RESTRITA ]</button>
        <button type="button" className="login-submit-btn chest-logout" onClick={() => { close(); setUnlocked(false); onLogout(); }}>[ TRANCAR BAÚ (LOGOUT) ]</button>
      </div>
    </Modal>}
  </>;
}
