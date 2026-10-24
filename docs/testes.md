# Testes do portfólio

## Build local

```sh
npm ci
npm run build
npm test
```

A suíte existente continua executando no preview de produção do Vite, iniciado automaticamente na porta 4173. Inclui navegação, histórico, modais, teclado, filtros, temas, animações e imagens. Os novos testes acrescentam:

- Responsividade em tablet (768 × 1024) e desktop (1440 × 900), incluindo navegação, catálogo e modal.
- Redimensionamento sem recarregar entre celular, tablet e desktop: cards e placa do mural, colunas da Academia, textos dentro das molduras e uso do orbe em retrato/paisagem. Os testes medem os glifos com a Press Start 2P local carregada; a navegação também é verificada a partir de 270 px.
- Axe com regras WCAG 2.1 A/AA nas quatro seções, nos dois temas, no catálogo e nos modais de detalhes, login e orbe.
- Um fixture compartilhado que detecta erros JavaScript, `console.error`, respostas HTTP de erro, requisições malsucedidas e MIME incorreto em scripts, estilos e imagens do próprio site.

As falhas incluem URL, status ou tipo do recurso e são anexadas ao relatório Playwright. Falhas de serviços externos são anexadas separadamente; não bloqueiam o portfólio. A fonte Press Start 2P é servida pelo próprio site. Requisições canceladas com `net::ERR_ABORTED` durante navegação são desconsideradas. Os testes `runtime-errors.spec.ts` usam páginas isoladas com erros intencionais para verificar o monitor.

O axe complementa os testes de teclado e foco. Uma execução sem violações não comprova conformidade completa: leitura por tecnologias assistivas, clareza do conteúdo e outros aspectos ainda precisam de avaliação humana. [Documentação Playwright](https://playwright.dev/docs/accessibility-testing).

## Orbe com API simulada

```sh
npm run test:orbe
```

Essa suíte compila em `dist-orbe-test/`, habilita a API com a URL sintética
`https://orbe-api.invalid` e inicia o preview na porta 4175. Interceptações Playwright
cobrem criação/continuação, tokens, loading, fontes, reset, erros, cancelamento,
teclado e mobile. Não utiliza a API real nem a OpenRouter.

A suíte padrão inclui testes puros do cliente com `fetch` simulado e testes da política
de build por branch, inclusive inspeção de bundles de produção gerados em memória.
Os testes de diagnóstico usam o WebSocket de desenvolvimento real do Vite em
loopback e uma conversa HTTP interceptada, verificando que o terminal recebe
metadados úteis sem perguntas, respostas ou tokens. Também verificam que o
plugin não participa do build de produção e que falhas no logger não afetam o chat.
O fixture compartilhado também intercepta chat nas suítes funcional, visual e smoke,
mesmo quando o build contém a URL de desenvolvimento. Nenhum teste deve usar
`route.continue()` no endpoint de chat. Consulte [os detalhes da integração](orbe-api.md).

## Smoke da aplicação publicada

O arquivo `playwright.smoke.config.ts` **não inicia servidor local**. A URL é obrigatória para evitar executar acidentalmente contra o preview.

No PowerShell:

```powershell
$env:SMOKE_BASE_URL = 'https://devgbc.phasscode.com'
npm run test:smoke
```

Os testes verificam `/` e `/projetos` por acesso direto e atualização, navegação ao catálogo e abertura de detalhes. O mesmo monitor detecta falhas de execução e recursos no navegador real. Não há login, gravação de dados ou varredura ativa contra a publicação.

Para comparar também o conteúdo publicado com um build específico:

```powershell
$env:SMOKE_EXPECTED_DIST = 'dist'
npm run test:smoke
```

Essa pasta deve conter o build que foi efetivamente enviado ao servidor. Apontar para um build local diferente produzirá divergência. Sem `SMOKE_EXPECTED_DIST`, somente a comparação do build é marcada como ignorada; os demais smoke tests executam normalmente.

No CI, `verify_deploy` executa após `deploy`, baixa o artefato `portfolio-dist` da mesma execução e sempre define `SMOKE_EXPECTED_DIST`. Assim, confere referências e bytes dos bundles JavaScript/CSS entregues por Nginx e Cloudflare, além dos testes no navegador. A branch `main` usa `https://gbc.phasscode.com`; a branch `dev` usa a variável existente `DEV_SITE_URL=https://devgbc.phasscode.com`. Os relatórios ficam no artefato `playwright-smoke-<branch>`, com screenshots e traces de falhas.

Uma falha do smoke reprova a etapa final. O rollback existente continua sendo realizado dentro do job de deploy quando suas próprias verificações falham; falhas posteriores do smoke não acionam esse mecanismo.

## Regressão visual

```sh
npm run build
npm run test:visual
```

A configuração visual é separada da suíte padrão. Compara screenshots da página inicial e do catálogo com as referências em `tests/visual.spec.ts-snapshots/`. O movimento é reduzido, as imagens/fontes aguardam carregamento, e apenas o widget de canvas procedural é mascarado para evitar diferenças aleatórias.

As referências devem ser produzidas e comparadas no mesmo sistema operacional e navegador. As referências Windows/Edge incluídas não substituem referências Linux/Chromium. Por isso essa comparação não é adicionada ao job Linux padrão sem referências adequadas. [Orientação oficial sobre diferenças de renderização](https://playwright.dev/docs/test-snapshots).

Depois de uma mudança visual intencional, gere novas referências explicitamente e revise as imagens antes de incluí-las no commit:

```sh
npm run test:visual -- --update-snapshots
```

O comando normal usa `updateSnapshots: 'none'`: não aceita automaticamente uma imagem nova como referência. As imagens `actual`, `expected` e `diff`, quando houver divergência, ficam em `test-results/visual/` e no relatório `playwright-report/visual/`.
