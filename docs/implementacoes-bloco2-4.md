# Implementações — Blocos 2, 3 e 4

## Server (`recomenda-server`)

### Hash de senha no convite (`invitations.service.ts`)
`acceptByToken` agora usa `argon2.hash()` antes de salvar o usuário. Antes salvava a senha em texto plano.

### Hash de senha no onboarding de agrônomo (`admin-agronomists.service.ts`)
`create` recebe `{ user: { ..., password } }`, extrai a senha, gera hash com `argon2.hash()` e salva `password_hash`. Antes não havia hash.

---

## Frontend (`recomenda-web`)

### Invite page (`/invite/[token]`)
- Busca o convite pelo token via `GET /invitations/by-token/:token`
- Exibe erro se inválido/expirado/já aceito
- Formulário: nome, e-mail (read-only, vem do convite), senha, confirmação de senha
- Submit chama `POST /invitations/by-token/:token/accept` e redireciona para `/login`

### Admin — Agrônomos (`/admin/agronomists`)
- Lista de agrônomos via `GET /admin/agronomists`
- Formulário inline para criar novo agrônomo: nome, e-mail, senha, seleção de plano
- Planos carregados via `GET /plans`

### Farms — Lista (`/farms`)
- Adicionado formulário inline para criar nova fazenda via `POST /farms`

### Farms — Detalhe (`/farms/[id]`)
- Seção **Talhões**: lista via `GET /farms/:id/plots`, adicionar via `POST /farms/:id/plots` (nome + área em ha), remover via `DELETE /plots/:id`
- Seção **Acesso de Produtores**: lista via `GET /farms/:id/access`, conceder via `POST /farms/:id/access`, revogar via `DELETE /farms/:id/access/:producer_id`
- Select de produtores disponíveis filtra os que já têm acesso

### Season Detail (`/seasons/[id]`)
- **Timeline**: lista de recomendações com status colorido, datas previstas e executadas
- **Shopping List**: tabela via `GET /seasons/:id/shopping_list` — produto + quantidade total necessária
- **Stock**: carrega o `producer_id` da safra via `GET /seasons/:id`, depois busca estoque via `GET /producers/:id/stock`
- **Auditoria**: placeholder (disponível em breve)

### Novos hooks e funções de API
Adicionados em `lib/api/client.ts` e `lib/api/hooks.ts`:
- `getInvitationByToken` / `acceptInvitation` → `useInvitationByToken`, `useAcceptInvitation`
- `getPlans` → `usePlans`
- `getAdminAgronomists` / `createAdminAgronomist` → `useAdminAgronomists`, `useCreateAdminAgronomist`
- `getFarmPlots` / `createPlot` / `deletePlot` → `useFarmPlots`, `useCreatePlot`, `useDeletePlot`
- `getFarmAccess` / `grantFarmAccess` / `revokeFarmAccess` → `useFarmAccess`, `useGrantFarmAccess`, `useRevokeFarmAccess`
- `createFarm` → `useCreateFarm`
- `getSeasonShoppingList` → `useSeasonShoppingList`
- `getSeason` → `useSeason`
- `getProducerStock` → `useProducerStock`

---

## O que ainda falta (do plano original)

| Item | Status |
|---|---|
| Season Wizard end-to-end | Existe (74 linhas) — precisa teste manual |
| Producers detail (editar perfil, impersonation) | Stub ainda |
| Admin Plans page | Stub ainda |
| Reports com gráficos (recharts) | Stub ainda |
| Audit Log gravando ações | Backend tem `AuditService.write()` mas nenhum módulo chama |
| OpenAPI spec no server | Não configurado |
