import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { startOrbRenderer, type OrbRenderer } from '../effects/orbRenderer';
import { useReducedMotion } from '../hooks/useMediaQuery';
import { Modal } from './Modal';

const GREETINGS = [
  'Saudações, Herói! Sou o Orbe de Acesso. Clique em mim para abrir o guia do portfólio!',
  'Procura saber mais sobre Pedro Santos? Clique em mim para conversar!',
  'Dica: explore as abas acima para ver projetos, experiências e estudos!',
  'Quer conhecer as habilidades de Pedro? Clique no orbe para consultar o guia!',
  'O sistema opera com estabilidade máxima nas runas de código. Em que posso ajudar?',
];

interface ChatMessage {
  id: number;
  sender: 'orb' | 'user';
  text: string;
}

function getReply(query: string): string {
  const normalized = query.toLocaleLowerCase('pt-BR');
  if (normalized.includes('projeto')) {
    return 'Pedro desenvolveu projetos como o SDGP (Dimensionamento Solar em Flutter), o Lithology (Logs Geológicos em Java) e o ReserGas (Cálculos de Fluidos de Reservatórios).';
  }
  if (normalized.includes('contato') || normalized.includes('contacto') || normalized.includes('email') || normalized.includes('e-mail')) {
    return 'Você pode entrar em contato diretamente pelo LinkedIn ou GitHub oficial de Pedro Santos! Os links estão na apresentação do portfólio.';
  }
  return 'Este guia tem respostas demonstrativas. Pedro Santos possui experiência em Engenharia e Desenvolvimento de Software (Java, Dart, Flutter, Python, PHP e C++). Experimente perguntar sobre projetos ou contato.';
}

export function OrbAssistant() {
  const reducedMotion = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const rendererRef = useRef<OrbRenderer | null>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const replyTimersRef = useRef(new Set<number>());
  const nextMessageId = useRef(1);
  const [touchDevice, setTouchDevice] = useState(false);
  const [near, setNear] = useState(false);
  const [bubbleDismissed, setBubbleDismissed] = useState(false);
  const [greeting, setGreeting] = useState(GREETINGS[0]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: 0,
    sender: 'orb',
    text: 'Saudações! Sou o Orbe Guardião. Como posso auxiliar sua jornada pelo portfólio de Pedro Santos?',
  }]);

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
    const timers = replyTimersRef.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  useEffect(() => {
    if (open && historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [messages, open]);

  const closeChat = useCallback(() => setOpen(false), []);
  const showBubble = !open && !bubbleDismissed && (touchDevice || near);

  function openChat() {
    rendererRef.current?.activate();
    setOpen(true);
  }

  function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;
    setMessages((current) => [...current, { id: nextMessageId.current++, sender: 'user', text: trimmedQuery }]);
    setQuery('');
    const timer = window.setTimeout(() => {
      replyTimersRef.current.delete(timer);
      setMessages((current) => [...current, { id: nextMessageId.current++, sender: 'orb', text: getReply(trimmedQuery) }]);
    }, reducedMotion ? 0 : 700);
    replyTimersRef.current.add(timer);
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
            <span id="orbChatTitle">[ CONSULTAR ORBE MÁGICO ]</span>
            <button type="button" className="login-close-btn" aria-label="Fechar guia do portfólio" onClick={closeChat}>×</button>
          </div>
          <div className="login-modal-body" style={{ padding: 16 }}>
            <p id="orbChatDescription" className="login-subtitle" style={{ marginBottom: 12 }}>Guia interativo em demonstração, com respostas predefinidas sobre habilidades, projetos e contato.</p>
            <div ref={historyRef} className="orb-chat-history" role="log" aria-label="Conversa com o orbe" aria-live="polite" aria-relevant="additions text" tabIndex={0}>
              {messages.map((message) => (
                <div key={message.id} className={`chat-msg ${message.sender === 'orb' ? 'orb-msg' : 'user-msg'}`}>
                  <span className="chat-sender">{message.sender === 'orb' ? '[ORBE]:' : '[VOCÊ]:'}</span> {message.text}
                </div>
              ))}
            </div>
            <form className="orb-chat-form" onSubmit={submitMessage}>
              <input type="text" aria-label="Sua pergunta ao orbe" placeholder="Ex: Quais são os projetos do Pedro?" autoComplete="off" required maxLength={1000} value={query} onChange={(event) => setQuery(event.target.value)} />
              <button type="submit" className="orb-chat-send-btn">ENVIAR</button>
            </form>
          </div>
        </Modal>
      )}
    </>
  );
}
