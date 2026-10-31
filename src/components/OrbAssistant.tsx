import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { startOrbRenderer, type OrbRenderer } from '../effects/orbRenderer';
import { useReducedMotion } from '../hooks/useMediaQuery';
import { useOrbeChat } from '../hooks/useOrbeChat';
import { getOrbeSources } from '../services/orbeSources';
import { copyOrbeTranscript } from '../services/orbeTranscript';
import { Modal } from './Modal';

const GREETINGS = [
  'Saudações, Herói! Sou o Orbe do Portfólio. Clique em mim para abrir o guia do portfólio!',
  'Procura saber mais sobre Pedro Santos? Clique em mim para conversar!',
  'Dica: explore as abas acima para ver projetos, experiências e estudos!',
  'Quer conhecer as habilidades de Pedro? Clique no orbe para consultar o guia!',
  'O sistema opera com estabilidade máxima nas runas de código. Em que posso ajudar?',
];

export function OrbAssistant() {
  const reducedMotion = useReducedMotion();
  const {
    messages, query, setQuery, isLoading, error, sendMessage, cancelPending,
    cooldownSeconds, maxMessageLength, apiEnabled,
    newConversation, userTurnCount, limitReached, maxUserTurns,
  } = useOrbeChat(reducedMotion);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const rendererRef = useRef<OrbRenderer | null>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const [touchDevice, setTouchDevice] = useState(false);
  const [near, setNear] = useState(false);
  const [bubbleDismissed, setBubbleDismissed] = useState(false);
  const [greeting, setGreeting] = useState(GREETINGS[0]);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');

  useEffect(() => {
    const mediaQuery = window.matchMedia('(hover: none), (max-width: 768px)');
    const update = () => setTouchDevice(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  const handleProximity = useCallback((isNear: boolean) => {
    setNear(isNear);
    if (isNear) setGreeting(GREETINGS[Math.floor(Math.random() * GREETINGS.length)] ?? GREETINGS[0]);
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !triggerRef.current) return;
    const renderer = startOrbRenderer({
      canvas: canvasRef.current,
      container: triggerRef.current,
      reducedMotion,
      onProximityChange: handleProximity,
    });
    rendererRef.current = renderer;
    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
  }, [reducedMotion, handleProximity]);

  useEffect(() => {
    if (open && historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [messages, open, isLoading]);

  const closeChat = useCallback(() => {
    cancelPending();
    setOpen(false);
  }, [cancelPending]);
  const showBubble = !open && !bubbleDismissed && (touchDevice || near);

  function openChat() {
    rendererRef.current?.activate();
    setOpen(true);
  }

  async function copyConversation() {
    try {
      await navigator.clipboard.writeText(copyOrbeTranscript(messages));
      setCopyStatus('Conversa copiada.');
    } catch {
      setCopyStatus('Não foi possível copiar. Verifique a permissão da área de transferência.');
    }
  }

  function startNewConversation() {
    newConversation();
    setCopyStatus('');
  }

  function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage();
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter submits on desktop; Shift+Enter inserts a native newline.
    // An active IME composition (e.g. accented text or CJK) must not submit.
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (!isLoading && cooldownSeconds === 0) event.currentTarget.form?.requestSubmit();
  }

  return (
    <>
      <div id="gbcWidget" className="orb-assistant-widget" style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', pointerEvents: 'none' }}>
        {showBubble && (
          <div id="gbcSpeechBubble" className="gbc-speech-bubble ativo">
            <div className="gbc-speech-header">
              <span>[ ORBE MÁGICO ]</span>
              <button type="button" className="gbc-speech-close-btn" aria-label="Fechar mensagem do orbe" onClick={() => setBubbleDismissed(true)}>×</button>
            </div>
            <p id="gbcSpeechText">{greeting}</p>
          </div>
        )}
        <button
          ref={triggerRef}
          id="gbcSphereContainer"
          type="button"
          className="orb-trigger"
          aria-label="Abrir guia do portfólio"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={openChat}
          style={{ position: 'relative', pointerEvents: 'auto', cursor: 'pointer', padding: 0, border: 0, background: 'transparent', lineHeight: 0 }}
        >
          <canvas ref={canvasRef} id="gbcCanvas" width={160} height={160} aria-hidden="true" style={{ width: 140, height: 140, filter: 'drop-shadow(0 0 12px rgba(56,189,248,0.4))' }} />
        </button>
      </div>
      {open && (
        <Modal overlayClassName="login-modal-overlay ativo" panelClassName={`login-modal-box orb-chat-panel${expanded ? ' orb-chat-panel-expanded' : ''}`} labelledBy="orbChatTitle" describedBy="orbChatDescription" onClose={closeChat}>
          <div className="login-modal-header">
            <h2 id="orbChatTitle" className="orb-chat-title">[&nbsp;CONSULTAR ORBE MÁGICO&nbsp;]</h2>
            <div className="orb-chat-header-actions">
              <button type="button" className="orb-chat-size-btn"
                aria-label="Copiar conversa" title="Copiar conversa"
                onClick={() => void copyConversation()}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="8" y="8" width="12" height="12" rx="2" />
                  <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
                </svg>
              </button>
              <button type="button" className="orb-chat-size-btn"
                aria-label="Nova conversa" title="Nova conversa"
                onClick={startNewConversation} disabled={userTurnCount === 0 && !query}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
                  <path d="M16 5h6M19 2v6M9 12h5" />
                </svg>
              </button>
              <button type="button" className="orb-chat-size-btn"
                aria-label={expanded ? 'Restaurar tamanho do chat' : 'Maximizar chat'}
                title={expanded ? 'Restaurar tamanho do chat' : 'Maximizar chat'}
                aria-pressed={expanded}
                onClick={() => setExpanded(current => !current)}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {expanded ? <>
                    <rect x="6" y="6" width="14" height="14" rx="1" />
                    <path d="M4 16V4h12" />
                  </> : <>
                    <path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5" />
                  </>}
                </svg>
              </button>
              <button type="button" className="login-close-btn" aria-label="Fechar guia do portfólio" onClick={closeChat}>×</button>
            </div>
          </div>
          <div className="login-modal-body" style={{ padding: 16 }}>
            <p id="orbChatDescription" className="login-subtitle" style={{ marginBottom: 12 }}>{apiEnabled
              ? 'Conheça Pedro Santos para sua próxima oportunidade em tecnologia. Pergunte sobre experiência, projetos em Java e IA ou compartilhe os requisitos de uma vaga para uma análise de compatibilidade.'
              : 'Demonstração do representante virtual de Pedro Santos, com respostas predefinidas sobre experiência e projetos.'}</p>
            {apiEnabled && <p id="orbChatPrivacy" className="orb-chat-privacy">
              Não informe dados pessoais sensíveis. As perguntas podem ser processadas pelo
              provedor de IA. O texto fica neste navegador por até 24 horas e pode ser apagado
              com Nova conversa. Recarregar mantém o texto, mas reinicia o contexto da IA.
            </p>}
            <p className="orb-chat-counter" aria-label="Limite de perguntas">
              {maxUserTurns === 0 ? `${userTurnCount} perguntas · sem limite por conversa` : `${userTurnCount}/${maxUserTurns} perguntas nesta conversa`}
            </p>
            {copyStatus && <p role="status" className="orb-chat-copy-status">{copyStatus}</p>}
            <div ref={historyRef} className="orb-chat-history" role="log" aria-label="Conversa com o orbe" aria-live="polite" aria-relevant="additions text" aria-busy={isLoading} tabIndex={0}>
              {messages.map((message) => (
                <div key={message.id} className={`chat-msg ${message.sender === 'orb' ? 'orb-msg' : 'user-msg'}`}>
                  <span className="chat-sender">{message.sender === 'orb' ? '[ORBE]:' : '[VOCÊ]:'}</span> <span className="chat-text">{message.text}</span>
                  {message.simulated && <p className="orb-chat-simulated">[ Resposta simulada ]</p>}
                  {!!message.sources?.length && getOrbeSources(message.sources).length > 0 && <div className="orb-chat-sources">
                    <p>[ PROJETOS RELACIONADOS ]</p>
                    <ul>{getOrbeSources(message.sources).map((source, index) => <li key={`${source.type}-${source.id}-${index}`}>
                      {source.href ? <a href={source.href} target="_blank" rel="noopener noreferrer">{source.title}</a> : source.title}
                    </li>)}</ul>
                  </div>}

                </div>
              ))}
            </div>
            {isLoading && <p className="orb-chat-status" role="status">[ ORBE CONSULTANDO OS REGISTROS... ]</p>}
            {error && <div className="orb-chat-error" role="alert">
              <p>{error.message}</p>
              {error.correlationId && <small>Referência: {error.correlationId}</small>}
            </div>}
            {cooldownSeconds > 0 && <p className="orb-chat-cooldown">Aguarde {cooldownSeconds}s antes de enviar outra pergunta.</p>}
            <form className="orb-chat-form" onSubmit={submitMessage}>
              <textarea rows={2} aria-label="Sua pergunta ao orbe"
                aria-describedby={apiEnabled ? 'orbChatPrivacy orbChatKeyboardHint' : 'orbChatKeyboardHint'}
                placeholder="Sua pergunta..." required readOnly={isLoading}
                maxLength={maxMessageLength} value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleComposerKeyDown} />
              <button type="submit" className="orb-chat-send-btn" disabled={isLoading || cooldownSeconds > 0 || limitReached}>ENVIAR</button>
            </form>
            <p id="orbChatKeyboardHint" className="orb-chat-keyboard-hint">Enter envia · Shift + Enter pula linha</p>
            {limitReached && <p className="orb-chat-limit">Limite atingido. Use Copiar conversa e Nova conversa para continuar.</p>}
          </div>
        </Modal>
      )}
    </>
  );
}
