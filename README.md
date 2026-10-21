# PHASSCODE — portfólio RPG

Portfólio de Pedro Santos em React, TypeScript e Vite. A interface preserva a identidade em pixel art da versão estática: Taverna, Guilda de Projetos, Crônicas da Jornada e Academia Arcana. As animações usam GSAP/ScrollTrigger e canvas, com limpeza ao trocar de seção e suporte à preferência de movimento reduzido.

## Executar localmente

Requer Node.js **22.12 ou superior** e npm. A integração contínua usa Node.js 24.

```sh
npm ci
npm run dev
```

Abra o endereço informado pelo Vite. A aplicação precisa do servidor de desenvolvimento ou de uma publicação do build; abrir `index.html` diretamente pelo sistema de arquivos não executa o TypeScript.

```sh
npm run typecheck  # Verifica os tipos sem gerar arquivos
npm run build      # Verifica tipos e gera dist/
npm run preview    # Serve o build localmente
```

## Testes de navegação e interface

Os testes Playwright executam contra o build de produção e iniciam o servidor de preview automaticamente. Gere novamente o build depois de alterar o código.

```sh
npm run build
npx playwright install chromium
npm test
```

No Windows, a configuração utiliza o Microsoft Edge instalado. Nos demais sistemas, utiliza o Chromium do Playwright. No Linux da CI, a instalação inclui as dependências do navegador com `npx playwright install --with-deps chromium`.

## Organização

```text
src/
├── App.tsx                 # Rotas e composição da aplicação
├── components/             # Navbar, modal, tema, baú e orbe
├── sections/               # Sobre, Projetos, Experiência, Formação e Arquivo
├── data/                   # Catálogos editáveis e informações do perfil
├── effects/                # Desenho e interação do orbe em canvas
├── hooks/                  # Navegação, tema, media queries e fundos
├── lib/                    # Resolução de URLs dos assets
├── styles/                 # CSS original e ajustes da aplicação
└── types/                  # Contratos dos dados do portfólio
public/assets/img/          # Imagens e símbolos SVG
tests/                      # Testes Playwright
```

Para editar conteúdo, comece por `src/data/perfil.ts`, `projetos.ts`, `experiencias.ts` e `formacoes.ts`. A seção inicial de projetos e o Arquivo de Missões compartilham o mesmo catálogo. Os registros de experiência, formação e trilhas mantêm o conteúdo e as datas da versão anterior, incluindo situações provisórias que precisam de revisão editorial antes da publicação.

O baú mantém uma **simulação de login em memória** para demonstrar a interface. Nenhuma credencial é enviada ou autenticada. O orbe é um **guia com respostas predefinidas**, sem integração com um modelo de IA ou serviço externo. O site permanece um front-end estático, sem backend, banco de dados ou área administrativa real.

## Rotas e navegação

- `/`: página principal.
- `/#sobre`, `/#projetos`, `/#experiencia` e `/#academico`: seções da página principal, com suporte ao histórico do navegador.
- `/#portfolio` e `/#formacao`: aliases para Projetos e Formação.
- `/projetos`: Arquivo de Missões com filtros e detalhes dos projetos.
- `/index.html` e `/projetos.html`: endereços antigos, redirecionados para `/` e `/projetos`, respectivamente, preservando os parâmetros de consulta e o fragmento.

O React Router usa `BrowserRouter` para navegar entre a página principal e o catálogo sem recarregar o documento. O `index.html` é a única entrada do Vite, e o build gera apenas esse HTML em `dist/`. Para publicar, sirva **o conteúdo de `dist/`** e configure o servidor para retornar `index.html` nas rotas da aplicação. Esse fallback permite abrir `/projetos` diretamente ou atualizar a página nessa rota. A configuração atual assume publicação na raiz do domínio; publicar em um subdiretório exige revisar `base` do Vite, o roteador e as URLs absolutas das imagens no CSS.

## Nginx e publicação

O `nginx.conf` aponta a produção para `/opt/projects/web-portfolio-v2/dist`. Um exemplo equivalente é:

```nginx
server {
    listen 80;
    server_name portfolio.exemplo.com;
    root /opt/projects/web-portfolio-v2/dist;
    index index.html;

    location = /projetos.html {
        return 301 /projetos$is_args$args;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /assets/ {
        try_files $uri =404;
    }
}
```

Para homologação, configure um domínio próprio e use `/opt/projects/web-portfolio-v2-dev/dist`. Se o Nginx executar em Docker, monte o diretório do projeto inteiro no mesmo caminho absoluto do host, ou ajuste a estratégia de links: o contêiner precisa conseguir resolver tanto `dist` quanto os diretórios `.releases` para os quais ele aponta. Montar apenas o destino atual de `dist` impede que futuras trocas de symlink sejam acompanhadas pelo contêiner.

O workflow `.github/workflows/deploy.yml` instala dependências com `npm ci`, valida Conventional Commits, verifica tipos, gera o build, executa testes de navegador e guarda o artefato `dist`. Em pushes para `main` e `dev`, ele envia esse mesmo artefato por SCP via Tailscale para uma nova pasta `.releases/<commit>-<execução>/dist` no servidor. Em seguida, atualiza o checkout com `git pull --ff-only`, valida o Nginx e troca o symlink `dist` para a release enviada. O servidor não precisa executar npm ou compilar o front-end. O healthcheck público é executado apenas para produção.

O ambiente existente precisa manter os secrets de conexão Tailscale/SSH configurados no GitHub Actions e o checkout de cada ambiente na branch correspondente. O usuário SSH precisa escrever no diretório do projeto e executar o Docker Compose do proxy. A validação recusa misturar um artefato antigo com um checkout mais novo.

Na primeira publicação, `dist` deve estar ausente ou já ser um symlink. Caso exista como diretório físico, mova o build existente para uma pasta de release e crie o link durante a preparação do servidor. O workflow recusa substituí-lo automaticamente. As releases anteriores são mantidas para permitir retorno manual; sua retenção deve ser administrada no servidor. Nenhuma configuração, execução ou publicação no servidor é realizada apenas por editar esses arquivos localmente.
