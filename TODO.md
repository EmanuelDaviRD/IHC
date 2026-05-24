# TODO - Ajustes Admin Auth e Banco

## Planejado / Aprovado
- [x] Atualizar `backend/config/db.js` para:
  - [x] Criar/garantir usuário admin padrão `admin@ihcstore.com` com senha `admin123` quando não existir.
  - [x] (Sem resetar) Se o admin já existir, não altera credenciais.
- [x] Atualizar `backend/server.js` e `backend/config/db.js` para:
  - [x] Validar `currentPassword` na rota `PUT /admin/change-password` antes de trocar a senha.
  - [x] Responder erro apropriado quando `currentPassword` estiver incorreta.
- [ ] Executar testes manuais:
  - [ ] Reiniciar o server.
  - [ ] Login admin com `admin@ihcstore.com` / `admin123`.
  - [ ] Testar troca de senha com senha atual errada (deve falhar).
  - [ ] Testar troca de senha com senha atual correta (deve atualizar).


