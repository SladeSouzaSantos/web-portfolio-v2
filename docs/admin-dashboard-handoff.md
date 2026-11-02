# Relatórios do Orbe e gestão da agenda

O objetivo do proprietário é entender o interesse profissional gerado pelo
portfólio: quais dúvidas aparecem, a intenção das conversas e quantas chegam
a um contato ou reunião. Este documento é o handoff para a instância responsável
pelo `phasscode-platform`; nenhum arquivo do backend foi modificado.

## Contrato efetivamente publicado

O [OpenAPI DEV](https://devapi.phasscode.com/api/v1/openapi.json) foi consultado
em 25/10/2026, versão `0.1.0`, antes de ler o código do backend no GitHub.

| Disponível | Limitação |
| --- | --- |
| `GET /api/v1/admin/meetings` | `cursor`, `limit` e `status`; retorna somente `items` e `nextCursor` |
| `POST /api/v1/admin/meetings/{id}/approve` | Sem corpo; não é edição de dados |
| `POST /api/v1/admin/meetings/{id}/reject` | Sem corpo |
| `POST /api/v1/admin/meetings/{id}/cancel` | Sem corpo; pode preceder a conclusão da remoção externa |
| `POST /api/v1/chat` | Não fornece consulta administrativa do histórico ou relatórios |

Não estão publicados: agregados de conversas/perguntas/intenção, totais globais
de reuniões, leitura administrativa de conversas e edição/reagendamento.
O frontend não chama endpoints presumidos para essas funções.

## Regra de conversa definida pelo proprietário

- Uma conversa é uma interação única, mesmo com várias perguntas/respostas.
- Fechar e reabrir o modal mantém a conversa e não pode duplicar a contagem.
- Recarregar a página perde o histórico/ID/token locais. A próxima mensagem
  inicia outra conversa; apenas abrir o modal ou recarregar sem conversar não
  deve criar uma interação contabilizada.
- O botão **NOVA CONVERSA** foi retirado. O frontend não envia um evento de
  conclusão ao fechar o modal e não presume conclusão por inatividade.
- Agregar pelo identificador de conversa registrado pelo backend, evitando
  contagens por abertura de modal, por mensagem ou por renderização React.
- O ciclo atual continua em memória enquanto o Orbe permanece montado. A
  navegação para uma rota que o desmonta também descarta a sessão; isso deve ser
  considerado na validação dos agregados. Não há identidade persistente do visitante.

## Intenção e relatórios solicitados

1. Conversas únicas e perguntas respondidas no período, com limites do período,
   fuso e instante de atualização claramente informados.
2. Perguntas/assuntos mais frequentes sobre tecnologias, projetos e experiência,
   com contagens e alcance. Preferir agregados com texto tratado a expor dados
   pessoais inseridos pelos visitantes.
3. Intenção: curiosidade, interesse em vaga, sondagem profissional ou dúvidas
   técnicas. Prever **indeterminada** e documentar categorias sobrepostas,
   confiança e limitações. Não afirmar que a pessoa é recrutadora apenas pelo tema.
4. Distinguir sinais profissionais explícitos, propostas e reuniões realmente
   confirmadas. Um pedido `PENDING` ou `APPROVED` não é reunião marcada.
5. Para conversão entre conversa e reunião, definir vínculo e denominador no
   servidor. A resposta de chat atual não fornece uma conversão auditável.
6. Informar quando a coleta começou e quais dados históricos existem. Não
   prometer reconstruir conversas anteriores que já não estejam disponíveis.

Essas classificações dependem do backend. O frontend não adiciona classificação
por palavras-chave, novas chamadas LLM, rastreamento persistente ou cópia de
tokens para telemetria. Custos, retenção e acesso aos relatórios precisam ser
definidos no serviço; nenhuma promessa nova de privacidade foi inserida no site.

## Agenda disponível no frontend

- Listagem e filtro de situação já usam cookies e autorização administrativa.
- Busca por nome, e-mail ou assunto e ordenação por recebimento/data atuam apenas
  nos pedidos carregados; não substituem filtros globais do servidor.
- Resumo de pedidos carregados, confirmadas, aguardando análise, aguardando
  agenda e canceladas. Há aviso de alcance parcial quando existe `nextCursor`.
- Aprovar/rejeitar/cancelar exigem confirmação. Não há reenvio automático de
  mutações. Um timeout não comprova que a ação deixou de ser processada.
- **ALTERAR REUNIÃO** permanece indisponível com explicação visível; o frontend
  não substitui reagendamento por cancelamento e nova criação automáticos.

## Contratos necessários do backend

- Relatório administrativo agregado com autorização `admin`, período/fuso,
  definições dos indicadores, estado vazio real e erros públicos.
- Totais globais por situação e período, independentes da paginação de reuniões.
- Edição/reagendamento: campos permitidos, consulta de slots disponíveis,
  controle de versão/conflito `409`, consentimento aplicável e transições reais
  do Calendar/notificações. Indicar se a alteração foi somente aceita ou concluída.
- Preservar cookies HttpOnly e CSRF nas mutações; documentar idempotência,
  cancelamento da espera, `Retry-After` e erros de concorrência/indisponibilidade.
- Publicar OpenAPI e exemplos antes de integrar. Os nomes de rotas/DTOs novos
  devem vir do contrato, não de convenções inventadas no frontend.

Depois da publicação, revisar o cliente HTTP tipado e validar somente com mocks
nos testes automatizados. Homologações de reuniões/Calendar/notificações reais
permanecem sob controle do proprietário, usando destinos autorizados.
