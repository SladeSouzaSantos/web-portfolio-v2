# OAuth do Tailscale no GitHub Actions

O workflow mantém os secrets existentes `SERVER_HOST`, `SERVER_USER`, `SSH_PRIVATE_KEY`, `GHCR_PULL_TOKEN` e `TAILSCALE_AUTHKEY`, além de `DEV_SITE_URL`. As actions Docker e de artefatos foram atualizadas para versões com runtime Node.js 24; isso é independente do Node.js 24 utilizado para compilar o projeto.

## Configuração externa necessária

1. No painel do Tailscale, crie ou escolha uma tag para os runners, por exemplo `tag:ci`, com os responsáveis definidos na política da tailnet.
2. Garanta que dispositivos com essa tag podem alcançar o endereço do servidor usado por `SERVER_HOST` na porta TCP 22. A conexão usa SSH tradicional; não é necessário habilitar Tailscale SSH para esse fluxo. Preserve as demais regras da sua rede.
3. Crie um cliente OAuth com permissão de escrita para **Auth Keys** (`auth_keys`) e autorização para essa tag. Guarde o ID e o segredo diretamente no gerenciador de secrets.
4. Em **GitHub → Settings → Secrets and variables → Actions**, cadastre os repository secrets `TAILSCALE_OAUTH_CLIENT_ID` e `TAILSCALE_OAUTH_SECRET`. Não salve esses valores em arquivos, commits ou mensagens.
5. Se a tag escolhida for diferente de `tag:ci`, configure a repository variable `TAILSCALE_TAGS`. Mais de uma tag usa separação por vírgula.
6. Execute o fluxo normalmente por um push autorizado para `dev`. Confirme que o passo **Connect with OAuth** concluiu e que o deploy e o smoke passaram. Depois de validar os ambientes que utilizam essa credencial, o secret antigo `TAILSCALE_AUTHKEY` pode ser removido e sua chave revogada no Tailscale.

As credenciais são lidas do GitHub Actions; não precisam ser enviadas pelo chat. [Configuração oficial da action](https://tailscale.com/docs/integrations/github/github-action), [clientes OAuth e escopos](https://tailscale.com/docs/features/oauth-clients).

## Comportamento durante a migração

A action local `.github/actions/tailscale-connect/action.yml` é usada pelo job de deploy, que acessa o servidor pela rede privada. O job `verify_deploy` acessa as URLs públicas pelo Cloudflare e não precisa se conectar ao Tailscale.

No job de deploy, a autenticação funciona assim:

- Ambos os secrets OAuth presentes: usa OAuth, sem fornecer `authkey` à action do Tailscale.
- Ambos ausentes: continua utilizando a authkey existente. O aviso de depreciação permanece até OAuth ser configurado.
- Apenas um secret OAuth presente: falha com instrução para completar o par.
- OAuth selecionado e autenticação ou permissões inválidas: falha. Não tenta novamente com a chave antiga, para não esconder um erro de configuração.

A edição do workflow não cria o cliente nem altera permissões da tailnet. A configuração externa precisa estar concluída para eliminar o aviso de authkey.

## Versões das actions

| Action | Versão anterior | Versão com Node 24 usada |
| --- | --- | --- |
| `actions/upload-artifact` | `v5` | `v6` |
| `actions/download-artifact` | `v5` | `v7` |
| `docker/setup-buildx-action` | `v3` | `v4` |
| `docker/login-action` | `v3` | `v4` |
| `docker/build-push-action` | `v6` | `v7` |

`download-artifact@v6` ainda usa Node 20; a migração desse runtime ocorre na `v7`. `checkout@v5`, `setup-node@v5`, `codeql-action@v4` e `tailscale/github-action@v4` já usam Node 24. A action SSH atual executa em Docker e foi preservada.

Referências dos mantenedores: [upload-artifact v6](https://github.com/actions/upload-artifact/releases/tag/v6.0.0), [download-artifact v7](https://github.com/actions/download-artifact/releases/tag/v7.0.0), [Docker build-push v7](https://github.com/docker/build-push-action/releases/tag/v7.0.0). Avisos de outras dependências precisam ser avaliados separadamente; o workflow não suprime avisos do Node.

## Mensagens de commit

O histórico usa Conventional Commits em português, com escopo opcional. Separe as mudanças dos testes das mudanças das actions:

```text
test: ampliar cobertura e adicionar smoke apos deploy
ci: atualizar actions e preparar OAuth do Tailscale
```

Uma divisão que mantém cada commit utilizável é colocar primeiro a suíte, suas configurações e as correções de acessibilidade; depois, a integração no workflow e a atualização das actions:

```powershell
git add package.json package-lock.json tsconfig.json playwright*.config.ts src tests docs/testes.md
git commit -m "test: ampliar cobertura e adicionar smoke apos deploy"

git add .github/workflows/deploy.yml .github/actions/tailscale-connect/action.yml README.md docs/tailscale-oauth.md
git commit -m "ci: atualizar actions e preparar OAuth do Tailscale"
```

O primeiro commit acrescenta os comandos de teste; o segundo os conecta à verificação após o deploy. O corpo, se houver, deve manter cada linha com até 100 caracteres.
