# Acesso exclusivo ao administrador

O proprietário definiu que o Google deve servir apenas à sua administração.
O baú não é um cadastro de visitantes nem uma entrada para agendamento.

## Implementado no frontend

- A página principal abre `/administracao` quando a sessão inicial tem papel
  `admin`. A volta ao portfólio continua disponível, sem redirecionamento em ciclo.
- O baú administrativo oferece entrada na sala e logout, além de fechar o modal.
- Solicitar reunião, atualizar sessão e renovar sessão foram retirados do baú.
  O cliente HTTP mantém a renovação necessária antes de operações próximas à expiração.
- Sessões com papel `user` não acessam a sala nem consultam a API administrativa;
  recebem aviso de falta de permissão e podem encerrar a sessão.
- Propostas de reunião pelo Orbe continuam com revisão e consentimento explícitos.

O frontend não contém e-mail permitido, senha, credencial OAuth ou regra que
conceda papel administrativo por comparação de e-mail.

## Incompatibilidade atual no backend

O [OpenAPI publicado](https://devapi.phasscode.com/api/v1/openapi.json), versão
`0.1.0`, fornece papéis na sessão, mas não oferece configuração pública de e-mail
permitido ou promoção administrativa. O proprietário confirmou que sua sessão
atual tem papel `user`; portanto, ainda será recusado pela rota administrativa.

Na branch `dev` consultada em 25/10/2026, o
[serviço de autenticação](https://github.com/SladeSouzaSantos/phasscode-platform/blob/dev/apps/orbe-node/src/auth/service.ts)
aceita a identidade verificada pelo Google e o
[repositório de usuários](https://github.com/SladeSouzaSantos/phasscode-platform/blob/dev/apps/orbe-node/src/auth/postgres.ts)
atribui `user` a novas contas. A
[configuração de autenticação](https://github.com/SladeSouzaSantos/phasscode-platform/blob/dev/packages/shared-config/src/auth.ts)
não define uma lista de e-mails autorizados. A leitura do código do repositório
não comprova que essa mesma revisão está publicada.

## Trabalho para a instância responsável pelo backend

1. Implementar uma política configurada somente no servidor que permita o e-mail
   verificado do proprietário e recuse outras identidades antes de criar usuário
   ou sessão. Definir comportamento seguro quando a configuração estiver ausente.
2. Tratar sessões já existentes conforme a nova política; esconder a sala no React
   não revoga cookies emitidos nem protege os endpoints por si só.
3. Conceder explicitamente o papel `admin` à identidade correta e manter a
   autorização desse papel em cada endpoint administrativo. Não promover o
   primeiro visitante nem confiar em um papel enviado pelo cliente.
4. Preservar o contrato de sessão, cookies HttpOnly, CSRF, expiração e logout.
   Informar qualquer mudança de contrato ou erro público necessário ao frontend.
5. Configurar e validar o destino de retorno por ambiente. `AUTH_FRONTEND_URL`
   pode apontar para `/administracao`; o frontend também trata o retorno à raiz.
   O callback Google continua no backend e o CORS recebe apenas a origem.
6. Testar com identidades simuladas: proprietário permitido com papel `admin`,
   outra conta verificada recusada, e-mail não verificado recusado e sessão legada
   sem permissão. Confirmar a revisão publicada antes de homologar com Google real.

O backend já documenta uma operação auditada de concessão de papel por UUID:
`npm run auth:admin -- grant UUID_DO_USUARIO`. Consulte o
[procedimento de operação](https://github.com/SladeSouzaSantos/phasscode-platform/blob/dev/docs/deployment/phase3.md)
no checkout e ambiente corretos. Esse comando não restringe o login de outras
contas; a política de e-mail é um requisito separado.

Nenhuma variável de allowlist foi inventada no frontend. Nenhuma mudança,
concessão de papel, chamada autenticada ou publicação foi executada no backend.
Após sua atualização, repetir o login do proprietário, a recusa de outra conta,
F5, logout e acesso direto à sala em DEV, com controle do proprietário.
