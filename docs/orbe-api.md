# Integração do Orbe Mágico

As ações de reunião da Fase 3 estão documentadas na
[integração de sessão e agendamento](phase3-integracao.md). Elas utilizam o mesmo
chat sem streaming, com `X-Orbe-Capabilities: meetings-v1` somente quando chat HTTP
e reuniões estão habilitados. A flag de auth não controla essa capability.
Uma proposta exige revisão e consentimento no fluxo
comum; nenhuma chegada de resposta confirma um pedido automaticamente.

Atualização local **F1 — 26/10/2026**: `VITE_ORBE_API_ENABLED` continua independente
de `VITE_AUTH_ENABLED` e `VITE_MEETINGS_ENABLED`, usando a URL pública validada.
`VITE_PHASE3_ENABLED` foi retirada da ativação e é ignorada, sem fallback.
O backend é um serviço separado; esta documentação não declara deploy nem
homologação de LLM/Google/Calendar. Resultados F1 são registrados em
[f1-validacao-local.md](f1-validacao-local.md), separados do histórico abaixo.

## Contrato de referência

A referência inicial foi o [OpenAPI publicado](https://devapi.phasscode.com/api/v1/openapi.json),
consultado em 22/10/2026, versão 0.1.0. Foram lidos também, apenas como referência,
`docs/api/frontend-integration.md`, `docs/api/README.md`,
`packages/contracts/src/index.ts` e `examples/frontend-client.ts` da branch `dev`
do repositório `phasscode-platform`. Mudanças posteriores nesses arquivos não são
tratadas como disponíveis na API publicada.

O frontend utiliza `POST /api/v1/chat`, sem streaming e sem escolha de modelo.
O contrato aceita mensagens de até 2000 caracteres, corpo HTTP de até 8192 bytes,
respostas de até 8000 caracteres e até 10 fontes. Há uma diferença de contagem:
JSON Schema conta pontos Unicode, enquanto o Zod atual e `maxlength` usam UTF-16.
Cliente e interface adotam também o limite conservador de 2000 unidades UTF-16,
evitando um 400 inesperado ao enviar muitos emojis ao backend atual.

## Arquitetura e arquivos

- `src/types/orbe.ts`: DTOs independentes de pacotes do backend.
- `src/services/orbeClient.ts`: HTTP, validação das respostas, sessão em memória,
  timeout de 45 segundos, cancelamento e erros públicos tipados.
- `src/services/orbeSources.ts`: protocolos HTTP(S), referências sem link seguro
  apresentadas como texto e remoção de links repetidos.
- `src/services/orbeDiagnostics.ts` e `src/services/orbeDiagnosticEvent.ts`:
  diagnóstico apenas em desenvolvimento, com metadados públicos sanitizados.
- `scripts/orbeDiagnosticsPlugin.ts` e `vite.config.ts`: encaminham o diagnóstico
  ao terminal do Vite pelo canal de desenvolvimento existente, sem proxy HTTP.
- `src/services/orbeDemo.ts`: preserva as respostas demonstrativas da produção.
- `src/hooks/useOrbeChat.ts`: histórico, loading, texto, erros, cooldown e ciclo
  de vida das consultas, sem acesso direto às credenciais da conversa.
- `src/components/OrbAssistant.tsx` e `src/styles/orbe_assistant.css`: interface,
  aviso de privacidade e fontes. Canvas, animações, modal,
  tipografia e navegação continuam utilizando a implementação existente.
- `src/config/orbe.ts` e `src/vite-env.d.ts`: configuração pública tipada.
- `.env.example`: exemplo local sem segredos.
- `scripts/orbe-build-policy.mjs` e `.github/workflows/deploy.yml`: seleção por branch.
- `playwright.orbe.config.ts`, `tests/orbe-api.spec.ts`,
  `tests/orbe-client.spec.ts`, `tests/orbe-config.spec.ts`,
  `tests/orbe-diagnostics.spec.ts`, `tests/helpers/orbe-mock.ts` e `tests/fixtures.ts`: testes simulados e proteção
  contra chamadas reais de chat nas suítes. `package.json` acrescenta `test:orbe`.
- `playwright.config.ts`: separa a suíte de API; `.gitignore` ignora seu build.
- `README.md` e `docs/testes.md`: instruções de uso e verificação.

## Configuração do build

| Destino preparado | Orbe HTTP | Auth | Reuniões | URL |
| --- | --- | --- | --- | --- |
| Branch `dev`, incluindo PR para `dev` | `true` | `true` | `false` | `https://devapi.phasscode.com` |
| Branch `main`, incluindo PR para `main` | `false` | `false` | `false` | vazia; demonstração |
| Build local sem configuração | `false` | `false` | `false` | vazia, salvo configuração explícita |
| Suíte isolada de API | conforme cenário | conforme cenário | conforme cenário | `.invalid` conhecida, sempre interceptada |

Só a string exata `true`, com API válida, habilita uma flag. O perfil DEV F1
habilita chat sem ferramentas de reunião, ainda que o login esteja disponível.
Esses valores descrevem o código de build preparado; não comprovam uma publicação.

O workflow executa `node scripts/orbe-build-policy.mjs --github-env` antes de
`npm run build`. A branch de destino é `GITHUB_BASE_REF || GITHUB_REF_NAME`.
Assim, um build Vite em modo `production` da branch `dev` recebe a URL correta,
sem depender de `.env.development`. Os testes, imagem e deploy continuam usando
o mesmo `dist` principal. O teste de API utiliza uma pasta separada e não o substitui.

No domínio `gbc.phasscode.com`, a configuração em runtime bloqueia URLs que não
sejam da origem futura `https://api.phasscode.com`. A política de build atual
mantém a integração desativada na `main`, mesmo que existam arquivos `.env` locais.
A ativação da API produtiva exige homologação e autorização posterior.
Os defines de `main` forçam Orbe/auth/reuniões desligados e URL vazia, mesmo com
variáveis locais herdadas. A exceção interna de testes exige
`PHASSCODE_MOCK_API_BUILD=true` e exatamente `https://orbe-api.invalid` ou
`https://phase3-api.invalid`; não permite chamar a API DEV/PROD em testes.

Para desenvolvimento manual, copie `.env.example` para `.env.local` e configure:

```dotenv
VITE_ORBE_API_ENABLED=true
VITE_AUTH_ENABLED=false
VITE_MEETINGS_ENABLED=false
VITE_API_BASE_URL=https://devapi.phasscode.com
```

Use `.env.local` na raiz para a configuração desta máquina. O Vite também aceita
`.env`, mas `.env.local` tem prioridade sobre ele; não é necessário manter os dois
com as mesmas variáveis. O nome do arquivo é uma convenção do Vite, não da API.
Arquivos específicos do modo e variáveis já definidas no processo podem ter
prioridade maior. `.env.example` é apenas o modelo versionado, sem carregamento automático.

Migrar configurações antigas escolhendo auth e reuniões explicitamente; manter
apenas `VITE_PHASE3_ENABLED=true` não ativa esses módulos. Os
[quatro perfis](phase3-integracao.md#ambientes-e-migração-das-flags) podem ter Orbe
ligado ou desligado. Reuniões públicas não exigem login do visitante, mas continuam
dependendo do módulo administrativo/Calendar no servidor. Uma entrada pública
independente da LLM ainda é pendência separada de F1.

Reinicie o Vite após alterar o ambiente. Essas variáveis são públicas, incorporadas
ao JavaScript. Nunca inclua `LLM_API_KEY`, JWTs, tokens de conversa ou outras
credenciais em `VITE_*`. Não há proxy novo, alteração de Nginx ou Cloudflare.

## Sessão e cancelamento

A primeira chamada envia somente `message`. O cliente guarda `conversationId`
e `conversationToken` em sua closure privada; mensagens seguintes enviam o ID
no JSON e o token em `X-Conversation-Token`. O resultado entregue ao React não
inclui o token. Não há `Authorization`, cookies, storage, URL ou logs da sessão.

Fechar/reabrir mantém o histórico e a sessão já estabelecida enquanto o componente
continuar montado. Fechar durante uma consulta aborta a espera, preserva a pergunta
e ignora respostas tardias. Desmontar limpa a sessão e aborta a consulta.
O botão NOVA CONVERSA foi retirado a pedido do proprietário. Recarregar o site
perde a sessão local; a próxima mensagem inicia outra conversa. Isso não solicita exclusão no servidor:
o contrato atual não fornece endpoint de exclusão de conversa.

Cancelar ou atingir timeout não prova que o servidor deixou de processar a
mensagem. Por isso não há retry automático, polling ou reenvio em background.
O visitante decide se deseja reenviar o texto preservado. Os limites globais
continuam sob responsabilidade da API.

## Erros, fontes e privacidade

400/413/415 orientam revisar a pergunta; 403 informa origem não autorizada;
404 invalida a sessão e permite uma nova conversa; 409 informa processamento
simultâneo; 429 informa limite/orçamento; 500/502/503/504 e rede/timeout mostram
indisponibilidade segura. São usados textos públicos locais, sem stack ou detalhes
internos. O `correlationId` do envelope aparece discretamente para suporte.
`Retry-After` aceita segundos ou data HTTP e bloqueia envios pelo período informado.

Respostas são texto React, sem HTML interpretado. Fontes aparecem pelo título;
somente URLs HTTP(S) sem credenciais recebem link externo com
`rel="noopener noreferrer"`. Links repetidos são removidos. As referências não
certificam automaticamente cada frase da resposta. `meta.simulated=true` mostra
aviso explícito de resposta simulada.

Antes do formulário em modo API, o aviso informa envio potencial ao provedor de
IA, armazenamento temporário possível e orienta não enviar dados pessoais
sensíveis. O escopo do assistente é o portfólio e a trajetória profissional.
Não foram criadas promessas de retenção específica, anonimização ou conformidade legal.

## Diagnóstico no desenvolvimento

Ao executar `npm run dev`, os envios ao chat mostram eventos `[Orbe]` no terminal
do Vite e no console do navegador (F12 → Console). Há eventos de início, sucesso
e falha, com duração, tipo de erro, status HTTP, código público reconhecido,
`correlationId` e `Retry-After`, quando disponíveis. Por exemplo:

```text
[Orbe] {"phase":"failed","kind":"http","status":429,"code":"LLM_BUDGET_EXHAUSTED","retryAfterSeconds":30,"durationMs":250}
```

Os campos são reconstruídos por uma lista permitida nos dois lados. Códigos
desconhecidos viram `UNKNOWN_API_ERROR`. Não são registrados perguntas,
respostas, ID/token da conversa, headers, URLs, stack traces ou texto bruto do
servidor. Se o envelope de erro não for JSON, o cliente ainda tenta obter a
referência pública do header `X-Correlation-Id` exposto pelo CORS.

O encaminhamento usa os [eventos de desenvolvimento do Vite](https://vite.dev/guide/api-plugin#client-server-communication).
Não adiciona proxy ou coletor HTTP, não muda o transporte do chat e fica fora
do build publicado, inclusive na branch `dev`. Em `npm run preview` ou no site
publicado, consulte F12 → Network e os logs do backend pela correlação recebida.
Falhar ao registrar o diagnóstico não interrompe nem repete uma pergunta.

`kind=network` significa que o navegador não obteve uma resposta HTTP acessível:
pode ser conexão, DNS, TLS, bloqueio de origem (CORS) ou outra falha do transporte.
Nesse caso não há status HTTP ou código legível; não se pode inferir falta de
cota. `429` indica limite/orçamento, mas o código `LLM_BUDGET_EXHAUSTED` identifica
o orçamento global da própria API, e não comprova o esgotamento do plano free
do OpenRouter. Falhas do provedor podem ser apresentadas pelo backend como
502/503/504; a causa específica precisa ser conferida nos logs do backend.

Em 23/10/2026, preflights OPTIONS ao backend publicado retornaram 403, sem
autorização CORS, para `http://localhost:5173` e `http://127.0.0.1:5173`.
`https://devgbc.phasscode.com` retornou 204 com autorização. Essa verificação
não enviou mensagens ao chat nem consumiu cota. Para testar a API publicada a
partir do Vite, o responsável pelo backend precisa acrescentar a origem local
exata a `CORS_ORIGINS`, preservando as origens já autorizadas, e aplicar a
configuração naquele serviço. Nenhum arquivo do backend foi alterado aqui.

## Testes e homologação pendente

F1 acrescenta a matriz de flags e sua relação com capability, sem incluir F2
(coordenação entre abas/logout) ou B2/F3 (E2E real conjunto). Os resultados locais
atuais ficam em [f1-validacao-local.md](f1-validacao-local.md). As medições e
contagens de 22–25/10/2026 abaixo são histórico das revisões iniciais do Orbe,
não testes reexecutados nem homologação real da atualização F1.

```sh
npm run typecheck
npm run build
npm test
npm run test:orbe
npm run test:f1
npm run test:visual
```

Os testes interceptam o chat com dados sintéticos, inclusive smoke/visual e o
build configurado para `devapi`. O cliente recebe `fetch` simulado nos testes puros.
Os testes de ambiente conferem URLs e flags nos bundles de dev/main em modo
production. A suíte não consome OpenRouter. Relatórios ficam em
`playwright-report/functional/` e `playwright-report/orbe/`; saídas ficam em
`test-results/functional/` e `test-results/orbe/`. As pastas são separadas para
uma suíte não limpar traces e screenshots da outra durante testes locais paralelos.

Após concluir o trabalho paralelo no backend, revisar novamente o OpenAPI
efetivamente publicado e homologar manualmente uma conversa em `devgbc.phasscode.com`:
criação, continuação, fontes, erro, recarregamento e fechamento. Essa homologação real não
foi feita nesta tarefa, para não consumir cota nem antecipar publicação.

No snapshot inicial, o OpenAPI consultado anunciava `http://localhost:3000` em `servers`.
Essa indicação não é usada pelo cliente: a URL vem do ambiente. O preflight
OPTIONS de homologação foi conferido sem pergunta de chat: HTTP 204, origem
`https://devgbc.phasscode.com`, headers `Content-Type` e `X-Conversation-Token`,
com `X-Correlation-Id` e `Retry-After` expostos.

Para uso manual local, a origem exata precisa estar autorizada no CORS do backend:
`localhost` e `127.0.0.1`, assim como portas diferentes, são origens diferentes.
Os testes locais usam mocks e não dependem dessa autorização.

## Histórico da validação local da integração inicial

Os resultados abaixo pertencem à integração inicial do chat. O histórico de
autenticação/reuniões está em [Integração da Fase 3](phase3-integracao.md);
o registro desta atualização está em [validação local F1](f1-validacao-local.md).

- `npm run typecheck`: aprovado.
- `npm run build`: aprovado com a integração de dev habilitada e também com a
  configuração demonstrativa de produção. O bundle real de dev contém
  `https://devapi.phasscode.com`; o demonstrativo não contém a URL de dev nem a de testes.
- `npm test`: 66 aprovados naquela validação, contra o build demonstrativo,
  incluindo cliente, configuração e diagnóstico no Vite real com chat interceptado.
  O build de dev também passou pela regressão funcional durante a integração inicial.
- `npm run test:orbe`: 21 aprovados com API fictícia e respostas simuladas.
- `npm test -- tests/interactions.spec.ts --output test-results/production-demo --reporter list`:
  4 aprovados contra o build demonstrativo, incluindo histórico e teclado do Orbe.
- `npm run test:visual`: 2 comparações aprovadas, sem atualizar as referências.
- Revisão visual do Orbe com API simulada em 320×568, 568×320 e 1440×900,
  incluindo os dois temas e fontes de referência. Não houve scroll horizontal.

Nenhum POST real de chat foi enviado e nenhuma cota da OpenRouter foi consumida.
As únicas verificações HTTP publicadas foram de leitura: contrato OpenAPI,
headers do frontend e preflight CORS da homologação. O `dist/` local deixado ao
final corresponde ao modo demonstrativo; o CI continuará selecionando o modo
correto pela branch. As três alterações CSS já existentes no workspace foram preservadas.
