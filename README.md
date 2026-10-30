# PHASSCODE — portfólio profissional em pixel art

Portfólio público de Pedro Santos, construído em React, TypeScript e Vite.
Apresenta projetos, experiência, formação e o **Orbe Mágico**, assistente
virtual que representa sua trajetória profissional e cita fontes do portfólio.

## Funcionalidades atuais

- Navegação pelas seções Sobre, Projetos, Experiência e Formação.
- Arquivo de Missões e visualização de projetos.
- Orbe conversacional sobre competências, experiência, estudos e contato.
  No chat, **Enter envia** a pergunta e **Shift + Enter insere uma nova linha**.
  Use o botão **Maximizar chat** para expandir a janela e **Restaurar tamanho do chat**
  para voltar ao modo compacto; a conversa permanece aberta.
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
npm run test:orbe
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

### Carregamento e transições do portfólio

A primeira renderização usa um preloader pixel art para a cena e fonte visíveis;
a espera é limitada a 2,2 segundos (sem bloquear imagens GIF animadas), com
remoção após o primeiro paint, fallback visual e suporte a movimento reduzido.
As quatro seções trocam conteúdo por hash sem reload, com entrada curta de
300 ms. Imagens WebP das cenas seguintes são antecipadas ao passar o mouse,
focar ou tocar no item do menu; as animações de fundo continuam independentes.

Validação: `npx playwright test tests/site-loading.spec.ts`, incluindo desktop,
320 px, acesso direto por hash, histórico e `prefers-reduced-motion`.

### Transição circular entre seções

A troca dos itens do menu usa a mesma técnica de `clip-path: circle(...)` do
seletor de tema. Um portal visual sai do botão selecionado, cobre o viewport,
troca a cena por baixo e se retrai, sem trocar o documento, descartar histórico
ou carregar GIFs como bloqueio. Links com Ctrl/Cmd e movimento reduzido seguem
navegação padrão. Cliques repetidos durante a transição não criam filas. As
navegações pelo histórico continuam instantâneas.

## Guilda de Projetos — cinco casos de estudo

A Guilda e o Arquivo de Missões compartilham `src/data/projetos.ts`. A curadoria
apresenta **GreenCity OS, HSP Simulator, GreenCity API, ReserGas e Guardrails/Prompt
Injection**. O PHASSCODE e o Orbe não são listados como projeto externo: o próprio
site demonstra sua implementação.

- Ao passar o mouse sobre um pergaminho, a folha gira em 3D e exibe a imagem no verso;
  ao clicar, abre a ficha de desafios, tecnologias e links.
- Com teclado, foco visível e Enter abrem a ficha; com tela touch, o toque abre
  diretamente a ficha, sem exigir hover. `prefers-reduced-motion` desativa o giro.
- Capturas de tela: GreenCity OS (imagem fornecida pelo autor), API de Orçamento
  (recorte da página 2 do PDF fornecido), ReserGas (imagem publicada no README).
- As artes HSP Simulator e Guardrails são ilustrações, não capturas de software.
- O endereço `https://hsp.greencity.net.br/` é apresentado como demonstração do
  simulador web HSP; ele não executa o aplicativo Flutter GreenCity OS no navegador.
- As capturas anexadas foram reduzidas para o mural; mantenha arquivos originais
  fora dos assets públicos quando houver dados comerciais ou pessoais.

Verifique o catálogo via `npx playwright test tests/portfolio.spec.ts tests/project-gallery.spec.ts`.
A publicação em DEV/PROD segue o fluxo operacional acima: este trabalho é
proposto em um PR para `dev`, sem merge em `main` ou deploy remoto automático.

### Ajustes de imagens e cartazes (2026-10-30)

- A Guilda e o Arquivo usam `ProjetoMidia`: três screenshots lado a lado para GreenCity OS e ReserGas, uma imagem para os demais.
- As telas do GreenCity OS são capturas fornecidas pelo autor; ReserGas utiliza três imagens de seu README.
- GreenCity OS e a segunda página de proposta comercial foram republicados em WebP válido.
- Fundos artificiais e bordas dos containers de imagens removidos; o fundo interno das interfaces reais é preservado.
- A área útil dos cartazes foi limitada para evitar que títulos, categorias e descrições atinjam os ornamentos.
- Sem alterações em `main`, Orbe, backend, workflows ou deploy remoto.
