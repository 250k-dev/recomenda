# Plano de Implementação — Recomenda Web + Server

Levantamento do estado atual e o que falta para o produto ficar funcional.

**Legenda:** ✅ Implementado · ⚠️ Parcial/stub · ❌ Faltando

---

## Backend (`recomenda-server`)

| Módulo | Status | O que falta |
|---|---|---|
| Auth — login, refresh, impersonate, me | ✅ | — |
| Auth — register-producer, logout, forgot/reset-password | ⚠️ | Stubs retornam `{ ok: true }` sem lógica real |
| Farms — list, create, get | ⚠️ | Falta DELETE farm, plots CRUD completo, `GET /farms/:id/access`, `POST/DELETE /farms/:id/access/:producer_id` |
| Invitations | ⚠️ | Aceite salva senha em texto plano (sem hash); falta lógica real no `resend` |
| Catalog — global + local GET | ⚠️ | Falta `POST/PATCH /catalog/global` (admin), `POST /catalog/local/from-global/:id` |
| Timing Templates | ✅ | CRUD + stages + reorder implementados |
| Mix Templates | ✅ | CRUD + items implementados |
| Seasons | ✅ | Create, publish, archive, shopping list, timeline implementados |
| Recommendations | ✅ | Apply, skip, undo, substitute, cascade de datas implementados |
| Stock | ✅ | Adjusts e movements implementados |
| Producers | ⚠️ | List/get/update OK; falta expor `GET /producers/:id/stock` e `/purchases` no controller |
| Purchases | ✅ | CRUD + reversão de stock implementados |
| Harvest | ✅ | Registro + relatório de safra implementados |
| Reports | ⚠️ | Só retorna contagem básica — falta custo/ha, produtividade, comparativo planejado vs executado |
| Admin Agronomists | ⚠️ | GET list/get OK; falta POST (onboarding) e PATCH |
| Notifications | ⚠️ | CRUD OK; **nenhum evento dispara notificação** (publicar safra, aplicar recomendação, etc.) |
| Audit Log | ⚠️ | Entidade existe; **nenhuma action grava audit log** |
| OpenAPI (`/api/v1/openapi.json`) | ❌ | Não configurado — necessário para `codegen` do frontend |

---

## Frontend (`recomenda-web`)

| Tela / Funcionalidade | Status | O que falta |
|---|---|---|
| Login | ✅ | Funcional e conectado à API |
| Forgot / Reset password | ⚠️ | Página existe mas sem formulário real |
| Invite (`/invite/[token]`) | ⚠️ | Só exibe o token; falta formulário de aceite com nome + senha |
| Middleware de autenticação | ❌ | Arquivo `middleware.ts` não existe — qualquer URL é acessível sem login |
| Dashboard (Agronomista) | ⚠️ | 3 KPIs básicos; falta "upcoming applications", "late recommendations", "recent activity" |
| Farms | ⚠️ | Lista funcionando; falta criar farm, detail com plots, gerenciar acesso de produtores |
| Producers | ⚠️ | Lista funcionando; falta detail, editar perfil, gerenciar acesso a fazendas, botão "Acessar como produtor" |
| Catálogo local | ⚠️ | Lista funcionando; falta criar produto customizado, clonar do global, editar preço |
| Timing Templates | ❌ | Stub estático — falta lista real, editor com drag-to-reorder, criação de estágios |
| Mix Templates | ❌ | Stub estático — falta lista real, editor de itens, preview de dose por área |
| Seasons — lista | ⚠️ | Lista simples; falta filtros e navegação para detail |
| Season Wizard (`/seasons/new`) | ⚠️ | Wizard de 3 etapas existe; precisa validar se os steps funcionam end-to-end |
| Season Detail | ⚠️ | Aba Timeline exibe JSON bruto; Stock, Shopping List, Audit são stubs |
| Admin — Planos | ❌ | Stub estático |
| Admin — Agrônomos | ❌ | Stub estático |
| Admin — Catálogo global | ✅ | Lista conectada à API |
| Topbar (notificações, quota badge) | ⚠️ | Componente existe; falta conectar aos hooks de notifications e quota |
| Impersonation banner | ⚠️ | Componente + zustand store existe; falta validar integração completa |
| Reports | ⚠️ | Página existe; falta gráficos (recharts) e filtros reais |

---

## Prioridade sugerida para "funcional mínimo"

### Bloco 1 — Infraestrutura (sem isso nada funciona direito)
1. **Middleware de auth no Next.js** — sem ele qualquer rota é pública
2. **OpenAPI no server** — permite `codegen` de tipos no frontend

### Bloco 2 — Onboarding de usuários
3. **Admin: onboarding de agrônomo** (`POST /admin/agronomists` + tela)
4. **Invite page completa** — formulário de aceite com nome + senha + hash real no server

### Bloco 3 — Configuração (pré-requisito para criar safra)
5. **Timing Templates editor** — lista real + criação de estágios + reorder
6. **Mix Templates editor** — lista real + itens + preview de dose/área

### Bloco 4 — Fluxo principal
7. **Season Wizard end-to-end** — validar/corrigir os 3 steps
8. **Season Detail** — Stock e Shopping List funcionais
9. **Farms detail** — plots e acesso de produtores

### Bloco 5 — Observabilidade e confiabilidade
10. **Notificações disparadas no backend** — eventos: publicar safra, aplicar recomendação, colheita
11. **Audit Log gravando ações** — todas as mutations relevantes
12. **Reports completos** — custo/ha, produtividade, gráficos no frontend
