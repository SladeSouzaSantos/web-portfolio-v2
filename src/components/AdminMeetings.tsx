import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { createAdminMeetingsClient, type MeetingDecision } from '../services/adminMeetingsClient';
import { PlatformApiError } from '../services/platformHttp';
import type { AdminMeetingItem, MeetingStatus } from '../types/meetings';
import { MeetingStatusView, formatMeetingInstant } from './meetings/MeetingStatusView';
import { Modal } from './Modal';

const statuses: MeetingStatus[] = ['PENDING', 'APPROVED', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'FAILED'];
const decisions: Record<MeetingDecision, string> = { approve: 'APROVAR', reject: 'REJEITAR', cancel: 'CANCELAR' };
const searchText = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR');

export function AdminMeetings() {
  const { state, client } = useAuth();
  const api = useMemo(() => client ? createAdminMeetingsClient(client) : null, [client]);
  const [items, setItems] = useState<AdminMeetingItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<MeetingStatus | ''>('');
  const [query, setQuery] = useState('');
  const [order, setOrder] = useState<'received' | 'start'>('received');
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<PlatformApiError | null>(null);
  const [decision, setDecision] = useState<{ item: AdminMeetingItem; action: MeetingDecision } | null>(null);
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now);
  const retryDeadline = useRef(0);
  const reading = useRef<AbortController | null>(null);
  const writing = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const isAdmin = state.status === 'authenticated' && state.user?.roles.includes('admin');

  const reportError = useCallback((issue: unknown) => {
    const failure = issue instanceof PlatformApiError ? issue
      : new PlatformApiError('network', 'Não foi possível consultar os pedidos. Tente novamente se desejar.');
    setError(failure);
    if (failure.retryAt !== undefined) {
      const deadline = failure.retryAt;
      retryDeadline.current = deadline;
      setRetryAt(deadline);
      setNow(Date.now());
    }
  }, []);

  const load = useCallback(async (cursor?: string, preserveError = false) => {
    if (!api || !isAdmin || Date.now() < retryDeadline.current) return;
    reading.current?.abort();
    const request = new AbortController();
    reading.current = request;
    setLoading(true);
    if (!preserveError) setError(null);
    try {
      const result = await api.list({ cursor, status: status || undefined, signal: request.signal });
      if (!mounted.current || reading.current !== request || request.signal.aborted) return;
      setItems(current => cursor
        ? [...current, ...result.items.filter(item => !current.some(existing => existing.id === item.id))]
        : result.items);
      setNextCursor(result.nextCursor);
      setHasLoaded(true);
    } catch (issue) {
      if (mounted.current && reading.current === request && !request.signal.aborted) reportError(issue);
    } finally {
      if (mounted.current && reading.current === request) {
        reading.current = null;
        setLoading(false);
      }
    }
  }, [api, isAdmin, reportError, status]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      reading.current?.abort();
      writing.current?.abort();
    };
  }, []);

  useEffect(() => {
    setItems([]);
    setNextCursor(null);
    setHasLoaded(false);
    void load();
    return () => reading.current?.abort();
  }, [load]);

  useEffect(() => {
    if (!retryAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    const finish = window.setTimeout(() => {
      retryDeadline.current = 0;
      setRetryAt(0);
      setNow(Date.now());
    }, Math.max(0, retryAt - Date.now()));
    return () => { window.clearInterval(timer); window.clearTimeout(finish); };
  }, [retryAt]);

  const visibleItems = useMemo(() => {
    const needle = searchText(query.trim());
    const matches = items.filter(item => !needle || searchText(`${item.name} ${item.email} ${item.topic}`).includes(needle));
    return matches.sort((left, right) => order === 'start'
      ? Date.parse(left.start) - Date.parse(right.start)
      : Date.parse(right.createdAt) - Date.parse(left.createdAt));
  }, [items, query, order]);
  const summary = useMemo(() => [
    { label: 'Pedidos carregados', count: items.length },
    { label: 'Confirmadas', count: items.filter(item => item.status === 'CONFIRMED').length },
    { label: 'Aguardando análise', count: items.filter(item => item.status === 'PENDING').length },
    { label: 'Aguardando agenda', count: items.filter(item => item.status === 'APPROVED').length },
    { label: 'Canceladas', count: items.filter(item => item.status === 'CANCELLED').length },
  ], [items]);

  function closeDecision() {
    const active = writing.current;
    if (active) {
      active.abort();
      writing.current = null;
      setBusy(false);
      setError(new PlatformApiError('aborted', 'A espera foi interrompida. A decisão pode ter sido registrada no servidor; atualize os pedidos antes de decidir reenviar.'));
    }
    setDecision(null);
  }

  async function confirmDecision() {
    if (!api || !decision || !isAdmin || writing.current || Date.now() < retryAt) return;
    const request = new AbortController();
    writing.current = request;
    setBusy(true);
    setError(null);
    try {
      const result = await api.decide(decision.item.id, decision.action, request.signal);
      if (!mounted.current || request.signal.aborted || writing.current !== request) return;
      setItems(current => current.map(item => item.id === result.id ? { ...item, ...result } : item));
      setDecision(null);
      void load();
    } catch (issue) {
      if (!mounted.current || request.signal.aborted || writing.current !== request) return;
      setDecision(null);
      reportError(issue);
      // A conflict can mean that another operator already changed this request.
      // Refresh the read model once, while preserving the decision error.
      if (issue instanceof PlatformApiError && issue.status === 409) void load(undefined, true);
    } finally {
      if (writing.current === request) {
        writing.current = null;
        if (mounted.current) setBusy(false);
      }
    }
  }

  if (!isAdmin) return null;
  const coolingDown = Date.now() < retryAt;
  return <section className="phase3-admin" aria-labelledby="admin-meetings-title">
    <h2 id="admin-meetings-title">[ AGENDA E PEDIDOS ]</h2>
    <p>Pedidos de reunião. As decisões são verificadas pelo servidor; a agenda pode ser atualizada depois da resposta.</p>
    {hasLoaded && !loading && !error && <section className="phase3-admin-summary" aria-label="Resumo dos pedidos carregados">
      <h3>RESUMO DOS PEDIDOS CARREGADOS</h3>
      <p>Contagens dos pedidos carregados para o filtro atual; não representam os totais globais do portfólio.</p>
      <dl>{summary.map(metric => <div key={metric.label}><dt>{metric.label}</dt><dd>{metric.count}</dd></div>)}</dl>
      <p>{nextCursor ? 'Há outra página de pedidos. O resumo é parcial; carregue mais pedidos para ampliá-lo.'
        : 'Todos os pedidos retornados nesta consulta foram carregados.'}</p>
    </section>}
    <div className="phase3-admin-controls">
      <div className="phase3-admin-filter">
        <label htmlFor="admin-status">FILTRAR SITUAÇÃO</label>
        <select id="admin-status" value={status} disabled={loading || busy || coolingDown}
          onChange={event => setStatus(event.target.value as MeetingStatus | '')}>
          <option value="">TODAS</option>
          {statuses.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </div>
      <button type="button" className="login-submit-btn" disabled={loading || busy || coolingDown} onClick={() => void load()}>ATUALIZAR PEDIDOS</button>
    </div>
    <div className="phase3-admin-local-controls">
      <div><label htmlFor="admin-search">BUSCAR NOS PEDIDOS CARREGADOS</label>
        <input id="admin-search" type="search" value={query} maxLength={200} placeholder="Nome, e-mail ou assunto"
          onChange={event => setQuery(event.target.value)} aria-describedby="admin-local-scope" /></div>
      <div><label htmlFor="admin-order">ORDENAR PEDIDOS CARREGADOS</label>
        <select id="admin-order" value={order} onChange={event => setOrder(event.target.value as 'received' | 'start')}
          aria-describedby="admin-local-scope">
          <option value="received">Recebidos recentemente</option>
          <option value="start">Data da reunião: crescente</option>
        </select></div>
    </div>
    <p id="admin-local-scope" className="phase3-admin-note">A busca e a ordenação consideram apenas os pedidos já carregados. Use o filtro de situação para consultar a API.</p>
    <p id="admin-edit-unavailable" className="phase3-admin-note">Alterar dados ou reagendar reuniões ainda não está disponível. O cancelamento exige confirmação.</p>
    {loading && <p role="status">[ CONSULTANDO PEDIDOS... ]</p>}
    {error && <div role="alert" className="phase3-error">
      <p>{error.publicMessage}</p>
      {error.correlationId && <small>Referência: {error.correlationId}</small>}
      <p>Se uma decisão falhou por conexão ou timeout, confira o estado antes de decidir reenviar.</p>
    </div>}
    {coolingDown && <p role="status">Aguarde {Math.max(0, Math.ceil((retryAt - now) / 1000))}s antes de consultar novamente.</p>}
    {!loading && !error && items.length === 0 && <p>Nenhum pedido encontrado para este filtro.</p>}
    {hasLoaded && !loading && !error && items.length > 0 && <p role="status">Exibindo {visibleItems.length} de {items.length} pedidos carregados.
      {visibleItems.length === 0 && ' Nenhum pedido carregado corresponde à busca; outras páginas podem conter resultados.'}</p>}
    <div className="phase3-admin-list" aria-busy={loading}>
      {visibleItems.map(item => <article key={item.id} className="phase3-admin-card" aria-label={`Pedido de ${item.name}`}>
        <h2>{item.name}</h2>
        <p>{item.email}</p>
        <p className="phase3-admin-topic">{item.topic}</p>
        <MeetingStatusView value={item} />
        <p>Recebido em: {formatMeetingInstant(item.createdAt, item.timeZone)}</p>
        {item.failureCode && <p>Código de falha: {item.failureCode}</p>}
        <div className="phase3-admin-actions">
          {(Object.keys(decisions) as MeetingDecision[]).map(action => <button key={action} type="button"
            className="login-submit-btn" disabled={busy || loading || coolingDown}
            onClick={() => setDecision({ item, action })}>{decisions[action]}</button>)}
          <button type="button" className="login-submit-btn" disabled aria-describedby="admin-edit-unavailable">ALTERAR REUNIÃO</button>
        </div>
      </article>)}
    </div>
    {nextCursor && <button type="button" className="login-submit-btn" disabled={loading || busy || coolingDown}
      onClick={() => void load(nextCursor)}>CARREGAR MAIS PEDIDOS</button>}
    {decision && <Modal overlayClassName="login-modal-overlay ativo" panelClassName="login-modal-box phase3-decision-panel"
      labelledBy="admin-decision-title" describedBy="admin-decision-description" onClose={closeDecision}>
      <div className="login-modal-header">
        <h2 id="admin-decision-title">[ CONFIRMAR DECISÃO ]</h2>
        <button type="button" className="login-close-btn" aria-label="Fechar confirmação" onClick={closeDecision}>×</button>
      </div>
      <div className="login-modal-body">
        <p id="admin-decision-description">{decisions[decision.action]} o pedido de {decision.item.name}?
          Esta decisão pode iniciar operações na agenda e notificações externas.</p>
        <p>{formatMeetingInstant(decision.item.start, decision.item.timeZone)} · {decision.item.timeZone}</p>
        <button type="button" className="login-submit-btn" disabled={busy} onClick={() => void confirmDecision()}>
          {busy ? 'PROCESSANDO...' : `CONFIRMAR ${decisions[decision.action]}`}
        </button>
        <button type="button" className="login-submit-btn" disabled={busy} onClick={closeDecision}>VOLTAR SEM DECIDIR</button>
        {busy && <p role="status">[ REGISTRANDO DECISÃO... ]</p>}
      </div>
    </Modal>}
  </section>;
}
