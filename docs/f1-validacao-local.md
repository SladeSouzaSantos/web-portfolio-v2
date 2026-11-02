# F1 — Validação local de flags e navegação Google

Registro concluído em **26/10/2026**, America/Sao_Paulo. Base do frontend:
`dev/75f47eb`. Este arquivo acompanha somente F1 e separa seus resultados dos
testes históricos de 22–25/10/2026. Não declara commit, publicação, deploy ou
homologação externa.

## Escopo

- `PlatformConfig` com `authEnabled`, `meetingsEnabled` e `apiBaseUrl`.
- Flags `VITE_AUTH_ENABLED` e `VITE_MEETINGS_ENABLED` independentes do Orbe;
  `VITE_PHASE3_ENABLED` ignorada sem fallback; ativação somente com `true` exato.
- Perfil DEV preparado: Orbe/auth ligados, reuniões desligadas. Build `main`
  com as três flags falsas e URL vazia; exceção restrita das APIs `.invalid`.
- Shell administrativo sem fetch de reuniões desligadas; capability `meetings-v1`
  condicionada ao chat HTTP e às reuniões, sem depender da flag de auth.
- Callback com allowlist de erros públicos, mensagem local segura, limpeza da
  URL, `returnTo` relativo e sessão confirmada pela API.

## Resultados desta revisão

**Resultados confirmados em 26/10/2026: 270 testes aprovados**, somando as quatro
suítes abaixo. Tipos, integridade do diff e os três builds executados também
passaram. São resultados locais desta revisão, com as APIs de teste interceptadas.

| Verificação | Resultado registrado |
| --- | --- |
| Tipos | `npm run typecheck`: aprovado. |
| UI de flags F1 | `npm run test:f1`: 16 cenários aprovados, quatro combinações auth/reuniões × Orbe ligado/desligado × dois testes de módulos/capability. |
| Callback/navegação F1 | Na mesma execução: 13 cenários aprovados; cinco códigos permitidos, desconhecido/vazio/duplicado, redirects/navegação, Google permitido/recusado simulados e query sem poder de autenticação. |
| Total da suíte F1 | **29/29 aprovados**, aproximadamente dois minutos, somente APIs `.invalid` interceptadas. |
| Regressão geral/configuração e política de build | `npm test`: **163/163 aprovados**, aproximadamente 1,7 minuto; clientes, navegação auth, configuração/build em memória, rotas, temas, layouts, acessibilidade e seções. |
| Build isolado de main | `npm run build`: aprovado com destino de processo `main`, mock desativado e flags herdadas ligadas; guarda main força três flags falsas e URL vazia. Nenhuma troca de branch ou alteração de `.env`. |
| Regressão Fase 3 com mocks | `npm run test:phase3`: **56/56 aprovados**, aproximadamente 2,2 minutos; build e preview isolados com auth e reuniões ligados. |
| Regressão Orbe com mocks | `npm run test:orbe`: **22/22 aprovados**, aproximadamente 1,8 minuto; build e preview isolados com auth e reuniões desligados. |
| Total das quatro suítes | **163 + 29 + 56 + 22 = 270 testes aprovados**. |
| Integridade do diff | `git diff --check`: aprovado após as verificações. |
| Lint de código frontend | Não disponível: o projeto não possui script ou configuração de lint. TypeScript/Commitlint não substituem essa verificação. |

Comandos executados na validação: `npm run typecheck`, `npm run test:f1`,
`npm run build`, `npm test`, `npm run test:phase3`, `npm run test:orbe` e
`git diff --check`. Os três builds executam a checagem de tipos pelo próprio
script `build`. Uma duplicação de propriedade na configuração de F1 foi corrigida
durante a preparação, antes da bateria aprovada; não houve falha de produto nas
execuções finais registradas.

No build isolado, as variáveis foram fornecidas somente ao processo:
`GITHUB_REF_NAME=main`, `PHASSCODE_MOCK_API_BUILD=false`,
`VITE_ORBE_API_ENABLED=true`, `VITE_AUTH_ENABLED=true`,
`VITE_MEETINGS_ENABLED=true` e `VITE_API_BASE_URL=https://phase3-api.invalid`.
A URL sintética não habilitou a exceção porque o opt-in de mock estava falso.
O checkout continuou na branch `dev`; esse build local não promoveu ou publicou main.
Também foi confirmada a ausência da URL sintética candidata no JavaScript desse
build main.

Os outros dois builds foram iniciados pelos respectivos comandos de teste:

| Comando | Perfil e isolamento do build/preview |
| --- | --- |
| `npm run test:phase3` | `PHASSCODE_MOCK_API_BUILD=true`, Orbe/auth/reuniões `true`, API `https://phase3-api.invalid`; `dist-phase3-test`, porta 4176. |
| `npm run test:orbe` | `PHASSCODE_MOCK_API_BUILD=true`, Orbe `true`, auth/reuniões `false`, API `https://orbe-api.invalid`; `dist-orbe-test`, porta 4175. |

As URLs `.invalid` representam mocks, sem backend real. As portas e diretórios
diferentes permitem as duas suítes sem compartilhar o servidor ou artefato.

O script `npm run test:f1` e sua etapa no workflow foram preparados localmente,
sem acionar CI remota. A suíte usa oito perfis Vite nas portas 4180–4187 e API
`.invalid` interceptada; não confundir esses servidores com oito builds de
produção ou com o E2E real de B2/F3. Não foi introduzido linter ou dependência
para ampliar o escopo de F1.

## Inventário local de arquivos da entrega

Inventário do `git status --short` após a implementação e a bateria local:
**35 arquivos**, sendo 28 modificados e sete novos. Os arquivos são agrupados
abaixo para revisão; o inventário não representa commit ou publicação.

- **Aplicação e tipos (12):** `src/App.tsx`,
  `src/components/AdminDashboard.tsx`, `src/components/AuthCallbackNotice.tsx`
  (novo), `src/config/platform.ts`, `src/contexts/AuthContext.tsx`,
  `src/contexts/MeetingsContext.tsx`, `src/hooks/useOrbeChat.ts`, `src/main.tsx`,
  `src/services/authClient.ts`, `src/services/authNavigation.ts` (novo),
  `src/styles/auth_callback_notice.css` (novo) e `src/vite-env.d.ts`.
- **Configuração, build e automação (9):** `.env.example`,
  `.github/workflows/deploy.yml`, `package.json`, `playwright.config.ts`,
  `playwright.f1.config.ts` (novo), `playwright.orbe.config.ts`,
  `playwright.phase3.config.ts`, `scripts/orbe-build-policy.mjs` e `vite.config.ts`.
- **Testes (8):** `tests/auth-client.spec.ts`,
  `tests/auth-navigation.spec.ts` (novo), `tests/f1-ui.spec.ts` (novo),
  `tests/orbe-config.spec.ts`, `tests/orbe-diagnostics.spec.ts`,
  `tests/phase3-admin.spec.ts`, `tests/phase3-api.spec.ts` e
  `tests/phase3-config.spec.ts`.
- **Documentação (6):** `README.md`, `docs/admin-access-handoff.md`,
  `docs/orbe-api.md`, `docs/phase3-homologacao.md`,
  `docs/phase3-integracao.md` e `docs/f1-validacao-local.md` (novo).

A branch e o HEAD permaneceram `dev/75f47eb`. Nenhum commit, push, PR, workflow
remoto ou deploy foi executado nesta entrega. Não houve alteração de backend,
arquivos `.env` reais ou dados; `.env.example` documenta somente o contrato público
das flags.

## Limites que F1 não encerra

Coordenação de sessão entre abas e aviso persistente de logout não confirmado
continuam F2. E2E React + API + OIDC assinado local + PostgreSQL/Redis descartáveis
continua B2/F3. Uma suíte interceptada não comprova essa integração real.

O cliente mantém `credentials: include` e, nas mutações protegidas aplicáveis,
`X-CSRF-Token`, compatíveis com B1: cookie de sessão válido, `Origin` permitido e
CSRF continuam exigidos pela API para aprovar, rejeitar ou cancelar reuniões,
mesmo quando existe Bearer. `Origin` é um cabeçalho controlado pelo navegador,
sem poder de autenticação. Os mocks desta entrega não comprovam o E2E real desse
contrato nem sua configuração implantada.

Google/Calendar/SMTP/Telegram reais, publicação de artefatos, entrada pública de
agendamento independente da LLM e continuidade da primeira chamada pendente do
Orbe não são declarados concluídos por F1. A autoridade administrativa permanece
no backend; flags/query nunca concedem papel ou autenticam visitantes.

Referências: [integração Fase 3](phase3-integracao.md),
[roteiro de homologação](phase3-homologacao.md) e [Orbe](orbe-api.md).
