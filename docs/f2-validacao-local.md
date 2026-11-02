# F2 — Validação local de sessões, CSRF e logout entre abas

Registro iniciado em **26/10/2026**, America/Sao_Paulo. Base esperada e conferida
do frontend: `dev/c8e9f6aa190517fd09bccbe6447950aad44e8274`, entrega F1. O
backend B1 de referência é `3d547bd1cff773989421ac4160a54c9fffbb9480` e não faz
parte das alterações desta entrega.

**Estado: implementada e validada localmente, aguardando revisão; sem commit.**
Os cenários abaixo descrevem o escopo e a cobertura confirmada. O registro de
[F1](f1-validacao-local.md) permanece histórico, sem reescrita de seus resultados.

## Escopo e comportamento

F2 coordena os clientes de autenticação de abas cooperantes na mesma origem do
frontend. A API permanece responsável por identidade, admissão administrativa,
validade da sessão, cookie HttpOnly e CSRF. Uma mensagem entre abas nunca
autentica uma página nem substitui `GET /api/v1/auth/session`.

- Exclusão mútua real com Web Locks para refresh, logout e POSTs autenticados,
  incluindo a consulta de sessão dentro do lock antes do uso do CSRF. Esperar
  outra aba não autoriza reutilizar o token que estava em memória antes da espera.
- Reavaliação após esperar o lock: uma rotação já concluída por outra aba deve
  permitir adotar a sessão atual, sem disparar outro refresh desnecessário.
- BroadcastChannel opcional para eventos e metadados não secretos, com validação
  de formato e deduplicação. Não trafegam cookies, CSRF, JWT, perfil, e-mail,
  respostas privadas ou tokens Google, de reuniões ou do Orbe.
- Revalidação pela API no carregamento e, quando necessário, ao receber eventos,
  recuperar foco/visibilidade ou iniciar operações protegidas. Eventos perdidos
  não permitem usar indefinidamente uma sessão antiga; evitar polling e ciclos
  de evento → consulta → novo evento.
- Sem Web Locks utilizável, refresh e POSTs protegidos não são enviados. A
  recuperação por consulta de sessão permanece possível; BroadcastChannel ou
  armazenamento compartilhado não são usados como substitutos de exclusão mútua.
- `401`, expiração e revogação invalidam identidade e leituras antigas.
  `AUTH_CSRF` pede recuperação de estado; `AUTH_ADMIN_ONLY` representa política
  administrativa. Nenhuma dessas respostas autoriza repetir um POST
  automaticamente.

O coordenador usa o namespace `phasscode-auth:v1:<URL-base canônica da API>`,
espera até **10 segundos para adquirir** o Web Lock e mantém a exclusão até a
operação iniciada terminar, inclusive durante cancelamento. O timeout HTTP
continua em **30 segundos**. O limite de aquisição não libera uma operação em
andamento para outra aba. O protocolo aceita somente
`{version: 1, id, source, type}` com UUIDs e os tipos `session-changed`,
`logout-confirmed` e `session-invalidated`; deduplicação e filas são limitadas.

Antes de cada POST protegido, a consulta de sessão ocorre dentro do mesmo lock
do POST. O header CSRF recebido do chamador é substituído de forma insensível a
maiúsculas/minúsculas. Leituras privadas verificam a geração antes do fetch e
antes de entregar a resposta, descartando leituras canceladas pelo StrictMode,
logout ou invalidação. A coordenação é criada após montagem/primeiro uso,
evitando canais abertos por renders descartados.

O contrato B1 permanece: comandos administrativos exigem cookie de sessão ativo,
`Origin` permitido e `X-CSRF-Token` atual, mesmo se houver Bearer. O navegador
controla `Origin`; esse cabeçalho não é uma credencial. A UI mantém
`credentials: include`, sem tentar fabricar ou relaxar esse contrato.

| Recursos disponíveis | Comportamento |
| --- | --- |
| Web Locks e canal | Operações protegidas serializadas; eventos antecipam a invalidação, sempre com confirmação pela API. |
| Web Locks sem canal | A exclusão permanece; carregamento, foco/visibilidade e consulta dentro do lock recuperam mensagens ausentes. |
| Sem Web Locks, com ou sem canal | Nenhum refresh ou POST protegido; GET de sessão e orientação manual permanecem. O canal sozinho não permite confirmar logout. |

## Logout não confirmado

No ajuste após revisão técnica, o cliente passa a registrar a fronteira de
envio **imediatamente antes da chamada a `fetch`**, depois das validações,
serialização e verificação de cancelamento do HTTP. O callback interno
`onDispatch` é síncrono, não contém credenciais e não comprova recebimento pelo
servidor.

| Resultado conhecido | Aviso e recuperação |
| --- | --- |
| Bloqueio antes de chamar `fetch` para o logout | `logout-not-sent`: “O logout não foi executado. Nenhum pedido de encerramento foi enviado.” Informa limitação de navegador, espera por outra aba, pausa `Retry-After` ou falha na consulta prévia, conforme o caso. |
| POST tentado, sem confirmação válida | `logout-uncertain`, inclusive rede, timeout, abort, HTTP 403/503 ou resposta perdida; nunca pressupõe cancelamento no servidor. |
| Resposta válida de logout reconhecida | `logout-confirmed`, mesmo diante de uma falha posterior de coordenação; não repete o POST. |
| Consulta prévia já reconhece sessão ausente | `logout-inactive`; não afirma ter revogado a família de sessões. |

Os avisos de falha ficam acima das rotas, com `role=alert`, e não podem ser
apagados apenas fechando o modal. Uma falha anterior ainda incerta não vira
“não enviado” em uma nova tentativa bloqueada. Bloqueio de coordenação, por si
só, não publica uma revogação ou invalidação fictícia nas demais abas.

O aviso deve permanecer em estado global de memória, acima das rotas e do modal
do baú. Sair da administração, fechar o diálogo ou reabri-lo não pode apagar a
informação de que o encerramento não foi confirmado. Conteúdo administrativo
pode ser ocultado preventivamente, sem anunciar que a sessão foi revogada.

Uma recuperação deliberada consulta `GET /api/v1/auth/session`. Se a API ainda
reconhece a sessão, isso deve ficar claro; outro POST de logout depende de nova
intenção do usuário e de CSRF atual. Se a consulta confirma ausência de sessão,
a UI pode refletir essa confirmação. Nenhuma mutação ambígua é repetida em
segundo plano.

O aviso é mantido durante a instância da aplicação. Persistência após F5 não foi
solicitada; reload consulta a API novamente e não recupera o aviso anterior por
storage. Não adicionar sessão, tokens ou credenciais ao localStorage,
sessionStorage, URL, logs ou canal entre abas.

## Refresh explícito antes da sessão inicial

O contrato de `refresh()` continua sendo **solicitar renovação**, com uma única
Promise por aba para chamadas simultâneas. Sem CSRF inicial e sem consulta em
andamento, ele adquire o lock, carrega uma sessão ativa e envia **um POST** de
refresh com o CSRF retornado. Sessão anônima, expirada ou falta de coordenação
não permitem o POST. A ausência de token nunca é tratada como prova de uma
rotação já concluída.

Quando há token conhecido, compara-o com o GET dentro do lock. Se mudou,
adota o estado atual e não repete a rotação. Uma consulta inicial já em
andamento é aguardada antes de adquirir o lock de renovação, preservando o
token observado por ela como referência para essa comparação. Não há espera
circular por `refresh()` nem dependência exclusiva de BroadcastChannel.

Um contador local de `session-changed` e uma marca da última adoção preservam
a indicação de rotação quando a notificação já limpou o CSRF e o GET de
revalidação ainda está pendente. Também detectam notificação recebida enquanto
o refresh espera o lock. Esses metadados permitem adotar sem outro POST
**somente depois** de consultar uma sessão ativa pela API sob lock. O payload
do canal não mudou e nenhuma credencial nova é compartilhada. Dois testes
dirigidos cobrem essas janelas; sem essa marca, esperar a carga inicial poderia
transformar T2 na referência e provocar outra rotação desnecessária.

Sem referência anterior e sem evidência recebida, o cliente não consegue provar
que o estado encontrado foi produzido por outro refresh recente. Nesse caso,
honra a renovação explícita com CSRF recém-consultado sob o mesmo lock; não
promete eliminar toda rotação sequencial entre clientes ainda não inicializados.
A segurança não depende dessa otimização: nunca reutiliza o CSRF capturado
antes de esperar por outra aba para enviar um POST.

## Harness e cobertura

Os testes usam duas páginas na **mesma BrowserContext** do Playwright,
compartilhando um cookie HttpOnly sintético. Contextos separados não representam
duas abas da mesma sessão. O harness controla rotação e respostas da API
simulada, observando quantidade/ordem de POSTs e rejeitando CSRF antigo. Web Locks
e BroadcastChannel são os reais do navegador nos cenários positivos;
ausência, perda de mensagem e timeout têm cenários próprios.

| Cenário | Evidência verificada nos testes |
| --- | --- |
| Duas abas autenticadas | Ambas consultam a API; nenhuma obtém identidade de uma mensagem ou de storage. |
| Refresh simultâneo | A coordenação evita POSTs concorrentes com a credencial antiga; a segunda aba reavalia a sessão após esperar. |
| Rotação de cookie/CSRF | Ambas passam a usar a geração reconhecida pela API; segredo não atravessa o canal. |
| Notificação entre abas | A outra aba invalida o estado antigo e reconsulta a API, sem restaurar leitura atrasada. |
| Logout confirmado | A outra aba remove a capacidade administrativa sem enviar logout automaticamente. |
| Logout bloqueado antes do envio | Web Locks ausente, negado ou ocupado e falha no GET prévio geram `logout-not-sent`; zero POST. O aviso React persiste ao navegar e reabrir o baú, e a recuperação faz somente GET. |
| Refresh sem sessão inicial | GET e uma rotação explícita, Promise compartilhada; token conhecido alterado ou obtido por carga inicial pendente evita rotação duplicada. |
| Logout com rede/timeout/403/503 ou resposta perdida | Aviso acessível sobrevive às rotas e reabertura do baú; não anuncia conclusão nem repete POST. |
| Sessão expirada, revogada ou política recusada | Identidade antiga não retorna por resposta atrasada; recuperação consulta a API. |
| Mutação durante refresh | POST administrativo espera a seção protegida e usa CSRF reconsultado; não há retry de mutação ambígua. |
| Mensagem perdida ou canal ausente | Foco/visibilidade e a preparação de operações recuperam o estado pela API; não dependem exclusivamente do canal. |
| Fechamento de aba, timeout de espera ou Web Locks ausente | Não há lock fictício ou POST desprotegido; falha é explícita e recuperável sem repetição automática. |
| F1, navegação e main | Flags independentes, callback seguro, `returnTo` e isolamento de build permanecem preservados. |

O harness F2 usa `http://127.0.0.1:4178` para o React/Vite e a API simulada,
interceptando `/api/**` e bloqueando saídas para outras origens. Isso permite
testar Cookie HttpOnly/Lax real do navegador em HTTP local, sem depender de
cookies de terceiros entre localhost e `.invalid`. Os demais perfis mantêm
suas APIs `.invalid` interceptadas. Nenhum Google, Calendar, SMTP, Telegram ou LLM real integra este harness. Isso
não é o E2E React + API + OIDC local + PostgreSQL/Redis de B2/F3.

O perfil F2 executa um cenário por vez; dentro do cenário, as duas abas e suas
operações permanecem concorrentes. Durante uma execução simultânea com outra
suíte houve dois timeouts de interface/inicialização; ambos passaram isoladamente
e a bateria completa passou com cenários seriais, sem retries, sleeps arbitrários
ou aumento dos limites de espera da aplicação. Os testes puros modelam a exclusão
com injeção explícita; esse modelo não é um fallback usado pela aplicação.

## Validação inicial e ajuste após revisão

A implementação inicial registrou 311 testes aprovados: geral 185, F1 29,
F2 19, Fase 3 56 e Orbe 22. O ajuste técnico acrescentou onze casos puros
e um cenário React, além de ampliar asserções existentes. A primeira execução
dirigida detectou uma mudança involuntária de `Retry-After` para `busy` ao
transformar o bloqueio imediato do logout em Promise pendente. O bloqueio
imediato foi preservado, agora com aviso global correto; os 55 testes dirigidos
passaram sem enfraquecer as asserções de cooldown. A cobertura dirigida foi
ampliada para 57 testes ao incluir as duas janelas de notificação de refresh,
todos aprovados. Os resultados finais dos ajustes estão na tabela abaixo,
conferidos nos relatórios persistidos. A primeira execução React
também revelou um seletor de baú incorreto no novo teste: o Arquivo não contém
esse controle. O cenário agora retorna pelo link existente ao portfólio antes
de reabrir o baú, preservando o provider e o aviso durante toda a navegação.

| Comando | Executado na tarefa dos ajustes? | Resultado final |
| --- | --- | --- |
| `npm run typecheck` | Sim, após o último ajuste de código | Aprovado; também executado pelo build. |
| `npm test` | Sim | 196/196 aprovados, incluindo cliente, coordenador, navegação, acessibilidade e política main. |
| `npm run test:f1` | Sim | 29/29 aprovados, incluindo os oito perfis e callback/returnTo. |
| `npm run test:f2` | Sim | 20/20 aprovados, incluindo logout não enviado e aviso global persistente. |
| `npm run test:phase3` | Sim | 56/56 aprovados; build mock isolado aprovado. |
| `npm run test:orbe` | Sim | 22/22 aprovados; build mock isolado aprovado. |
| `npm run build` | Sim, após o último ajuste de código | Aprovado com política main e flags herdadas ativas. |
| `git diff --check` | Sim; repetido na conferência dos artefatos | Aprovado; stage vazio. |

**323 testes aprovados nas cinco suítes finais**, sem somar novamente os 57
testes dirigidos (36 do cliente e 21 do coordenador, incluídos na suíte geral).
Esses resultados substituem os totais anteriores de 311 e 321 para a árvore
atual. Ambiente: Windows, Node `v24.11.1`, npm `11.6.2`,
Playwright com Microsoft Edge. As execuções locais finais não usaram retries.
Firefox, WebKit e o runner Linux da CI não foram executados nesta revisão.
Lint não executado: não há script/configuração de lint de código no frontend;
TypeScript e Commitlint não equivalem a um linter de código.

Evidências finais dos relatórios HTML locais em `playwright-report/`, todos
com zero falhas, zero testes flaky e zero testes pulados:

| Relatório | Início UTC em 26/10/2026 | Duração registrada |
| --- | --- | --- |
| `functional/index.html` | 13:13:06.581 | 93,663 s |
| `f2/index.html` | 13:14:41.927 | 56,239 s |
| `f1/index.html` | 13:15:39.503 | 98,531 s |
| `phase3/index.html` | 13:17:19.283 | 88,122 s |
| `orbe/index.html` | 13:18:48.837 | 42,362 s |

A conferência final solicitada pelo usuário apenas recuperou o término da
execução já iniciada na tarefa dos ajustes e leu esses relatórios; **não iniciou
outra bateria**, nem alterou código da aplicação. O documento e o diff estavam
desatualizados e foram atualizados com o índice. O patch completo desde F1 foi
conferido por `git apply --reverse --check`, sem aplicar alterações na árvore.

O build main usou exclusivamente variáveis do processo:
`GITHUB_REF_NAME=main`, `GITHUB_BASE_REF=main`,
`PHASSCODE_MOCK_API_BUILD=false`, `VITE_AUTH_ENABLED=true`,
`VITE_MEETINGS_ENABLED=true`, `VITE_ORBE_API_ENABLED=true` e
`VITE_API_BASE_URL=https://phase3-api.invalid`. Isso exercita o bloqueio das
flags herdadas sem trocar a branch `dev` nem modificar `.env`.

Nenhum commit, push, PR, deploy, mudança de branch, migration, alteração de
`.env` real ou operação de infraestrutura foi realizado. HEAD frontend continua
`c8e9f6aa190517fd09bccbe6447950aad44e8274`; backend em `dev`, limpo, continua
`3d547bd1cff773989421ac4160a54c9fffbb9480`. Patches históricos B1/F1 preservados
com os mesmos SHA-256. O diretório de backups privados não foi acessado.

## Arquivos desta entrega

23 arquivos no frontend: 14 modificados e nove novos. Caminhos relativos ao
repositório; `docs/f1-validacao-local.md` permanece intacto.

Os ajustes após a revisão atingiram somente `src/services/authSessionClient.ts`,
`src/services/platformHttp.ts`, `src/types/auth.ts`,
`src/components/AuthSessionNotice.tsx`, `tests/auth-client.spec.ts`,
`tests/f2-session.spec.ts` e este documento. Os demais arquivos do inventário
já pertenciam à implementação F2 anterior. Os nove arquivos novos continuam
**não rastreados**, incluídos integralmente no diff de revisão, sem stage.

Testes correspondentes em [auth-client.spec.ts](../tests/auth-client.spec.ts):
refresh explícito sem inicialização; adoção de CSRF conhecido alterado; carga
inicial pendente; sessão anônima; rotação notificada durante revalidação ou
espera do lock; logout bloqueado por Web Locks ausente/negado/ocupado; falha no
GET prévio; ACK confirmado seguido por erro de coordenação; refresh que falha
antes do logout; timeout/cancelamento antes e depois da fronteira HTTP.
Em [f2-session.spec.ts](../tests/f2-session.spec.ts), a UI cobre logout
confirmado entre abas, falha de rede antes/depois do efeito, timeout/403/503 e
logout sem Web Locks com zero POST e aviso persistente durante a navegação.

```text
M .github/workflows/deploy.yml
M README.md
M docs/phase3-integracao.md
A docs/f2-validacao-local.md
M package.json
M playwright.config.ts
A playwright.f2.config.ts
M src/App.tsx
A src/components/AuthSessionNotice.tsx
M src/components/ChestAccess.tsx
M src/contexts/AuthContext.tsx
M src/services/authClient.ts
A src/services/authCoordination.ts
A src/services/authSessionClient.ts
M src/services/platformHttp.ts
A src/styles/auth_session_notice.css
M src/types/auth.ts
M tests/auth-client.spec.ts
A tests/auth-coordination.spec.ts
A tests/f2-session.spec.ts
M tests/helpers/platform-mock.ts
A tests/helpers/session-tabs-mock.ts
M tests/phase3-admin.spec.ts
```

A mudança no workflow acrescenta somente a suíte F2 ao job de testes. A política
de deploy já associada a `dev` permanece; nenhum workflow foi disparado. Os mocks
de regressão aceitam os novos GETs de preparação sem permitir fallback de POST.
O cenário administrativo 403 usa o código efetivo `AUTH_CSRF` e mantém a
verificação de correlação e de ausência de repetição da mutação.

Fora do repositório, o índice `../revisoes/README.md` registra F2 aguardando revisão
e o patch completo fica em
`../revisoes/frontend/F2-SESSOES-CSRF-LOGOUT-REVISAO.diff`. Esses artefatos não
integram o futuro commit do frontend. Nenhum arquivo foi adicionado ao stage.

## Limites e riscos que permanecem

Web Locks e BroadcastChannel coordenam participantes da mesma origem e contexto
de armazenamento compatível, usando o mesmo namespace da URL-base da API.
Frontends em origens distintas que compartilhem
cookies da API, clientes antigos, ferramentas externas e requisições iniciadas
fora desse protocolo não entram na mesma exclusão. O servidor continua
autorizando cada operação; F2 não muda sua proteção contra reuso de sessão.

Fechar uma aba, abortar fetch ou atingir timeout não prova cancelamento do trabalho
já recebido pelo backend. Uma seção liberada no navegador não comprova que um
POST incerto deixou de produzir efeito. A UI deve descartar credenciais antigas,
manter o resultado incerto e orientar a reconsulta, sem prometer rollback.

Compatibilidade das APIs do navegador e disponibilidade de contexto seguro devem
ser consideradas na homologação do navegador suportado. O fallback conservador
reduz funcionalidade; não promete refresh ou comandos administrativos quando a
exclusão real não está disponível.

Cada POST protegido acrescenta um GET de sessão. O limite da API continua
aplicável, inclusive entre abas; `Retry-After` é respeitado sem polling ou
repetição automática. Os testes simulados não homologam a quota real da API.
Sem Web Locks utilizável, logout e comandos ficam indisponíveis até usar um
navegador compatível; nenhuma implementação de lock por localStorage é usada.

Múltiplas abas com mocks não comprovam cookies HTTPS publicados, OIDC real,
integração B1 executada contra a API, estabilidade DEV/PROD nem homologação dos
provedores. B2/F3 e demais aceites da Fase 3 permanecem separados.

Referências: [integração](phase3-integracao.md), [F1](f1-validacao-local.md) e
[roteiro de homologação](phase3-homologacao.md).
