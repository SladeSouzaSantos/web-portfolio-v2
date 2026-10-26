# Integração da Fase 3

Atualização local **F1 — 26/10/2026**: autenticação, reuniões e chat têm flags
independentes; o retorno Google trata os códigos públicos do contrato administrativo.
O incremento é restrito ao frontend e não declara publicação ou homologação externa.
Os resultados desta revisão ficam em [f1-validacao-local.md](f1-validacao-local.md).
F2 (coordenação entre abas/logout) e B2/F3 (E2E real conjunto) não integram F1.

## Contrato e divergências

Na integração inicial de 22–25/10/2026, a fonte foi o
[OpenAPI implantado](https://devapi.phasscode.com/api/v1/openapi.json), versão
`0.1.0`, comparado ao snapshot do backend usado naquela revisão. Os resultados
históricos abaixo não comprovam que a mesma revisão permanece publicada.

F1 considera o contrato de autenticação do backend incorporado pelo PR #13,
referência `ba7299d`, incluindo admissão administrativa, `returnTo` e erros
navegáveis. Código local, commit, publicação e homologação continuam evidências
distintas; usar o contrato/revisão efetivos antes de homologar em DEV.

Os guias [handoff](https://github.com/SladeSouzaSantos/phasscode-platform/blob/dev/docs/api/phase3-frontend-handoff.md)
e [integração](https://github.com/SladeSouzaSantos/phasscode-platform/blob/dev/docs/api/phase3-integration.md)
do backend descrevem o fluxo público. A existência de configuração ou relato
operacional não substitui a homologação de Google, Calendar ou canais reais.
O campo `servers` do OpenAPI ainda informa `localhost:3000`; a aplicação utiliza
somente a URL pública configurada no ambiente.

Historicamente, em 25/10/2026, preflights OPTIONS foram conferidos para a origem
`https://devgbc.phasscode.com`: refresh, confirmação de reunião e chat respondem
204, origem exata e `Access-Control-Allow-Credentials: true`. Os headers
`X-CSRF-Token`, `X-Meeting-Token`, `Idempotency-Key` e `X-Orbe-Capabilities` são
autorizados; `X-Correlation-Id` e `Retry-After` estão expostos. Isso não substitui
a homologação dos cookies nem a execução de uma reunião pelo proprietário.

## Organização

| Arquivos | Responsabilidade |
| --- | --- |
| `src/config/platform.ts`, `src/config/orbe.ts` | URL validada compartilhada; auth, reuniões e chat independentes; bloqueio do domínio produtivo contra a API DEV |
| `src/services/platformHttp.ts` | HTTP sem retries, timeout/cancelamento, erros públicos e `Retry-After` |
| `src/types/auth.ts`, `src/types/meetings.ts` | DTOs locais e validação de respostas externas |
| `src/services/authClient.ts` | Sessão/cookies, CSRF privado, refresh compartilhado e coordenação das mutações |
| `src/services/authNavigation.ts`, `src/components/AuthCallbackNotice.tsx` | Allowlist de retorno/erros, mensagem pública acessível e limpeza do marcador antes do roteador |
| `src/contexts/AuthContext.tsx` | Sessão compartilhada acima das rotas e expiração da interface |
| `src/components/ChestAccess.tsx` | Acesso administrativo pelo Google, entrada na sala e logout |
| `src/components/Modal.tsx` | Restauração de foco entre diálogos e após operações canceladas |
| `src/services/meetingsClient.ts`, `src/contexts/MeetingsContext.tsx` | API pública, draft em memória e ledger de idempotência |
| `src/components/meetings/` | Disponibilidade, formulário, revisão comum, consentimento, estado e formatação de fuso |
| `src/services/adminMeetingsClient.ts`, `src/components/AdminMeetings.tsx` | Cursor, filtros e decisões administrativas explícitas |
| `src/components/AdminDashboard.tsx`, `src/styles/admin_dashboard.css` | Sala administrativa, navegação interna e indicadores do Orbe sem dados fictícios |
| `src/types/orbe.ts`, `src/services/orbeClient.ts`, `src/hooks/useOrbeChat.ts`, `src/components/OrbAssistant.tsx` | Action de reunião validada, opt-in e acesso à revisão comum |
| `src/App.tsx`, `src/main.tsx`, `src/components/Navbar.tsx` | Providers, rota protegida e composição dos fluxos |
| `src/styles/meetings.css`, `src/styles/admin_meetings.css`, `src/styles/orbe_assistant.css` | Novos controles com tipografia, cores e modais do portfólio |
| `scripts/orbe-build-policy.mjs`, `vite.config.ts`, `.env.example` | Isolamento de builds DEV/PROD |
| `playwright.phase3.config.ts`, `tests/helpers/platform-mock.ts`, `tests/phase3-*.spec.ts` | Build isolado e testes determinísticos sem provedores reais |
| `tests/auth-client.spec.ts`, `tests/meetings-client.spec.ts`, testes existentes do Orbe | Contratos, concorrência, privacidade e regressão do chat |
| `.github/workflows/deploy.yml`, `package.json`, configurações Playwright e fixtures | Inclusão da suíte no CI e interceptações em todas as suítes |

## Autenticação

Com `authEnabled`, Google começa por navegação normal para
`/api/v1/auth/login/google`, com `returnTo` relativo para o destino do frontend.
O React não implementa OAuth, não recebe códigos de autorização e não lê cookies
HttpOnly. O backend valida o destino, a identidade e a sessão; o retorno não
autoriza a UI até a confirmação por `GET /api/v1/auth/session`.

O caminho de retorno usa uma allowlist de rotas, parâmetros/valores e fragmentos
públicos do portfólio. Query/fragmento livres, credenciais e tokens são descartados;
retornos inválidos não são enviados. A lista fica em `authNavigation.ts` e não
transforma o caminho em prova de identidade. O backend resolve o retorno somente
na origem autorizada, com suas
próprias verificações; o cliente não escolhe issuer, callback, e-mail autorizado
ou papel. Não há segunda implementação de OAuth no browser.

O marcador `auth_error` é consumido antes de redirecionamentos que poderiam
descartá-lo e removido por replace, preservando os demais parâmetros/fragmento
pertinentes. Somente os códigos abaixo recebem mensagens constantes conhecidas:

| Código público | Tratamento da UI |
| --- | --- |
| `AUTH_ADMIN_ONLY` | “Acesso negado. Apenas o administrador tem acesso.” |
| `AUTH_REQUIRED` | Orientação local de autenticação necessária. |
| `AUTH_LOGIN_FAILED` | Falha de login com nova tentativa manual. |
| `AUTH_PROVIDER_UNAVAILABLE` | Provedor temporariamente indisponível. |
| `AUTH_UNAVAILABLE` | Autenticação temporariamente indisponível. |
| Código desconhecido ou marcador inválido | Mensagem genérica local; não refletir o valor recebido. |

Nenhum valor da query é interpretado como HTML, perfil ou prova de autenticação.
O aviso oferece continuidade manual; não inicia outro login nem repete uma
mutação automaticamente. O sucesso padrão sem `returnTo` continua compatível
com o destino configurado no backend.

- `GET /api/v1/auth/session`: cookies, inicialização compartilhada inclusive em StrictMode.
- `GET /api/v1/me`: cookies, disponível no cliente tipado.
- `POST /api/v1/auth/refresh`: cookies e CSRF atual, sem corpo; uma Promise compartilhada.
- `POST /api/v1/auth/logout`: cookies e CSRF atual, sem corpo; limpa a sessão local.

CSRF fica na closure privada do cliente, fora do contexto React. Dentro da própria
aba, renovação e comandos autenticados coordenam a rotação. A coordenação entre
abas continua F2; F1 não resolve o CSRF obsoleto após rotação em outra aba.
Não há renovação infinita nem repetição automática de uma mutação após 401.
O cliente mantém a renovação antes de uma operação autenticada próxima da
expiração; o baú não oferece botões de atualização ou renovação. O relógio local
apenas atualiza o estado expirado.

401 remove a identidade local; 403 mostra uma orientação pública; `404 AUTH_DISABLED`
desabilita Google; o agendamento pelo Orbe permanece independente. Se refresh falhar de modo
incerto, o cliente abandona o CSRF anterior e exige consulta explícita da sessão
ou novo login. Rede/timeout não provam que o backend deixou de processar uma operação.

Estados da interface: carregando, anônimo, autenticado, indisponível e erro.
O baú aberto representa autenticação; o papel `admin` controla a apresentação do
painel e a rota `/administracao`. O backend continua autorizando cada requisição.
Usuários comuns não são promovidos pelo frontend.

Na primeira sessão administrativa reconhecida na raiz simples `/`, sem query,
fragmento ou aviso de callback, o React abre `/administracao`. Isso não substitui
destinos como `/#sobre` ou `/projetos` preservados no retorno. O redirecionamento
ocorre uma vez por identidade autenticada durante a montagem:
**VOLTAR AO PORTFÓLIO** continua funcionando e o baú permite reabrir a sala.
O menu administrativo oferece somente **IR PARA A SALA DO
ADMINISTRADOR** e **TRANCAR BAÚ (LOGOUT)**, além do controle de fechar o diálogo.

Uma sessão legada ou simulada com papel `user` recebe uma mensagem de acesso não
autorizado e a opção de logout, sem consultar os endpoints administrativos.
O contrato backend adotado por F1 é **admin-only**: recusa outras identidades
antes de criar sessão e revalida admissão/papel no servidor. O frontend não
contém allowlist de e-mail nem promove o usuário. O
[handoff administrativo](admin-access-handoff.md) preserva a observação histórica
anterior à implementação dessa política, identificada por sua atualização datada.

## Reuniões públicas e consentimento

Com `meetingsEnabled`, o agendamento não aparece no baú. O Orbe oferece a revisão de propostas
de reunião sem login; **Alterar dados / novo horário** permite consultar a agenda
e preparar outra proposta pelo formulário existente. O cliente público utiliza
`credentials: 'omit'`. Desligar a UI de auth não exige login do visitante para
as APIs públicas de reuniões; o backend ainda precisa de auth administrativa e
Calendar configurados para operar esse módulo. O acesso direto independente da
LLM continua pendência fora de F1. O fluxo existente é:

1. `GET /api/v1/meetings/availability?from=ISO&to=ISO`: intervalo de até sete dias.
2. `POST /api/v1/meetings/proposals`: nome, e-mail, assunto e um slot retornado pela API.
3. Revisão exata do resumo do servidor, incluindo validade, fuso e simulação.
4. Consentimento obrigatório e clique em **Confirmar solicitação**.
5. `POST /api/v1/meetings/requests`: proposta/token/consentimento, com `Idempotency-Key`.
6. `GET /api/v1/meetings/requests/{id}/status`: `X-Meeting-Token`, por atualização manual.

Nenhuma renderização, abertura de modal ou chegada de resposta do Orbe confirma
um pedido. O provider mantém uma chave UUID e um corpo imutável por proposta.
Uma tentativa manual após falha ambígua reutiliza ambos; reabrir uma proposta já
confirmada reutiliza o resultado em memória, sem novo POST.

Disponibilidade vazia é um estado válido; horários não são fabricados nem
calculados localmente como regras de negócio. A apresentação usa o fuso da API.
Conflitos exigem uma nova escolha; indisponibilidade da agenda não produz slots
alternativos. Simulações são identificadas.

| Estado | Significado apresentado |
| --- | --- |
| `PENDING` | Enviado para análise; não reserva horário |
| `APPROVED` | Aprovado; aguarda confirmação na agenda |
| `CONFIRMED` | Evento verificado na agenda; não garante aceite nem videoconferência |
| `REJECTED` | Pedido não aprovado |
| `CANCELLED` | Decisão registrada; limpeza externa pode estar em verificação |
| `FAILED` | Operação não concluída; reserva pode permanecer protegida durante reconciliação |

O acompanhamento é privado e temporário nesta instância da página. Recarregar
perde o token local; não há recuperação por e-mail implementada ou prometida.

## Administração e Orbe

Com auth habilitada e reuniões desligadas, a sala administrativa mantém seu shell,
mostra a indisponibilidade de agenda e não monta consultas de reuniões.
Quando ambos estão habilitados, o painel consulta `/api/v1/admin/meetings` com filtro e cursor opaco. Não utiliza
paginação numérica. Aprovar, rejeitar e cancelar exigem confirmação visual e
`POST /api/v1/admin/meetings/{id}/{approve|reject|cancel}`, cookies e CSRF, sem
corpo. Há bloqueio de duplicação, tratamento de 401/403/409 e atualização da lista.
Atualizações assíncronas são consultadas manualmente, sem polling.

A sala também oferece busca por nome/e-mail/assunto, ordenação e resumo por
situação dos pedidos carregados. Esses controles são locais; os números não são
totais globais, e outra página é sinalizada. O contrato publicado não fornece
relatórios de conversas/perguntas/intenção nem edição/reagendamento. Os quatro
indicadores do Orbe mostram **Aguardando dados** e **ALTERAR REUNIÃO** permanece
indisponível, com explicação. O [handoff dos relatórios e da agenda](admin-dashboard-handoff.md)
registra os contratos necessários e a definição de conversa única do proprietário.

O chat permanece `POST /api/v1/chat`, com seu token próprio e `credentials: 'omit'`.
Somente com chat HTTP e reuniões habilitados ele envia
`X-Orbe-Capabilities: meetings-v1`; a flag de auth não anuncia essa capacidade.
`actions` admite no máximo uma proposta validada. O botão **REVISAR PROPOSTA DE
REUNIÃO** fecha o chat e abre o mesmo fluxo público; nenhum token volta ao texto
da LLM. O histórico do chat e o Canvas permanecem preservados.
O botão **NOVA CONVERSA** foi retirado: fechar/reabrir preserva a sessão em memória;
recarregar a página descarta o histórico local e a próxima pergunta inicia outra.

## Ambientes e migração das flags

`PlatformConfig` tem a forma `{ authEnabled, meetingsEnabled, apiBaseUrl }`.
`VITE_AUTH_ENABLED` controla sessão/login e a UI administrativa;
`VITE_MEETINGS_ENABLED` controla clientes/UI de reuniões e a capability do chat.
`VITE_ORBE_API_ENABLED` continua independente, usando a URL validada compartilhada
`VITE_API_BASE_URL`. Somente a string exata `true` ativa cada flag; ausência,
`false`, `TRUE` ou URL inválida não habilitam o respectivo módulo.

**Migração obrigatória:** `VITE_PHASE3_ENABLED` é ignorada e não serve como fallback.
Antes de atualizar configurações locais/pipeline, escolher explicitamente quais
módulos serão ativados, retirar a flag antiga e definir as duas novas. Ter apenas
`VITE_PHASE3_ENABLED=true` não ativa auth nem reuniões. Não copiar a flag antiga
automaticamente para ambas: o primeiro perfil DEV preparado por F1 é somente login.

| Destino preparado | Orbe HTTP | Auth | Reuniões | API |
| --- | --- | --- | --- | --- |
| CI para `dev`, inclusive PR destinado à `dev` | sim | sim | não | `https://devapi.phasscode.com` |
| Build de `main`, inclusive PR destinado à `main` | não | não | não | vazia |
| Local sem opt-in | não | não | não | vazia, salvo configuração explícita |
| Testes isolados | conforme cenário | conforme cenário | conforme cenário | `.invalid` conhecida e interceptada |

Essa tabela descreve configuração de build, não publicação realizada ou estado das
flags privadas do servidor. O modo Vite `production` não significa ambiente PROD.

Quatro exemplos locais, todos com API válida. Como base, usar
`VITE_API_BASE_URL=http://localhost:3000` somente se backend, hostname/cookies e
origem CORS locais estiverem configurados de modo compatível. Orbe pode ser `true`
ou `false` em **cada** combinação; para testar sem LLM, mantê-lo `false` ou usar
a suíte interceptada, sem apontar automação para um provedor real.

1. Nenhuma UI de sessão/agenda; chat continua independente:

   ```dotenv
   VITE_AUTH_ENABLED=false
   VITE_MEETINGS_ENABLED=false
   ```

2. Login/sessão/logout e shell admin, sem consultas/capability de reuniões:

   ```dotenv
   VITE_AUTH_ENABLED=true
   VITE_MEETINGS_ENABLED=false
   ```

3. Login/admin e clientes de reuniões habilitados:

   ```dotenv
   VITE_AUTH_ENABLED=true
   VITE_MEETINGS_ENABLED=true
   ```

4. Clientes públicos de reuniões habilitados, sem UI/fetch de sessão/admin:

   ```dotenv
   VITE_AUTH_ENABLED=false
   VITE_MEETINGS_ENABLED=true
   ```

O quarto exemplo não desabilita a autenticação administrativa no backend. Reuniões
no servidor continuam exigindo suas dependências privadas; a independência da UI
não remove autorização, Calendar ou requisitos operacionais. O formulário direto
sem depender de uma action do Orbe ainda não foi acrescentado em F1.

`.env.example` é apenas o modelo. Para configuração local use `.env.local` na raiz
e reinicie Vite após alterações. Esses exemplos não modificam arquivos privados;
não coloque e-mail administrativo, chaves, cookies, CSRF ou tokens em `VITE_*`.

A política do CI usa a branch de destino do PR. Define explícitos também
protegem builds locais da `main` contra `.env.local` ou variáveis herdadas com
DEV: Orbe/auth/reuniões são forçados a `false` e a URL fica vazia. Os testes
isolados podem habilitar exclusivamente `https://orbe-api.invalid` ou
`https://phase3-api.invalid` com `PHASSCODE_MOCK_API_BUILD=true`; essa exceção
nunca autoriza `devapi` ou a API produtiva.
Os builds de teste ficam fora de `dist`, que continua sendo o artefato publicado.

Em produção, o baú informa indisponibilidade sem solicitar senha; o Orbe continua
demonstrativo. Nenhum recurso novo é conectado à API DEV. A integração produtiva
exige autorização e homologação posteriores.

Cookies SameSite entre `localhost` e a API pública podem impedir uma sessão real.
Não relaxe a política do backend para contornar isso. Use mocks localmente e
homologue Google/sessão em `https://devgbc.phasscode.com`.

## Segurança, testes e limitações

Sessão, CSRF, token de confirmação e token de acompanhamento não entram em
storage, cookies JavaScript, URLs, logs ou analytics. Dados externos são texto
React, sem `dangerouslySetInnerHTML`. Os diagnósticos existentes do Orbe continuam
apenas em DEV e reconstruídos por lista permitida, sem dados das propostas.

Todas as suítes instalam uma guarda de API antes da navegação, inclusive smoke e
visual. Chamadas imprevistas falham localmente; OAuth externo é bloqueado.
Intercepções autenticadas utilizam origem exata e autorização de credenciais.

```sh
npm ci
npm run typecheck
npm run build
npm test
npm run test:orbe
npm run test:phase3
npm run test:f1
npm run test:visual
```

`test:f1` utiliza oito perfis de flags em servidores Vite locais nas portas
4180–4187 e a API `https://phase3-api.invalid` interceptada. É uma suíte de UI
com mocks, não o E2E real de B2/F3. A etapa correspondente foi acrescentada ao
workflow de CI como código; não foi acionada por editar o arquivo.
Não existe script/configuração de lint de código neste frontend. TypeScript e
Commitlint têm escopos próprios e não devem ser relatados como lint aprovado.

## Histórico da validação anterior a F1

Os resultados desta seção pertencem às revisões de **25/10/2026**, anteriores à
separação das flags e ao tratamento de callback F1. São preservados como histórico;
não devem ser apresentados como regressão executada novamente em F1. A validação
local desta atualização é registrada separadamente em
[f1-validacao-local.md](f1-validacao-local.md).

Validação inicial concluída em 25/10/2026, no Windows com Edge/Playwright:

| Verificação | Resultado |
| --- | --- |
| `npm ci` | Aprovado, sem vulnerabilidades relatadas |
| `npm run typecheck` | Aprovado |
| `npm run build`, política DEV | Aprovado, URL `https://devapi.phasscode.com` conferida no bundle |
| `npm run build`, política MAIN com variáveis DEV herdadas | Aprovado, sem URL DEV, URLs de mocks ou diagnóstico no bundle |
| `npm test` contra o build DEV final | 111 aprovados |
| `npm run test:orbe` | 22 aprovados |
| `npm run test:phase3` | 47 aprovados: 21 públicos/sessão, 21 administrativos e 5 de actions do Orbe |
| `npm run test:visual` contra o build MAIN | 2 aprovados, sem atualizar snapshots |
| Commitlint das mensagens e `git diff --check` | Aprovados |

São 182 cenários nas quatro suítes. Todas as chamadas de API foram simuladas;
nenhuma cota LLM, reunião, autenticação Google ou notificação real foi consumida.
O `dist` local ao concluir os testes corresponde à política DEV; os builds de
teste permanecem nos diretórios separados e o CI seleciona a política pelo destino.

Foram corrigidas duas fontes de instabilidade nos testes existentes: os cliques
de tema agora ocorrem atomicamente nas fases observadas da animação, e o servidor
Vite de diagnóstico prepara apenas as dependências/grafo da aplicação, com cache
isolado dos artefatos gerados. As animações, os prazos e as asserções de segurança
permanecem preservados. O diagnóstico completo de HTTP/HMR passou também isoladamente.

SAST e DAST não foram executados localmente; continuam sob responsabilidade do
pipeline existente. A homologação com provedores reais permanece pendente de
execução controlada pelo proprietário.

Os testes abrangem clientes, sessão/CSRF/refresh concorrente, autorização,
disponibilidade, revisão, consentimento, idempotência, estados, decisões, actions,
privacidade, HTML malicioso e regressões em 320/375/768/1440 px, ambos os temas,
teclado e acessibilidade. Não atualize snapshots sem revisar diferenças.

Renovações são coordenadas dentro da aba; não há coordenação de refresh entre
abas diferentes. Não há recuperação de tokens públicos após reload. A confirmação
efetiva no Calendar, destinatários e notificações dependem do backend e devem ser
homologados pelo proprietário com o [roteiro controlado](phase3-homologacao.md).
SAST/DAST continuam no pipeline existente; nenhuma regra foi relaxada.

Na revisão posterior do baú exclusivo da administração, `npm run typecheck`, o
build DEV e `git diff --check` passaram. A regressão geral passou em 111 testes e
a suíte Fase 3 em 49 (23 administrativos, 21 públicos/sessão e 5 do Orbe). Os novos
cenários conferem a entrada administrativa automática a partir de `/` e
`/#sobre`, a volta ao portfólio sem ciclo e o menu sem agendamento ou controles
manuais de sessão. As requisições continuam inteiramente simuladas; a política
de login por e-mail no backend foi registrada como pendente naquele snapshot.
Essa observação histórica foi superada no código backend pelo PR #13, sem que
este resultado de testes com mocks comprove sua publicação ou homologação real.
Os quatro casos responsivos administrativos foram ampliados e reexecutados com
sucesso: baú em 320/375/768/1440 px nos dois temas, texto do botão sem overflow,
foco, Tab/Escape e axe em 320 px nos dois temas.

Na ampliação posterior da sala e retirada do botão de nova conversa, o build DEV,
TypeScript e `git diff --check` passaram. O bundle final contém a URL DEV, sem URL
de mock nem o botão retirado. Validação atual: 111 testes gerais, 22 testes do Orbe
e uma rodada completa de 54 testes da Fase 3 aprovados. Duas auditorias do painel
foram separadas dos casos responsivos para evitar concentrar cinco scans axe no
mesmo teste; os seis casos afetados passaram novamente, cobrindo 56 cenários
únicos na Fase 3, com o timeout e as verificações preservados.
As capturas de 1440 e 375 px, nos dois temas, também foram conferidas com sessão
administrativa e reuniões fictícias. Nenhum provedor real foi consumido. Relatórios
e edição de reuniões permanecem pendentes de contrato publicado e integração.
