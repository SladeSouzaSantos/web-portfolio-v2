import { useCallback, useEffect, useRef, useState } from 'react';
import { orbeConfig } from '../config/orbe';
import { platformConfig } from '../config/platform';
import { CHAT_MAX_MESSAGE_LENGTH, createOrbeClient, OrbeClientError } from '../services/orbeClient';
import { sendDemoMessage } from '../services/orbeDemo';
import type { ChatSource, MeetingChatAction } from '../types/orbe';

interface ChatMessage {
  id: number;
  sender: 'orb' | 'user';
  text: string;
  sources?: ChatSource[];
  simulated?: boolean;
  actions?: MeetingChatAction[];
}

interface ChatNotice { message: string; correlationId?: string }
interface PendingRequest { controller: AbortController; text: string }

const greeting: ChatMessage = {
  id: 0,
  sender: 'orb',
  text: 'Saudações! Sou o Orbe Guardião. Como posso auxiliar sua jornada pelo portfólio de Pedro Santos?',
};

/** Owns the React conversation lifecycle; HTTP/session credentials belong to the client. */
export function useOrbeChat(reducedMotion: boolean) {
  const clientRef = useRef<ReturnType<typeof createOrbeClient> | null>(null);
  const pendingRef = useRef<PendingRequest | null>(null);
  const mountedRef = useRef(false);
  const nextId = useRef(1);
  const [messages, setMessages] = useState<ChatMessage[]>([greeting]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ChatNotice | null>(null);
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      pendingRef.current?.controller.abort();
      pendingRef.current = null;
      clientRef.current?.reset();
    };
  }, []);

  useEffect(() => {
    if (!retryAt) return;
    const timer = window.setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (time >= retryAt) {
        setRetryAt(0);
        window.clearInterval(timer);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryAt]);

  const cancelPending = useCallback(() => {
    const request = pendingRef.current;
    if (!request) return;
    pendingRef.current = null;
    request.controller.abort();
    if (mountedRef.current) {
      setIsLoading(false);
      setQuery(request.text);
      setError({ message: 'Consulta cancelada. A pergunta pode ter sido processada; reenvie apenas se desejar.' });
    }
  }, []);

  async function sendMessage() {
    if (pendingRef.current || Date.now() < retryAt) return;
    const text = query.trim();
    if (!text || text.length > CHAT_MAX_MESSAGE_LENGTH) {
      setError({ message: `Escreva uma pergunta com até ${CHAT_MAX_MESSAGE_LENGTH} caracteres.` });
      return;
    }
    const request: PendingRequest = { controller: new AbortController(), text };
    pendingRef.current = request;
    setMessages(current => [...current, { id: nextId.current++, sender: 'user', text }]);
    setQuery('');
    setError(null);
    setIsLoading(true);
    try {
      if (orbeConfig.enabled && !clientRef.current) clientRef.current = createOrbeClient(orbeConfig.apiBaseUrl, {
        meetingCapabilities: platformConfig.enabled,
      });
      const reply = orbeConfig.enabled
        ? await clientRef.current!.send(text, { signal: request.controller.signal })
        : await sendDemoMessage(text, request.controller.signal, reducedMotion);
      if (!mountedRef.current || pendingRef.current !== request || request.controller.signal.aborted) return;
      setMessages(current => [...current, {
        id: nextId.current++, sender: 'orb', text: reply.answer,
        sources: reply.sources, simulated: reply.meta.simulated,
        actions: reply.actions,
      }]);
    } catch (failure) {
      if (!mountedRef.current || pendingRef.current !== request || request.controller.signal.aborted) return;
      const issue = failure instanceof OrbeClientError ? failure : null;
      setQuery(text);
      setError({
        message: issue?.code === 'LLM_BUDGET_EXHAUSTED'
          ? 'O orçamento de consultas ao Orbe foi esgotado. Tente novamente mais tarde.'
          : issue?.publicMessage ?? 'Não foi possível consultar o Orbe. Tente novamente apenas se desejar.',
        correlationId: issue?.correlationId,
      });
      if (issue?.retryAfterSeconds) {
        const time = Date.now();
        setNow(time);
        setRetryAt(time + issue.retryAfterSeconds * 1000);
      }
    } finally {
      if (pendingRef.current === request) {
        pendingRef.current = null;
        if (mountedRef.current) setIsLoading(false);
      }
    }
  }

  return {
    messages, query, setQuery, isLoading, error, sendMessage, cancelPending,
    cooldownSeconds: Math.max(0, Math.ceil((retryAt - now) / 1000)),
    maxMessageLength: CHAT_MAX_MESSAGE_LENGTH,
    apiEnabled: orbeConfig.enabled,
  };
}
