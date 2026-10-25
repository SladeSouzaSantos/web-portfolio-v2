# Homologação controlada da Fase 3

Frontend: `https://devgbc.phasscode.com`. API: `https://devapi.phasscode.com`.
Este roteiro é para o proprietário; não foi executado automaticamente. Use
somente contas, convidados e destinatários de teste autorizados. As confirmações
e decisões abaixo podem criar eventos e enviar mensagens reais.

## Preparação

- Publicar primeiro a branch aprovada na `dev` pelo pipeline existente.
- Conferir que o frontend entregue é o artefato aprovado, com Fase 3 habilitada.
- Confirmar CORS com credenciais para a origem DEV e os headers da Fase 3.
- Usar a conta Google do proprietário com papel `admin`, concedido pelo operador
  no backend. A restrição do login a esse e-mail ainda depende da
  [política de acesso no backend](admin-access-handoff.md).
- Preparar uma janela/horário e destinos Calendar/SMTP/Telegram autorizados.
- Não copiar tokens/cookies para capturas, tickets, mensagens ou logs.

## Google e sessão

Para desenvolvimento com frontend e API locais, confira também `.env.local` na
raiz do frontend antes de iniciar o Vite:

```dotenv
VITE_ORBE_API_ENABLED=true
VITE_PHASE3_ENABLED=true
VITE_API_BASE_URL=http://localhost:3000
```

Esse exemplo pressupõe a API local na porta 3000. A configuração do backend não
habilita automaticamente as flags do frontend. Se `VITE_PHASE3_ENABLED` estiver
ausente, o baú informa indisponibilidade e não consulta a sessão. Atualize a página
após o Vite recarregar as variáveis; se não houver recarga, reinicie `npm run dev`.
Não copie credenciais do backend para variáveis `VITE_*`.

Google depende das URLs, cookies e credenciais configurados no backend. Para a
homologação publicada, continue usando `devgbc.phasscode.com` e `devapi.phasscode.com`;
não relaxe CORS ou cookies para contornar diferenças entre as origens.

1. Abrir DEV anônimo. O baú deve estar fechado e o portfólio utilizável.
2. Abrir o baú; conferir acesso administrativo pelo Google, sem campos de senha
   nem opção de solicitar reunião.
3. Clicar **ENTRAR COM GOOGLE**. Conferir navegação pelo backend até Google e
   retorno ao frontend DEV e abertura de `/administracao` quando o papel for
   `admin`. Não deve haver tokens na URL do frontend.
4. Conferir sessão, nome e papel no baú aberto. `/auth/session` deve reconhecer
   cookies; o token CSRF não aparece na interface nem nos logs.
5. Atualizar a página e visitar `/projetos`; a sessão deve ser consultada e
   permanecer disponível, sem armazenamento de credenciais pelo React.
6. Conferir que o menu autenticado oferece somente **IR PARA A SALA DO
   ADMINISTRADOR** e **TRANCAR BAÚ (LOGOUT)**. Voltar ao portfólio deve funcionar
   sem redirecionamento em ciclo; reabrir a sala pelo baú deve funcionar.
7. Efetuar logout e pressionar F5 antes de entrar novamente: a sessão deve
   permanecer encerrada. O baú deve voltar a oferecer Google.
8. Se ainda existir sessão com papel `user`, conferir aviso de falta de permissão,
   somente logout e redirecionamento ao abrir `/administracao` diretamente.
   Depois da política restritiva publicada no backend, outra conta Google deve
   ser recusada antes da criação de sessão. Não promover a conta pelo frontend.

## Agendamento público

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
26. Conferir o site produtivo separadamente: Orbe demonstrativo, Fase 3
    indisponível e nenhuma requisição para `devapi.phasscode.com`.

## Evidências e encerramento

Anotar a release DEV testada, resultados e correlationIds públicos quando houver
falha. Não anexar headers de cookies/CSRF, dados pessoais de terceiros ou tokens
privados. Distinguir testes simulados de operações reais e marcar pendências.
A promoção para produção exige autorização própria; este roteiro não a concede.
