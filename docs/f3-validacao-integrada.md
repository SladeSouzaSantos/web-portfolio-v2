# F3 — React e Fastify com dependências descartáveis

Base frontend: branch `dev`, commit `ea2d1bcecbe75ebf0f87edca63a2062763b602f8` (F2).
Base backend compatível: branch `dev`, commit `3d547bd1cff773989421ac4160a54c9fffbb9480` (B1).
Implementação local B2/F3, sem commit ou publicação.

## Arquitetura

O comando de entrada pertence ao backend, mantendo os repositórios Git
independentes:

```powershell
cd D:\programming_portfolio\web\back-end-portfolio-gameboy\phasscode-platform
npm run test:e2e -- --frontend D:\programming_portfolio\web\web-portfolio-gameboy --regression
```

O harness cria um projeto Compose UUID com PostgreSQL 17, Redis 7 e um runner
Node 24/Chromium, conectados somente a uma rede Docker `internal`. Não publica
portas, não monta diretórios de DEV/PROD, não reutiliza volumes ou bancos e não
monta o socket Docker dentro do runner. PostgreSQL e Redis usam armazenamento
descartável. O build recebe um snapshot por allowlist de cada checkout `dev`,
sem `.env`, `.npmrc`, `.git`, dependências locais, backups ou links simbólicos.
Somente a construção da imagem precisa de acesso aos registries de dependências;
o runtime dos testes fica isolado de saídas externas.

No runner, React/Vite (`5173`), API (`3000`, encaminhada ao Fastify real em
`3001`), OIDC (`4400`), controle de testes (`4401`) e proxy restritivo do navegador
(`4402`) usam `127.0.0.1`. O proxy permite somente as origens necessárias e
recusa destinos externos e portas locais fora da allowlist. O control plane é
autenticado com chave sintética por execução, não é exposto ao navegador nem
incluído no build de produção do backend.

O Fastify usa os serviços reais de autenticação, autorização e reuniões, os
stores PostgreSQL e o rate limiter Redis. As migrations 001–005 são as originais
da aplicação. OIDC realiza discovery, JWKS, assinatura RS256, issuer/audience,
state, nonce, PKCE e troca de código. A política admin-only permanece no servidor.
Somente o provedor externo é simulado; nenhum endpoint da API é substituído
por `route.fulfill`, fixture HTTP ou servidor de respostas estáticas.

## Fronteiras e observação

- `vite.f3.config.ts` usa `envDir: false`, flags explícitas e guarda de execução
  pertencente ao harness. Não modifica `vite.config.ts` nem a política `main`.
- `playwright.f3.config.ts` exige o harness, usa um worker, zero retries e proxy
  de loopback. Não importa a fixture antiga que instala mocks de API.
- `tests/helpers/integrated-session.ts` importa os clientes de produção por Vite
  e observa somente método, path sem query e status. Cookies e CSRF não são
  impressos; erros de transporte são sanitizados. Trace, vídeo e screenshots
  estão desligados para não persistir dados de OAuth/sessão nos anexos.
- Gates de transporte são barreiras explícitas antes ou depois da chamada real
  ao Fastify. Um gate após a resposta permite confirmar a persistência no banco
  antes de descartar o ACK, sem deduzir cancelamento no servidor.
- Snapshots retornam migrations/checksums, contagens e metadados sintéticos de
  sessões, reuniões, auditoria e outbox. Não retornam credenciais ou perfis.
- O reset de cada cenário só atinge o PostgreSQL/Redis novos do projeto de
  testes. Nenhuma rota de controle existe no bootstrap ou artefato de produção.

## Cobertura e limites

Os cenários visuais passam pelo React real para login permitido/recusado,
callback, retorno seguro, reload, logout, feedback global e decisões
administrativas. Comandos B1 negativos usam a API real; um JWT genuíno que
funciona em leitura comprova que a recusa de Bearer isolado na escrita não é
apenas efeito de uma credencial inválida. Estado PostgreSQL antes/depois,
auditoria e outbox verificam os efeitos persistentes.

Duas páginas da mesma BrowserContext compartilham a sessão real: refresh,
cookie/CSRF rotacionados, notificação, canal ausente, mensagens perdidas,
recuperação por foco, mutação durante refresh, logout confirmado, ACK perdido,
timeout e ausência de Web Locks. Locks/canal são os do navegador; gates e
observações substituem esperas arbitrárias.

Propostas e solicitações públicas são exercitadas pelos clientes de produção no
navegador contra a API real, incluindo idempotência e estado privado. **Isso não
é a homologação completa do formulário público:** hoje ele abre por uma action
do Orbe. O perfil integrado mantém Orbe desligado, LLM mock, Calendar fake,
notificações desabilitadas e worker parado. A outbox permanece não processada.
As regressões existentes do backend verificam seu processamento com adaptadores
fake dentro das mesmas dependências descartáveis quando `--regression` é usado.

A matriz negativa HTTP da F3 usa `approve`; `reject` e `cancel` têm sucesso
pela UI e contrato verificado, complementados pelas negativas da regressão B1.
Revogação, expiração e remoção de papel verificam a consulta real e o cliente
impedindo o POST; as recusas diretas de comandos nesses estados pertencem à B1.
OpenAPI é comparado por metadados de segurança, headers e respostas; a validação
detalhada dos schemas permanece nas suítes de contrato do backend. A auditoria
verifica crescimento e versão; o crescimento da outbox é explícito em `approve`.

As disputas de refresh usam instâncias reais do AuthClient importadas por Vite,
disparadas pelo teste, enquanto login, logout e decisões usam os controles React.
Esta suíte integrada usa Chromium. PKCE negativo é coberto pelos unitários OIDC;
fechamento de aba, timeout de lock e mensagens adversariais permanecem também
nas regressões F2, sem atribuir esses resultados aos 28 cenários integrados.

O cookie real é HttpOnly/Lax em HTTP loopback com `Secure` explicitamente falso
somente na configuração de teste já permitida pelo backend. Não se atribui a
esses testes garantia de HTTPS publicado, cookie Secure em produção, Google
real, Calendar, SMTP, Telegram ou LLM reais. A homologação DEV permanece uma
etapa separada, com autorização própria de efeitos externos.

## Validação

A suíte integrada completa registrou **28 aprovados, 0 falhos, 0 ignorados e 0 flaky**,
com zero retries, em **67,454 s** de Playwright. Projeto:
`phasscode-b2-e2e-d8bbd4ab-0f76-4f5d-b8d7-f3302ce47b5f`.
O typecheck, lint, contrato e build do backend passaram, assim como os 202
unitários dirigidos e as 113 integrações PostgreSQL/Redis. O reset de fixtures
entre fases foi aprovado. A validação local B2/F3 está concluída, aguardando
revisão. O aceite combina fases verdes de execuções preservadas; não representa
um único processo de regressão inteiramente verde. As falhas anteriores e os
escopos das retomadas permanecem registrados, sem repetir fases aprovadas.
Não há lint configurado no frontend; nenhum resultado de lint é atribuído a
TypeScript ou Commitlint.

| Suíte | Aprovados | Falhos | Ignorados | Duração Playwright |
| --- | --- | --- | --- | --- |
| Integrada React/Fastify | 28 | 0 | 0 | 67,454 s |
| Geral | 196 | 0 | 0 | 132,494 s |
| F1 | 29 | 0 | 0 | 93,997 s |
| F2 | 20 | 0 | 0 | 79,213 s |
| Fase 3 | 56 | 0 | 0 | 161,909 s |
| Orbe | 22 | 0 | 0 | 56,780 s |

Todas essas suítes têm zero flaky e zero retries. Geral, F1 e F2 vêm de
`phasscode-b2-e2e-ba4ad297-6ad6-44cf-af53-c719d0e55ec9`. A retomada
`phasscode-b2-e2e-38824b61-a586-443d-8f39-3077a83b54bb` executou apenas
Fase 3/Orbe, depois do ajuste de sincronização de logout. Seu typecheck passou
em 11,640 s; build de produção `main`, em 6,663 s; scanner, em 0,007 s.
Os relatórios ficam em `frontend-<suite>/report.json` e
`frontend-<suite>/html/index.html` de cada diretório de execução.

Os dois testes de política `main` estão incluídos nos 196 da suíte geral,
com `policyTestsPassed: true` em `frontend-main-build.json` dessa execução.
Na retomada selecionada eles ficaram corretamente marcados como não executados.
Ambos os builds geraram o mesmo JS, SHA-256
`77743eebb74f163d6a7a3f0ca2a35c537ff2ca7073f78794d85a6e44b6913199`.
O scanner não encontrou as sentinelas sintéticas, chaves ou URLs proibidas
procuradas. As flags hostis não ativaram os recursos restritos em `main`.

O [resumo de aceite e hashes dos relatórios](../../back-end-portfolio-gameboy/phasscode-platform/.docker-local/b2-e2e/phasscode-b2-e2e-38824b61-a586-443d-8f39-3077a83b54bb/acceptance-summary.json)
reúne essas fases e os checks backend. Os 21 OIDC fazem parte dos 202 unitários
dirigidos; sete guards do harness passaram separadamente após os ajustes do CLI.
Os 578 unitários anteriores à interrupção não foram executados novamente nem
somados às suítes sobrepostas nesta retomada.

A [inspeção do runtime](../../back-end-portfolio-gameboy/phasscode-platform/.docker-local/b2-e2e/phasscode-b2-e2e-38824b61-a586-443d-8f39-3077a83b54bb/runtime-isolation-verification.json)
comprovou os três serviços próprios, sem portas publicadas, binds ou volumes
persistentes, com tmpfs para PostgreSQL/Redis. A
[verificação final de limpeza](../../back-end-portfolio-gameboy/phasscode-platform/.docker-local/b2-e2e/phasscode-b2-e2e-38824b61-a586-443d-8f39-3077a83b54bb/resource-cleanup-verification.json)
confirmou zero containers, redes, volumes e tags de runner para os nove projetos.
Os relatórios locais foram preservados; DEV/PROD e Mac Mini permaneceram intactos.

### Correções dirigidas e retomada

A segunda execução anterior terminou com 25 aprovados, um timeout e dois
ignorados. O timeout era do teste tentando navegar sob o diálogo de login aberto
depois do logout incerto. Os três cenários finais agora fecham esse diálogo
pelos controles reais e continuam verificando o aviso global e ausência de replay.
O teste de callback reutilizado também reenvia o cookie original de prova do
navegador, além do cookie de sessão atual, sem persistir ou imprimir os valores.

O lookup de sessão usa `fetch` do navegador com `credentials: 'include'`: o
`BrowserContext.request` herdava o proxy e tentava CONNECT, corretamente recusado
pelo proxy. A disputa de mutação/refresh desliga apenas BroadcastChannel nesse
cenário para isolar Web Locks/CSRF no limite real de requisições; o canal e sua
reidratação têm cenários próprios. Nenhuma validação de servidor foi relaxada.

Após conferir os checkouts, os relatórios e a limpeza anterior, uma tentativa
dirigida falhou no registry MCR antes de criar containers. A repetição executou
os quatro casos de callback reutilizado, ACK perdido, timeout e Web Locks
ausentes: **4 aprovados, 0 falhos, 0 ignorados, 28,765 s**, sem retries.
Projeto: `phasscode-b2-e2e-4c0b9271-21d9-4f0f-9dc6-0de5648e7ba9`.
`isolation.json` confirmou rede interna e limpeza concluída.

Na execução seguinte, foram corrigidas a herança de flags da API pelos testes
legados e a outbox remanescente entre fases, usando ambiente de regressão separado
e reset exclusivo das fixtures. Os 28 E2E e as 113 integrações passaram novamente.
A falha restante na suíte geral era uma espera por frame histórico seguida de
navegação em outro RPC: a animação podia completar antes de o Router desmontar a
página. O teste agora pausa a Animation nativa em 1/4 da expansão e comprova essa
condição no mesmo RPC da navegação. Todas as asserções originais de cancelamento,
ausência de overlay, tema preservado e próximo toggle completo foram mantidas.
`src/components/ThemeToggle.tsx` permanece inalterado.

O teste dirigido de tema passou (1/1, 40,365 s), seguido da suíte geral completa
(196/196), F1 (29/29) e F2 (20/20). Essa execução parou em uma corrida
legada no teste de logout: a UI descarta a identidade antes de terminar o
preflight e receber o ACK. `phase3-api.spec.ts` agora aguarda a mensagem global
“Sessão encerrada.” antes de verificar um único POST, CSRF, corpo e ausência
de credenciais em storage/DOM. Nenhuma asserção foi removida. A sessão `user`
dessa fixture é somente uma defesa de UI contra um perfil inesperado; o backend
real continua admin-only. A retomada selecionada confirmou Fase 3 56/56 e Orbe
22/22, sem repetir geral/F1/F2 ou atribuir a ela novos E2E.

### Resultado individual dos 28 cenários

Fonte: `playwright-f3.json` da execução consolidada acima. A duração da suíte
inclui setup e teardown; a soma dos casos não precisa coincidir com ela.

| # | Cenário | Resultado | Duração |
| --- | --- | --- | --- |
| 1 | real OIDC login preserves a safe return, HttpOnly session and reload; callback replay cannot create a session | PASS | 2.434 s |
| 2 | real admin-only denial returns a safe frontend notice without persisting the denied identity | PASS | 1.443 s |
| 3 | real OIDC rejects wrong-nonce and the frontend renders only a public local error | PASS | 1.671 s |
| 4 | real OIDC rejects wrong-issuer and the frontend renders only a public local error | PASS | 1.721 s |
| 5 | real OIDC rejects wrong-audience and the frontend renders only a public local error | PASS | 1.458 s |
| 6 | real OIDC rejects wrong-signature and the frontend renders only a public local error | PASS | 1.389 s |
| 7 | real OIDC rejects provider-error and the frontend renders only a public local error | PASS | 1.862 s |
| 8 | real OIDC rejects cancel and the frontend renders only a public local error | PASS | 1.728 s |
| 9 | an invalid OIDC state is rejected without a trusted redirect or persisted session | PASS | 1.673 s |
| 10 | the real login transaction receives only the allowlisted relative return destination | PASS | 1.652 s |
| 11 | the public production client persists one request for repeated idempotent confirmation | PASS | 1.224 s |
| 12 | React confirms approve against real Fastify and verifies PostgreSQL audit/outbox | PASS | 3.019 s |
| 13 | React confirms reject against real Fastify and verifies PostgreSQL audit/outbox | PASS | 2.654 s |
| 14 | React confirms cancel against real Fastify and verifies PostgreSQL audit/outbox | PASS | 2.556 s |
| 15 | real B1 commands reject Bearer alone and missing/invalid cookie, Origin or CSRF without changing PostgreSQL | PASS | 2.126 s |
| 16 | real persisted revoke removes administrative access without retrying a command | PASS | 1.842 s |
| 17 | real persisted expire removes administrative access without retrying a command | PASS | 1.948 s |
| 18 | real persisted remove-admin removes administrative access without retrying a command | PASS | 1.867 s |
| 19 | two real session tabs rotate once without stale CSRF or session-family replay: channel | PASS | 2.295 s |
| 20 | two real session tabs rotate once without stale CSRF or session-family replay: no-channel | PASS | 2.395 s |
| 21 | two real session tabs rotate once without stale CSRF or session-family replay: lost-messages | PASS | 2.348 s |
| 22 | a real rotation notification makes the other tab rehydrate from the API without rebroadcasting a profile | PASS | 4.169 s |
| 23 | a missed real logout notification is recovered on focus by consulting the API | PASS | 3.597 s |
| 24 | real administrative mutation waits for a rotating session and commits with the current CSRF | PASS | 3.208 s |
| 25 | confirmed React logout revokes the real session and invalidates the other tab without another POST | PASS | 3.336 s |
| 26 | a real committed logout with dropped ACK preserves global uncertainty and recovers only through GET | PASS | 3.411 s |
| 27 | a real committed logout with an ACK held past the HTTP timeout is not replayed | PASS | 2.996 s |
| 28 | the real UI without Web Locks never sends logout or an administrative POST and recovers by GET | PASS | 2.883 s |

O patch completo da entrega está em
`../../revisoes/frontend/F3-INTEGRACAO-E2E-REVISAO.diff`; o patch backend B2 e
os resultados de infraestrutura pertencem ao respectivo repositório.

## Arquivos da entrega

- Modificados: `package.json` e `playwright.config.ts`.
- Regressão existente ajustada: `tests/theme-transition.spec.ts`, com barreira
  sobre uma Animation nativa, mantendo todas as verificações de cancelamento.
- Regressão existente ajustada: `tests/phase3-api.spec.ts`, aguardando o ACK
  confirmado antes de contar o único POST de logout e conferir seu CSRF.
- Novos: `playwright.f3.config.ts`, `vite.f3.config.ts`,
  `tests/f3-integrated.spec.ts`, `tests/helpers/integrated-session.ts` e
  `docs/f3-validacao-integrada.md`.

São nove arquivos. Nenhum arquivo de `src/`, configuração de deploy, lockfile,
documento F1/F2 ou arquivo real de ambiente foi alterado.

Os dois repositórios permanecem em `dev` e nos SHAs de referência, com stage
vazio. Os diffs abrangem todos os arquivos novos e modificados desde B1/F2.
Não houve commit, push, PR, merge ou deploy. A homologação funcional da Fase 3
em DEV e qualquer integração externa real exigem uma etapa posterior própria.
