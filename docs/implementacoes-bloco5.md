# Implementações — Bloco 5

## Server (`recomenda-server`)

### Reports melhorado (`reports.service.ts` + `reports.module.ts`)
`GET /agronomists/me/reports` agora retorna dados reais em vez de contagens simples:

**`summary`**: total de safras, colhidas, em andamento, taxa de conformidade (aplicadas / total não-pendentes).

**`per_season`** (apenas safras com status `HARVESTED`): custo/ha em BRL calculado multiplicando dose × área × preço do produto local, sacas/ha, preço de venda por saca. Entidades adicionadas ao módulo: `PlotEntity`, `RecommendationEntity`, `RecommendationItemEntity`, `LocalProductEntity`.

### Audit Log wiring
`AuditModule` importado em `SeasonsModule`, `RecommendationsModule` e `HarvestModule`. `AuditService` injetado nas três services.

Actions que agora gravam audit log:
| Action | Módulo |
|---|---|
| `season.published` | SeasonsService.publish |
| `recommendation.applied` | RecommendationsService.apply |
| `recommendation.skipped` | RecommendationsService.skip |
| `harvest.registered` | HarvestService.register |

---

## Frontend (`recomenda-web`)

### Producers — Lista (`/producers`)
Nome agora é link para o detalhe. Botão "Acessar como produtor" mantido com variante `secondary`.

### Producers — Detalhe (`/producers/[id]`)
- Dados do produtor (nome, e-mail, ID) via `GET /producers/:id`
- Estoque atual via `GET /producers/:id/stock`
- Botão "Acessar como produtor" (impersonation) no header da página
- Convertido de Server Component para Client Component

### Admin Plans (`/admin/plans`)
Lista de planos via `GET /plans` com colunas: nome, quota de talhões, preço mensal, status.

### Reports (`/reports`)
Conectado ao endpoint real `GET /agronomists/me/reports`.

- **KPI cards**: total de safras, colhidas, em andamento, taxa de conformidade
- **Gráfico de custo/ha**: BarChart (recharts) por safra
- **Gráfico de produtividade**: BarChart sc/ha por safra
- **Tabela comparativa**: todas as safras colhidas com métricas
- Recharts carregado com `next/dynamic` (sem SSR) para evitar erros de hidratação

### Novos hooks e funções de API
- `getComparativeReport` → `useComparativeReport`
- `getProducer` → `useProducer`

---

## Estado final do plano

| Item | Status |
|---|---|
| Middleware de auth | ✅ |
| OpenAPI spec no server | ❌ (não configurado) |
| Admin onboarding de agrônomo | ✅ |
| Invite page completa + hash de senha | ✅ |
| Timing Templates editor | ✅ |
| Mix Templates editor | ✅ |
| Season Wizard (`/seasons/new`) | ⚠️ Existe — precisa teste manual end-to-end |
| Season Detail (Timeline, Shopping List, Stock) | ✅ |
| Farms — criar + detalhe com plots e acesso | ✅ |
| Notifications disparadas | ✅ (já estava implementado) |
| Audit Log gravando ações | ✅ |
| Reports com gráficos e API real | ✅ |
| Producers detail | ✅ |
| Admin Plans | ✅ |
