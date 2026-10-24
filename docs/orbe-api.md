# Integração do Orbe Mágico

Implementação restrita ao frontend `web-portfolio-v2`, na branch `dev`. O backend é
um serviço separado e não foi alterado nesta tarefa. Não foram criados commits,
pushes, deploys, autenticação ou infraestrutura adicional.

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
  aviso de privacidade, fontes e botão NOVA CONVERSA. Canvas, animações, modal,
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

| Destino | Ativação | URL |
| --- | --- | --- |
| Branch `dev`, incluindo PR para `dev` | `true` | `https://devapi.phasscode.com` |
| Branch `main`, incluindo PR para `main` | `false` | vazia; demonstração |
| Build local sem configuração | `false` | vazia; demonstração |
| Suíte isolada de API | `true` | `https://orbe-api.invalid`, sempre interceptada |

O workflow executa `node scripts/orbe-build-policy.mjs --github-env` antes de
`npm run build`. A branch de destino é `GITHUB_BASE_REF || GITHUB_REF_NAME`.
Assim, um build Vite em modo `production` da branch `dev` recebe a URL correta,
sem depender de `.env.development`. Os testes, imagem e deploy continuam usando
o mesmo `dist` principal. O teste de API utiliza uma pasta separada e não o substitui.

No domínio `gbc.phasscode.com`, a configuração em runtime bloqueia URLs que não
sejam da origem futura `https://api.phasscode.com`. A política de build atual
mantém a integração desativada na `main`, mesmo que existam arquivos `.env` locais.
A ativação da API produtiva exige homologação e autorização posterior.

Para desenvolvimento manual, copie `.env.example` para `.env.local` e configure:

```dotenv
VITE_ORBE_API_ENABLED=true
VITE_API_BASE_URL=https://devapi.phasscode.com
```

Use `.env.local` na raiz para a configuração desta máquina. O Vite também aceita
`.env`, mas `.env.local` tem prioridade sobre ele; não é necessário manter os dois
com as mesmas variáveis. O nome do arquivo é uma convenção do Vite, não da API.
Arquivos específicos do modo e variáveis já definidas no processo podem ter
prioridade maior. `.env.example` é apenas o modelo versionado, sem carregamento automático.

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
NOVA CONVERSA limpa o histórico, o texto, o ID e o token locais. Recarregar o site
também perde essa sessão. Reset não é uma solicitação de exclusão no servidor:
o contrato atual não fornece endpoint de exclusão de conversa.

Cancelar ou atingir timeout não prova que o servidor deixou de processar a
mensagem. Por isso não há retry automático, polling ou reenvio em background.
O visitante decide se deseja reenviar o texto preservado. Nova conversa também
não elimina um cooldown global informado por `Retry-After`.

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

```sh
npm run typecheck
npm run build
npm test
npm run test:orbe
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
criação, continuação, fontes, erro, reset e fechamento. Essa homologação real não
foi feita nesta tarefa, para não consumir cota nem antecipar publicação.

O OpenAPI consultado ainda anuncia `http://localhost:3000` em `servers`.
Essa indicação não é usada pelo cliente: a URL vem do ambiente. O preflight
OPTIONS de homologação foi conferido sem pergunta de chat: HTTP 204, origem
`https://devgbc.phasscode.com`, headers `Content-Type` e `X-Conversation-Token`,
com `X-Correlation-Id` e `Retry-After` expostos.

Para uso manual local, a origem exata precisa estar autorizada no CORS do backend:
`localhost` e `127.0.0.1`, assim como portas diferentes, são origens diferentes.
Os testes locais usam mocks e não dependem dessa autorização.

## Resultado da validação local

- `npm run typecheck`: aprovado.
- `npm run build`: aprovado com a integração de dev habilitada e também com a
  configuração demonstrativa de produção. O bundle real de dev contém
  `https://devapi.phasscode.com`; o demonstrativo não contém a URL de dev nem a de testes.
- `npm test`: 66 aprovados na validação mais recente, contra o build demonstrativo,
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
