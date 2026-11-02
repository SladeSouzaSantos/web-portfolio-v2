# Homologação controlada da Fase 3

Frontend: `https://devgbc.phasscode.com`. API: `https://devapi.phasscode.com`.
Atualização documental F1: **26/10/2026**. O perfil de build DEV preparado por F1
é Orbe ligado, auth ligada e reuniões desligadas; isso não comprova publicação.
Este roteiro é para o proprietário; não foi executado automaticamente. Use
somente contas, convidados e destinatários de teste autorizados. As confirmações
e decisões abaixo podem criar eventos e enviar mensagens reais.

## Preparação

- Publicar primeiro a branch aprovada na `dev` pelo pipeline existente.
- Conferir revisão, artefato e flags do frontend entregue. Para login isolado,
  `VITE_AUTH_ENABLED=true` e `VITE_MEETINGS_ENABLED=false`; não exigir agenda ativa.
- Confirmar CORS com credenciais para a origem DEV e os headers da Fase 3.
- Usar a conta admitida pela política **admin-only** do backend e confirmar seu
  papel atual. O bootstrap restrito/auditado e a eventual recuperação de papel
  pertencem ao servidor; não colocar e-mail permitido ou regra de promoção no React.
- Para homologar somente login, o backend pode manter reuniões, Calendar,
  notificações e worker desligados. As seções de agenda/canais abaixo exigem
  habilitação deliberada e autorização própria, com janela/destinos de teste.
- Não copiar tokens/cookies para capturas, tickets, mensagens ou logs.

## Google e sessão

Para desenvolvimento com frontend e API locais, confira também `.env.local` na
raiz do frontend antes de iniciar o Vite:

```dotenv
VITE_ORBE_API_ENABLED=false
VITE_AUTH_ENABLED=true
VITE_MEETINGS_ENABLED=false
VITE_API_BASE_URL=http://localhost:3000
```

Esse exemplo pressupõe a API local na porta 3000. A configuração do backend não
habilita automaticamente as flags do frontend. `VITE_PHASE3_ENABLED` é ignorada,
sem fallback: migrar explicitamente para as duas novas flags. Sem auth habilitada,
o baú informa indisponibilidade e não consulta a sessão. Atualize a página
após o Vite recarregar as variáveis; se não houver recarga, reinicie `npm run dev`.
Não copie credenciais do backend para variáveis `VITE_*`.
Manter hostname/cookies e origem CORS compatíveis entre os serviços locais.
Os [quatro perfis de flags](phase3-integracao.md#ambientes-e-migração-das-flags)
incluem reuniões públicas com a UI de auth desligada; isso não desliga a auth
administrativa necessária no backend. Orbe é independente de todos os perfis.

Google depende das URLs, cookies e credenciais configurados no backend. Para a
homologação publicada, continue usando `devgbc.phasscode.com` e `devapi.phasscode.com`;
não relaxe CORS ou cookies para contornar diferenças entre as origens.

1. Abrir DEV anônimo. O baú deve estar fechado e o portfólio utilizável.
2. Abrir o baú; conferir acesso administrativo pelo Google, sem campos de senha
   nem opção de solicitar reunião.
3. Clicar **ENTRAR COM GOOGLE**. Conferir navegação pelo backend até Google e
   retorno ao frontend DEV. Com papel `admin`, a raiz simples pode abrir
   `/administracao`; um destino público permitido com query/fragmento deve ser
   preservado. Não deve haver tokens na URL do frontend.
4. Conferir sessão, nome e papel no baú aberto. `/auth/session` deve reconhecer
   cookies; o token CSRF não aparece na interface nem nos logs.
   No perfil somente login, a sala deve abrir sem consultar endpoints de reuniões;
   o chat não deve anunciar `X-Orbe-Capabilities: meetings-v1`.
5. Atualizar a página e visitar `/projetos`; a sessão deve ser consultada e
   permanecer disponível, sem armazenamento de credenciais pelo React.
6. Conferir que o menu autenticado oferece somente **IR PARA A SALA DO
   ADMINISTRADOR** e **TRANCAR BAÚ (LOGOUT)**. Voltar ao portfólio deve funcionar
   sem redirecionamento em ciclo; reabrir a sala pelo baú deve funcionar.
7. Efetuar logout e pressionar F5 antes de entrar novamente: a sessão deve
   permanecer encerrada. O baú deve voltar a oferecer Google.
8. Se ainda existir sessão com papel `user`, conferir aviso de falta de permissão,
   somente logout e redirecionamento ao abrir `/administracao` diretamente.
   No contrato admin-only adotado por F1, outra conta Google deve ser recusada
   antes da criação de sessão. Confirmar a revisão efetiva, sem promover pela UI.

Antes da homologação real, validar com respostas interceptadas: raiz e
`/administracao`, sucesso, conta recusada, cancelamento, indisponibilidade e
código desconhecido. `AUTH_ADMIN_ONLY` deve mostrar o texto constante “Acesso
negado. Apenas o administrador tem acesso.”. Os demais códigos permitidos são
`AUTH_REQUIRED`, `AUTH_LOGIN_FAILED`, `AUTH_PROVIDER_UNAVAILABLE` e
`AUTH_UNAVAILABLE`; valores desconhecidos recebem orientação genérica local.
Nenhum valor é interpretado como HTML ou autorização.

Conferir `returnTo` relativo quando enviado, remoção de `auth_error` por replace,
preservação dos demais parâmetros/fragmento pertinentes e confirmação da sessão
pela API. Não deve haver novo login ou repetição de mutação automáticos.
O parâmetro de retorno não concede papel e o callback OAuth permanece no backend.

F1 não inclui coordenação entre abas, correção do aviso de logout incerto ou
E2E React + API + OIDC real local: são F2 e B2/F3. Um teste mock aprovado não
substitui essas entregas nem comprova cookies/Google reais publicados.

## Agendamento público

Executar esta seção somente com reuniões explicitamente habilitadas no frontend
e no backend, dependências Calendar/worker/canais preparadas conforme o escopo
e autorização dos efeitos. O perfil DEV somente login não executa estes passos.
F1 não acrescenta entrada direta independente da LLM; o caminho existente é pelo Orbe.

9. Sair da sessão e abrir o Orbe. Com dados de teste autorizados, pedir uma proposta
   de reunião e abrir **REVISAR PROPOSTA DE REUNIÃO**. Essa pergunta consome cota
   de IA; limitar o teste. Usar **Alterar dados / novo horário** para abrir o
   formulário público, sem confirmar o pedido.
10. Escolher data e consultar disponibilidade. Conferir intervalo de até sete
    dias, horários reais, fuso retornado e ausência de simulação indevida.
11. Escolher um slot, informar nome/e-mail/assunto de teste e preparar proposta.
    Até aqui não deve existir solicitação criada nem evento confirmado.
12. Conferir o resumo retornado, validade e versão do consentimento. Sem marcar
    consentimento, a confirmação deve permanecer desabilitada.
13. Confirmar explicitamente uma única vez. Registrar apenas o ID público de
    suporte necessário, sem copiar `meetingToken` ou `confirmationToken`.
14. Conferir `PENDING`: enviado, sem reserva garantida. Atualizar o estado
    manualmente; fechar/reabrir deve preservar o acompanhamento na mesma página.
15. Conferir a limitação ao recarregar: o token em memória é perdido; não deve
    aparecer promessa de recuperar acompanhamento por e-mail.

## Administração e integrações externas

Esta seção também pressupõe reuniões habilitadas e autorização específica.
Na sala somente login, agenda indisponível sem fetch é o resultado correto.

16. Entrar com a conta autorizada `admin`, conferir abertura automática da sala e
    listagem, filtros, campos, cursor e ausência de paginação numérica fictícia.
    Conferir as seções **REGISTROS DO ORBE** e **AGENDA E PEDIDOS**. Enquanto não
    houver contrato de relatórios, os indicadores do Orbe mostram **Aguardando
    dados**, sem zeros inventados. O resumo da agenda considera apenas pedidos
    carregados e informa quando há outra página. Busca e ordenação são locais.
17. Selecionar um pedido de teste. Abrir a confirmação e voltar sem decidir:
    nenhuma mutação ou notificação deve ocorrer.
18. Aprovar explicitamente. `APPROVED` deve continuar distinto de `CONFIRMED`.
    Atualizar manualmente e conferir a transição assíncrona real.
19. Verificar no Calendar o evento correspondente e os destinos autorizados no
    SMTP e Telegram, utilizando as evidências do backend. O frontend não afirma
    aceite do convidado nem existência de videoconferência sem confirmação.
20. Com outros pedidos autorizados, testar rejeição e cancelamento explícitos.
    Conferir estados e auditoria; cancelamento registrado pode preceder a
    conclusão da limpeza externa. Não repetir operações reais desnecessariamente.
21. Testar sessão expirada, ausência de papel e conflito de estado com cenários
    controlados. Uma falha de rede/timeout não prova que a decisão não ocorreu:
    conferir estado/auditoria antes de escolher reenviar.

## Orbe e interface

22. Conversar normalmente com o Orbe, preservando histórico, fontes e tema.
    Fechar e reabrir mantém a mesma conversa; F5 descarta o histórico local e a
    próxima mensagem inicia outra. Não deve haver botão **NOVA CONVERSA**.
    Essas perguntas consomem a cota real de IA; limitar o teste.
23. Solicitar ajuda com uma reunião usando apenas dados de teste autorizados.
    A proposta deve aparecer como ação para revisão; chegar a resposta não
    confirma solicitação nem dispara aprovação/notificação.
24. Abrir a revisão, conferir os dados e voltar sem confirmar. Só criar um
    novo pedido se realmente necessário ao roteiro e com consentimento explícito.
25. Validar em 320, 375, 768 e 1440 px, nos dois temas: sem rolagem horizontal,
    conteúdo do modal acessível, labels, mensagens, teclado, Tab/Shift+Tab,
    Escape, restauração de foco e preferência de movimento reduzido.
26. Conferir o site produtivo separadamente: Orbe demonstrativo, auth e reuniões
    indisponíveis pelo build `main`, URL vazia e nenhuma requisição para `devapi`.
    Isso não informa as flags privadas efetivas do backend PROD.

## Evidências e encerramento

Anotar a release DEV testada, resultados e correlationIds públicos quando houver
falha. Não anexar headers de cookies/CSRF, dados pessoais de terceiros ou tokens
privados. Distinguir testes simulados de operações reais e marcar pendências.
A promoção para produção exige autorização própria; este roteiro não a concede.
Resultados anteriores a F1 permanecem históricos. A execução local desta revisão
é registrada em [f1-validacao-local.md](f1-validacao-local.md); este roteiro não
declara que publicação ou homologação externa tenham ocorrido.
