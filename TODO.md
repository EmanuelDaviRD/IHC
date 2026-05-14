- [ ] Entender/alinhar mudança: remover MongoDB mas manter endpoints e telas.
- [ ] Criar uma camada “storage local” (JSON em disco) para: products/users/orders/settings.
- [ ] Substituir no backend as rotas que usam Mongoose por leitura/escrita no JSON local.
- [ ] Manter autenticação JWT (login/register) funcionando sem banco.
- [ ] Manter painel admin: CRUD de produtos, lista/remover pedidos, atualizar status.
- [ ] Trocar /settings para persistir em JSON local.
- [ ] Seed inicial: inserir ~10 produtos (com links de imagem) quando o JSON estiver vazio.
- [ ] Rodar o servidor e testar manualmente: /loja carrega produtos; /admin cria/edita/remove; status de pedidos.
- [ ] Remover/neutralizar conexões com MongoDB e dependência do Mongoose no runtime.

