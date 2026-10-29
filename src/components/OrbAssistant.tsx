import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { startOrbRenderer, type OrbRenderer } from '../effects/orbRenderer';
import { useReducedMotion } from '../hooks/useMediaQuery';
import { useOrbeChat } from '../hooks/useOrbeChat';
import { getOrbeSources } from '../services/orbeSources';
import { Modal } from './Modal';
import type { MeetingProposal } from '../types/meetings';

const GREETINGS = [
  'Saudações, Herói! Sou o Orbe de Acesso. Clique em mim para abrir o guia do portfólio!',
  'Procura saber mais sobre Pedro Santos? Clique em mim para conversar!',
  'Dica: explore as abas acima para ver projetos, experiências e estudos!',
  'Quer conhecer as habilidades de Pedro? Clique no orbe para consultar o guia!',
  'O sistema opera com estabilidade máxima nas runas de código. Em que posso ajudar?',
];

export function OrbAssistant({ onMeetingProposal }: { onMeetingProposal?: (proposal: MeetingProposal) => void }) {
  const reducedMotion = useReducedMotion();
  const {
    messages, query, setQuery, isLoading, error, sendMessage, cancelPending,
    cooldownSeconds, maxMessageLength, apiEnabled,
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

  function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage();
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
        <Modal overlayClassName="login-modal-overlay ativo" panelClassName="login-modal-box orb-chat-panel" labelledBy="orbChatTitle" describedBy="orbChatDescription" onClose={closeChat}>
          <div className="login-modal-header">
            <h2 id="orbChatTitle" className="orb-chat-title">[&nbsp;CONSULTAR ORBE MÁGICO&nbsp;]</h2>
            <button type="button" className="login-close-btn" aria-label="Fechar guia do portfólio" onClick={closeChat}>×</button>
          </div>
          <div className="login-modal-body" style={{ padding: 16 }}>
            <p id="orbChatDescription" className="login-subtitle" style={{ marginBottom: 12 }}>{apiEnabled
              ? 'Converse com o Orbe sobre o portfólio e a trajetória profissional de Pedro Santos.'
              : 'Guia interativo em demonstração, com respostas predefinidas sobre habilidades, projetos e contato.'}</p>
            {apiEnabled && <p id="orbChatPrivacy" className="orb-chat-privacy">
              Suas perguntas podem ser enviadas ao provedor de IA e o histórico é armazenado temporariamente.
              O sistema também registra assuntos e intenções prováveis em resumos temáticos acessíveis ao administrador,
              sem copiar o texto das mensagens para esses resumos. Não informe dados pessoais sensíveis.
            </p>}
            <div ref={historyRef} className="orb-chat-history" role="log" aria-label="Conversa com o orbe" aria-live="polite" aria-relevant="additions text" aria-busy={isLoading} tabIndex={0}>
              {messages.map((message) => (
                <div key={message.id} className={`chat-msg ${message.sender === 'orb' ? 'orb-msg' : 'user-msg'}`}>
                  <span className="chat-sender">{message.sender === 'orb' ? '[ORBE]:' : '[VOCÊ]:'}</span> <span className="chat-text">{message.text}</span>
                  {message.simulated && <p className="orb-chat-simulated">[ Resposta simulada ]</p>}
                  {!!message.sources?.length && <div className="orb-chat-sources">
                    <p>[ FONTES CONSULTADAS ]</p>
                    <ul>{getOrbeSources(message.sources).map((source, index) => <li key={`${source.type}-${source.id}-${index}`}>
                      {source.href ? <a href={source.href} target="_blank" rel="noopener noreferrer">{source.title}</a> : source.title}
                    </li>)}</ul>
                  </div>}
                  {!!message.actions?.length && onMeetingProposal && <div className="orb-meeting-actions">
                    <p>Proposta preparada. Nenhuma solicitação foi confirmada.</p>
                    {message.actions.map(action => <button type="button" className="orb-chat-reset-btn" key={action.proposal.proposalId}
                      onClick={() => { closeChat(); onMeetingProposal(action.proposal); }}>
                      REVISAR PROPOSTA DE REUNIÃO
                    </button>)}
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
              <input type="text" aria-label="Sua pergunta ao orbe" aria-describedby={apiEnabled ? 'orbChatPrivacy' : undefined} placeholder="Sua pergunta..." autoComplete="off" required readOnly={isLoading} maxLength={maxMessageLength} value={query} onChange={(event) => setQuery(event.target.value)} />
              <button type="submit" className="orb-chat-send-btn" disabled={isLoading || cooldownSeconds > 0}>ENVIAR</button>
            </form>
          </div>
        </Modal>
      )}
    </>
  );
}
