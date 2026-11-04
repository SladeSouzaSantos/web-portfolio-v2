# Orbe — testes de recrutador com Playwright local (DEV e MAIN)

Executor **local** de Chromium, sem usar GitHub Actions, sem mocks, sem alteração de branch, sem deploy e sem alterações nos containers. A chamada ao chat é real: pode usar crédito/limite do provedor LLM e criar conversas transitórias no backend. Não precisa de `.env` ou token de API, pois interage com a interface pública como recrutador.

## Instalação

O executor já está versionado neste repositório na branch `dev`, em `scripts/orbe-local-playwright.mjs`. Não é necessário extrair ZIP ou copiar arquivos.

No terminal, na raiz do frontend:

```bash
npm ci
npx playwright install chromium
npm run test:orbe:local -- --self-test
```

O script é compatível com Node.js 22.12+ (o projeto recomenda Node 24). Na primeira instalação no Linux, se houver dependências de navegador ausentes, execute `npx playwright install --with-deps chromium` com as permissões adequadas.

No Windows PowerShell, os comandos Node/npm são os mesmos. Não é necessário iniciar o Vite: Playwright acessa o site já implantado.

## Execução

**1. Ver o plano sem enviar perguntas:**

```bash
npm run test:orbe:local -- --env both --suite extended --max-requests 24
```

**2. Testar DEV, seis mensagens (smoke):**

```bash
npm run test:orbe:local -- --env dev --suite smoke --execute --tag shadow-on
```

**3. Testar MAIN/produção, seis mensagens (smoke):**

```bash
npm run test:orbe:local -- --env main --suite smoke --execute --tag production
```

**4. Comparar DEV e MAIN com os mesmos cenários estendidos (12 mensagens em cada, 24 no total):**

```bash
npm run test:orbe:local -- --env both --suite extended --max-requests 24 --execute --tag comparativo
```

**5. Abrir a janela do navegador (opcional):**

```bash
npm run test:orbe:local -- --env dev --suite smoke --execute --headed
```

O script é independente da branch Git em que você está: `--env dev` navega em `https://devgbc.phasscode.com` e chama `https://devapi.phasscode.com`; `--env main` navega em `https://gbc.phasscode.com` e chama `https://api.phasscode.com`. **O alvo main é produção real**: por isso é preciso usar `--execute` e cada mensagem conta como uma interação genuína do Orbe.

## O que é testado

- **Smoke (6 mensagens por ambiente):** `Pedro tem experiência com programação? → Quabtos anos? → E sobre Go?`; `Pedtro têm experiência? → E com o GO?`; `Pedro sabe Java?`.
- **Extended (12 mensagens por ambiente):** smoke + `Java → projetos React`; apresentação sobre IA; duração geral; Flutter; status de graduação da UNISUL.

Cada cenário abre conversa nova (isolada); dentro de um cenário são verificadas a continuidade e a autenticação da conversa sem registrar `conversationId` ou `conversationToken`. Todos os envios são sequenciais, **sem tentativas automáticas de repetição**. O executor interrompe o ambiente quando recebe HTTP 429, 402 ou 503.

Critérios: evidências citadas, não simulação, ausência de mensagem genérica de fora do escopo, correspondência de tecnologia/tema, distinção de vínculos profissionais e cargos híbridos, duração de 10 anos e 10 meses em perguntas totais, ausência de afirmações indevidas sobre Go, formação não concluída e observações de cautela sobre a resposta de IA. `PASS` e `FAIL` são **verificações automatizadas**, não uma prova de veracidade completa; `REVIEW` pede julgamento humano. Uma regressão pode fazer o processo retornar código 1, mas os relatórios serão gerados.

## Relatórios para enviar ao ChatGPT

Os arquivos ficam em `reports/orbe-local/<data>-<ambiente>-<suite>-<tag>/`:

- `dev.md` e `dev.json` ou `main.md` e `main.json`: perguntas, respostas públicas (até 7.500 caracteres por turno), IDs e URLs das fontes, duração por chamada, verificações e falhas.
- `comparison.md` e `comparison.json`: aparecem quando `--env both` é selecionado; contrastam critérios, tempos e coincidência do texto/fontes por pergunta.

**Envie os arquivos `.md` de ambos os ambientes e `comparison.md` aqui no chat.** Os `.json` são úteis para análises automatizadas. Não envie cookies, tokens, headers, `.env` ou segredos do servidor. O script não armazena essas credenciais nem screenshots, vídeos ou traces. O diretório `reports/orbe-local/` já é ignorado por `.gitignore` para evitar commits acidentais.

## GraphRAG shadow: o que este teste pode demonstrar

O modo `shadow` **não altera a resposta pública**: ele avalia o grafo após gerar a resposta canônica. Diferenças DEV x MAIN podem refletir código, índice, documentação, modelos, contexto ou variabilidade da LLM; portanto, **não provam efeito causal do shadow**.

Para validar o shadow de verdade, mantenha o modo ativo no backend DEV e capture separadamente **somente a telemetria sanitizada**, por exemplo:

```bash
API=$(docker ps -q \
  --filter label=com.docker.compose.project=phasscode-platform-dev \
  --filter label=com.docker.compose.service=api | head -n 1)
docker logs --since 10m "$API" 2>&1 \
  | grep '"event":"orbe_graphrag_shadow"' \
  | tail -n 30
```

A saída do Docker não deve incluir tokens; **não cole logs completos indiscriminadamente**. O `--tag shadow-on` é apenas uma anotação do operador, não verificação técnica remota de flags. Para estudos comparativos, mantenha os mesmos cenários, commit backend, configuração de modelo e suíte.

## Verificações offline (sem rede)

```bash
node --check scripts/orbe-local-playwright.mjs
npm run test:orbe:local -- --self-test
```

Verificados nesta entrega: sintaxe Node e testes offline de contagem de chamadas, redação de token e critérios de regressão. **Nenhum teste live foi disparado em GitHub Actions por este script.**