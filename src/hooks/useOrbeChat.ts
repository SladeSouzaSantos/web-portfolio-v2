import { useCallback, useEffect, useRef, useState } from 'react';
import { orbeConfig } from '../config/orbe';
import { CHAT_MAX_MESSAGE_LENGTH, createOrbeClient, OrbeClientError } from '../services/orbeClient';
import { sendDemoMessage } from '../services/orbeDemo';
import type { ChatSource } from '../types/orbe';
import {
  clearOrbeTranscript, MAX_ORBE_USER_TURNS, restoreOrbeTranscript, saveOrbeTranscript,
} from '../services/orbeTranscript';

interface ChatMessage {
  id: number;
  sender: 'orb' | 'user';
  text: string;
  sources?: ChatSource[];
  simulated?: boolean;
}

interface ChatNotice { message: string; correlationId?: string }
interface PendingRequest { controller: AbortController; text: string }

const greeting: ChatMessage = {
  id: 0,
  sender: 'orb',
  text: 'Saudações! Sou Orbe, assistente do portfólio de Pedro Santos. Está recrutando para uma vaga Java ou IA? Posso apresentar sua experiência, mostrar projetos e comparar requisitos de oportunidades.',
};

/** Owns the React conversation lifecycle; HTTP/session credentials belong to the client. */
export function useOrbeChat(reducedMotion: boolean) {
  const clientRef = useRef<ReturnType<typeof createOrbeClient> | null>(null);
  const pendingRef = useRef<PendingRequest | null>(null);
  const mountedRef = useRef(false);
  const nextId = useRef(1);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const restored = restoreOrbeTranscript();
    // Keep the conversation, but replace an outdated greeting from the local cache.
    return restored.length && restored[0]?.id === 0 && restored[0].sender === 'orb'
      ? [greeting, ...restored.slice(1)] : [greeting];
  });
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
    saveOrbeTranscript(messages);
    nextId.current = Math.max(nextId.current, ...messages.map(m => m.id + 1));
  }, [messages]);

  const userTurnCount = messages.filter(message => message.sender === 'user').length;
  const limitReached = MAX_ORBE_USER_TURNS > 0 && userTurnCount >= MAX_ORBE_USER_TURNS;

  const newConversation = useCallback(() => {
    pendingRef.current?.controller.abort();
    pendingRef.current = null;
    clientRef.current?.reset();
    clearOrbeTranscript();
    nextId.current = 1;
    setMessages([greeting]);
    setQuery('');
    setIsLoading(false);
    setError(null);
    setRetryAt(0);
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
    if (limitReached) {
      setError({ message: `Esta conversa atingiu o limite de ${MAX_ORBE_USER_TURNS} perguntas. Copie-a e inicie uma nova conversa.` });
      return;
    }
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
      if (orbeConfig.enabled && !clientRef.current) clientRef.current = createOrbeClient(orbeConfig.apiBaseUrl);
      const reply = orbeConfig.enabled
        ? await clientRef.current!.send(text, { signal: request.controller.signal })
        : await sendDemoMessage(text, request.controller.signal, reducedMotion);
      if (!mountedRef.current || pendingRef.current !== request || request.controller.signal.aborted) return;
      setMessages(current => [...current, {
        id: nextId.current++, sender: 'orb', text: reply.answer,
        sources: reply.sources, simulated: reply.meta.simulated,
      }]);
    } catch (failure) {
      if (!mountedRef.current || pendingRef.current !== request || request.controller.signal.aborted) return;
      const issue = failure instanceof OrbeClientError ? failure : null;
      setQuery(text);
      setError({
        message: issue?.code === 'LLM_BUDGET_EXHAUSTED'
          ? 'O limite global de chamadas de IA foi atingido. Tente novamente após a renovação da cota.'
          : issue?.code === 'LLM_PROVIDERS_LIMITED'
            ? 'Todos os provedores de IA configurados estão temporariamente limitados. Tente novamente depois da renovação das cotas.'
            : issue?.code === 'LLM_UNAVAILABLE'
              ? 'Nenhum dos provedores de IA configurados conseguiu responder. Tente novamente mais tarde.'
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
    newConversation, userTurnCount, limitReached, maxUserTurns: MAX_ORBE_USER_TURNS,
    cooldownSeconds: Math.max(0, Math.ceil((retryAt - now) / 1000)),
    maxMessageLength: CHAT_MAX_MESSAGE_LENGTH,
    apiEnabled: orbeConfig.enabled,
  };
}
