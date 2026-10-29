# PHASSCODE — portfólio profissional em pixel art

Portfólio público de Pedro Santos, construído em React, TypeScript e Vite.
Apresenta projetos, experiência, formação e o **Orbe Mágico**, assistente
virtual que representa sua trajetória profissional e cita fontes do portfólio.

## Funcionalidades atuais

- Navegação pelas seções Sobre, Projetos, Experiência e Formação.
- Arquivo de Missões e visualização de projetos.
- Orbe conversacional sobre competências, experiência, estudos e contato.
- Temas claro/escuro, acessibilidade e suporte a movimento reduzido.

**Não há login, baú, contas, painel administrativo, reuniões nem notificações.**
O Orbe não agenda compromissos nem envia mensagens em nome do proprietário.
Os módulos históricos da Fase 3 ainda poderão ser vistos no Git, mas não
são importados pela interface pública nem fazem parte da release.

## Execução local

Requer Node.js 24 e npm:

```bash
npm ci
cp .env.example .env.local
npm run dev
npm run build
npx playwright install chromium
npx playwright test tests/portfolio.spec.ts tests/routing.spec.ts tests/orbe-public.spec.ts tests/orbe-client.spec.ts
```

O chat real requer `VITE_ORBE_API_ENABLED=true` e uma URL válida no
`VITE_API_BASE_URL`. Sem API habilitada, a interface mostra uma demonstração
de respostas predefinidas. Nunca coloque chaves de LLM em variáveis `VITE_*`.

## Ambientes no Mac Mini

| Branch | Site | API de chat |
| --- | --- | --- |
| `dev` | `https://devgbc.phasscode.com` | `https://devapi.phasscode.com` |
| `main` | `https://gbc.phasscode.com` | `https://api.phasscode.com` |

O workflow `.github/workflows/deploy.yml` valida o frontend, executa SAST,
publica uma imagem imutável e a verifica em ambiente descartável.
Para publicar no Mac Mini use **Actions → PHASSCODE → Run workflow**,
selecione a branch e execute `apply_remote=true`.

O deployment requer `ENABLE_REMOTE_DEPLOY=true` no environment
correspondente (`development` ou `production`), acesso Tailscale/SSH,
checkout limpo e o servidor previamente configurado. O deploy de produção
deve exigir aprovação humana no GitHub Environment.

**Nenhum PR ou push publica no Mac Mini por si só.**
Faça o deploy do backend compatível primeiro, depois do frontend.
O frontend nunca deve fazer chamadas de produção ao backend de desenvolvimento.

## Base de conhecimento

O conteúdo visível fica em `src/data/`.
A base consultada pelo Orbe reside no repositório
`SladeSouzaSantos/phasscode-platform`, em `knowledge/portfolio.json`.
Atualize ambos quando houver uma mudança profissional relevante.

Os testes legados de login e reuniões permanecem no histórico do repositório;
a pipeline de release usa apenas as suítes pertinentes ao portfólio público.
