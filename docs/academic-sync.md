# Sincronização acadêmica (frontend DEV)

O backend PHASSCODE `dev/knowledge/ppks/academic` mantém o modelo canônico de formações e cursos. O frontend consome um **snapshot público, versionado** em `src/data/ppks-academic.snapshot.json` e preserva os estilos e componentes da Academia Arcana.

Para atualizar após modificações no backend:

```sh
npm run sync:academic
npm run build
npx playwright test tests/formacao-cursos.spec.ts
```

O script falha se a origem estiver inacessível ou se o contrato não corresponder ao esperado. Confirme o diff do snapshot antes de publicar. A sincronização não inclui arquivos pessoais, documentos, dados escolares identificáveis ou PDFs.

O estado UNISUL é `pending_completion`, previsão estimada para o final de 2027/início de 2028. O diploma de Gestão da TI tem emissor ETEP e referência UNIBF usada no portfólio.

O snapshot é deliberadamente estático e **não** faz chamadas remotas ao renderizar a página. Para automatizar a atualização em CI, execute o comando no pipeline de publicação DEV e só promova a alteração após os testes. Não sincronizar automaticamente `main`.
