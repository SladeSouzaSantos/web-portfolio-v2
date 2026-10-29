import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { createAdminConversationClient } from '../services/adminConversationClient';
import { PlatformApiError } from '../services/platformHttp';
import type { AdminConversationInsights, ConversationInsightItem, ConversationIntent } from '../types/adminConversations';

const labels: Record<ConversationIntent, string> = {
  unknown: 'Indeterminada',
  curiosity: 'Curiosidade',
  technical: 'Dúvida técnica',
  opportunity: 'Oportunidade profissional',
  business: 'Parceria ou serviço',
  meeting: 'Agendamento',
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export function AdminConversations() {
  const { client, state } = useAuth();
  const api = useMemo(() => client ? createAdminConversationClient(client) : null, [client]);
  const isAdmin = state.status === 'authenticated' && state.user?.roles.includes('admin');
  const [report, setReport] = useState<AdminConversationInsights | null>(null);
  const [items, setItems] = useState<ConversationInsightItem[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef<AbortController | null>(null);
  const mounted = useRef(false);

  const load = useCallback(async (offset = 0) => {
    if (!api || !isAdmin) return;
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    setBusy(true);
    setError(null);
    try {
      const result = await api.list({ offset, signal: controller.signal });
      if (!mounted.current || controller.signal.aborted || inflight.current !== controller) return;
      setReport(result);
      setItems(previous => offset === 0 ? result.items :
        [...previous, ...result.items.filter(item => !previous.some(existing => existing.id === item.id))]);
      setNextOffset(result.nextOffset);
    } catch (issue) {
      if (!mounted.current || controller.signal.aborted || inflight.current !== controller) return;
      setError(issue instanceof PlatformApiError ? issue.publicMessage :
        'Não foi possível consultar os indicadores do Orbe.');
    } finally {
      if (inflight.current === controller) {
        inflight.current = null;
        if (mounted.current) setBusy(false);
      }
    }
  }, [api, isAdmin]);

  useEffect(() => {
    mounted.current = true;
    if (isAdmin) void load();
    return () => { mounted.current = false; inflight.current?.abort(); };
  }, [isAdmin, load]);

  if (!isAdmin) return null;
  return <div className="admin-conversations">
    <p>Resumo temático e intenção provável de cada conversa. Classificação automática por regras, sem identificação do visitante.</p>
    <p className="admin-conversations-note">
      Os indicadores consideram os últimos {report?.retentionDays ?? '—'} dias e começam a ser coletados após a atualização do backend.
      Uma conversa pode conter várias perguntas; reabrir o chat não cria uma conversa nova.
    </p>
    {report && <div className="admin-dashboard-metrics" aria-label="Indicadores do Orbe">
      <div className="admin-dashboard-metric"><strong>CONVERSAS ÚNICAS</strong><p>{report.totals.conversations}</p></div>
      <div className="admin-dashboard-metric"><strong>PERGUNTAS RESPONDIDAS</strong><p>{report.totals.questions}</p></div>
      <div className="admin-dashboard-metric"><strong>INTENÇÕES IDENTIFICADAS</strong>
        {report.intents.length ? <ul>{report.intents.map(item =>
          <li key={item.name}>{labels[item.name as ConversationIntent] ?? 'Indeterminada'}: {item.total}</li>)}</ul>
          : <p>Nenhuma ainda.</p>}
      </div>
      <div className="admin-dashboard-metric"><strong>ASSUNTOS FREQUENTES</strong>
        {report.topics.length ? <ul>{report.topics.map(item => <li key={item.name}>{item.name}: {item.total}</li>)}</ul>
          : <p>Nenhum ainda.</p>}
      </div>
    </div>}
    <div className="admin-conversations-controls">
      <button type="button" className="login-submit-btn" disabled={busy} onClick={() => void load()}>
        ATUALIZAR INDICADORES
      </button>
    </div>
    {busy && <p role="status">[ CONSULTANDO AS CONVERSAS... ]</p>}
    {error && <p role="alert">{error}</p>}
    {report && !busy && !error && items.length === 0 && <p>Nenhuma conversa registrada nesse período.</p>}
    {items.length > 0 && <div className="admin-conversations-list" aria-label="Resumos de conversas">
      {items.map(item => <article key={item.id} className="admin-conversations-item">
        <h3>{labels[item.intent]}</h3>
        <p>{item.summary}</p>
        <p className="admin-conversations-note">
          {item.turns} {item.turns === 1 ? 'pergunta' : 'perguntas'} · Atualizada em {formatDate(item.updatedAt)}
        </p>
        {!!item.topics.length && <p className="admin-conversations-note">Assuntos: {item.topics.join(', ')}</p>}
      </article>)}
    </div>}
    {nextOffset !== null && <button type="button" className="login-submit-btn"
      disabled={busy} onClick={() => void load(nextOffset)}>CARREGAR MAIS CONVERSAS</button>}
    {report && <p className="admin-conversations-note">Indicadores atualizados em {formatDate(report.generatedAt)}.
      Não representam identificação ou confirmação da intenção real de cada visitante.</p>}
  </div>;
}
