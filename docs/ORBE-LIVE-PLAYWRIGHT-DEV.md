# Orbe DEV — Playwright E2E Live (recrutadores)

Esta suíte interage com **https://devgbc.phasscode.com** e sua API real
**https://devapi.phasscode.com**. Ela **não** usa os fixtures mock do Playwright,
não altera o backend, não cadastra reuniões e não autoriza relatórios de conversas.

## Isolamento e autorização

- Execução **somente manual**, via
  [Actions → Orbe DEV Live | Playwright recruiter acceptance](../../actions/workflows/orbe-dev-live-playwright.yml).
- Escolha a branch `dev` e informe o **SHA completo de 40 caracteres** do backend
  que já teve o deploy DEV validado.
- O preflight consulta GitHub e exige que o último workflow manual DEV
  corresponda exatamente ao SHA informado e tenha os jobs `deploy` e `verify`
  aprovados. Também verifica o HEAD do backend e acessibilidade dos hosts DEV.
- Esse procedimento **não executa** deploy nem altera `main`.
- `smoke` = **3 cenários, 5 mensagens**: programação, Java→Go, Java→projetos React.
- `extended` = **5 cenários, 9 mensagens**: acrescenta Java→Go→Flutter e UNISUL.
- `maxFailures: 1`, sem retries, um único worker e execução serial. Uma falha
  HTTP interrompe a bateria; não repetir automaticamente.
- Relatórios de até 3 dias contêm exclusivamente perguntas sobre o portfólio,
  respostas públicas com mascaramento de tokens aparentes, e IDs de fontes;
  **nunca** request headers, `conversationToken`, cookies, `conversationId`,
  telas, vídeos ou traces. A revisão semântica humana continua indispensável.

## Execução local (somente com acesso aos hosts DEV)

No checkout `dev` do **frontend**, configure o SHA da release DEV
já implantada (substitua `<FULL_BACKEND_DEV_SHA>` pelo SHA real):

```bash
npm ci
npx playwright install chromium
export ORBE_LIVE_E2E_ENABLED=true
export ORBE_LIVE_EXPECTED_BACKEND_SHA=<FULL_BACKEND_DEV_SHA>
export ORBE_LIVE_SUITE=smoke
node scripts/preflight-orbe-live-dev.mjs
npm run test:orbe:live
```

O preflight exige acesso de leitura à API pública do GitHub e aos hosts DEV.
O teste Live falha explicitamente se as variáveis não forem configuradas.
`npm run test:orbe` continua apontando para a suíte mockada, sem chamada à
LLM. Os testes default também excluem `orbe-live.spec.ts`.

## Observabilidade e interpretação

O relatório Playwright registra contrato da API, provedor real, continuidade
com mesmo ID, autenticação com token sem divulgá-lo, lista de fontes, ausência
da recusa genérica, e indicadores linguísticos das respostas. **Aprovação
determinística não demonstra sozinha que todas as afirmações são verdadeiras.**
Revise as respostas públicas e referências antes de usar para um release gate.

Essa suíte valida o Orbe canônico com recuperação PPKS. **Ela não prova que
o Neo4j está ativo.** No modo `ORBE_GRAPHRAG_MODE=shadow`, o observador
somente produz telemetria, sem alterar as respostas. A homologação GraphRAG
requer, em separado, preflight dos segredos, Graph Reader/Neo4j privados,
benchmark de cobertura/proveniência e comparação lado a lado com as mesmas
perguntas. Nenhum merge `dev → main` deve decorrer automaticamente deste
workflow: o proprietário exigiu homologação real do grafo antes da promoção.
