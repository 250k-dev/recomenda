# Web Frontend Context

> Read together with: `00-product-overview.md`, `01-domain-model.md`, `02-business-rules.md`, `03-api-contract.md`.

## Audience

Web app is used by **Admins** and **Agronomists**. Producers use mobile only. The web app is configuration- and dashboard-heavy: catalogs, templates, season setup, reports.

## Stack

- **Framework**: Next.js 14+ (App Router).
- **Language**: TypeScript (strict).
- **Styling**: Tailwind CSS + `shadcn/ui` (Radix primitives).
- **Forms**: `react-hook-form` + `zod` for schema validation.
- **Data fetching**: TanStack Query (React Query) on the client; server components for read-only initial loads when applicable.
- **HTTP client**: native `fetch` wrapped in a typed client generated from the backend's OpenAPI spec via `openapi-typescript` + a thin wrapper.
- **State**: TanStack Query for server state; `zustand` for any cross-page client state (e.g., active impersonation banner). No Redux.
- **Date handling**: `date-fns` + `date-fns-tz`. Display dates in `America/Sao_Paulo`.
- **i18n**: `next-intl`. UI strings are in Portuguese. Internal code/keys in English.
- **Icons**: `lucide-react`.
- **Charts**: `recharts` for reports.
- **Tables**: `@tanstack/react-table` for any data grid (catalog, seasons, audit logs).
- **Auth storage**: HTTP-only cookies for refresh token; access token in memory + short-lived cookie.
- **Testing**: Vitest + React Testing Library; Playwright for e2e on critical flows.

## Project structure

```
src/
  app/
    (public)/
      login/
      forgot-password/
      reset-password/
      invite/[token]/
    (admin)/
      admin/
        plans/
        agronomists/
        global-catalog/
    (agronomist)/
      dashboard/
      farms/
      farms/[id]/
      farms/[id]/plots/
      producers/
      producers/[id]/
      catalog/
      timing-templates/
      timing-templates/[id]/
      mix-templates/
      mix-templates/[id]/
      seasons/
      seasons/[id]/
      seasons/new/
      reports/
      settings/
      plan/
    layout.tsx
    page.tsx
  components/
    ui/                    # shadcn primitives (button, dialog, table, etc.)
    layout/                # AppShell, Sidebar, Topbar, ImpersonationBanner
    forms/                 # composed form components
    data/                  # data display (Table, KPI, Timeline)
    domain/                # domain-aware components (RecommendationCard, ShoppingListTable, StockBadge)
  lib/
    api/
      client.ts            # typed fetch wrapper
      generated.ts         # generated from OpenAPI
      hooks.ts             # React Query hooks per endpoint
    auth/
      session.ts           # server-side session helpers
      use-session.ts       # client hook
    utils/
      dates.ts
      money.ts
      cn.ts
  config/
    env.ts                 # validated public/private env
    nav.ts                 # sidebar config per role
  styles/
    globals.css
  middleware.ts            # auth + role redirects
```

## Routing and access

Next.js middleware (`middleware.ts`) reads the session cookie and:
- Redirects unauthenticated users to `/login`, except for `/invite/[token]`, `/forgot-password`, `/reset-password`.
- Sends ADMIN to `/admin`, AGRONOMIST to `/dashboard` after login.
- Blocks PRODUCER role at the web entrance with a "Use the mobile app" page (rare — they may attempt).

## UI conventions

### Layout
- Persistent left sidebar with role-specific nav items.
- Top bar: workspace name, plan badge with quota usage, notifications bell, user menu.
- When in impersonation mode, a yellow sticky banner above the top bar: "Acting as <Producer Name>" + Exit button.

### Design tokens
Use shadcn defaults. Brand color: green (agriculture). Single Tailwind theme (light + dark via class strategy). Avoid custom one-off colors.

### Tables
Always: search, filter, paginate. Sticky header. Empty states with CTA.

### Forms
- Group related fields in `<Card>`. Submit buttons fixed at bottom-right of the form section.
- Async validation only when necessary. Inline validation messages, never alerts.
- Confirmation dialogs (`AlertDialog`) for destructive actions: delete, archive, undo recommendation.

### Toasts
Mutations success → toast. Errors handled by global error boundary in queries; show toast with error message from API.

## Key screens

### Dashboard (Agronomist)
- KPI row: active plots / quota, producers count, seasons in progress.
- "Upcoming applications this week" — list across all seasons, sorted by date.
- "Late recommendations" — list with quick-jump links.
- "Recent producer activity" — substitutions, applications, harvests.

### Catalog (Local)
- Tab: "From global" (auto-resolved from references) / "Custom" / "All".
- Each row: name, category, dose unit, price BRL/USD, label link, edit.
- "Customize from global" action clones a global product into local for price/label edits.

### Timing Template Editor
- Header: name + crop selector.
- Body: ordered list of TimingStages, drag-to-reorder.
- Each stage: name, trigger select, window inputs (start/end days), default mix selector (with "create mix from this stage" shortcut).

### Mix Template Editor
- Header: name + crop applicability.
- Body: items table (product autocomplete from local catalog, dose input, unit display).
- Right panel: live preview "for a 100ha plot, this mix totals: X liters of A, Y kg of B".

### Season Wizard (`/seasons/new`)
Three-step wizard:
1. **Plot & basics** — select farm → plot, producer (must have access), crop, variety, cycle days, desiccation date.
2. **Timing & mixes** — select timing template, then per-stage mix override + dates preview.
3. **Initial stock** (optional) — pre-load producer stock per product appearing across all stages. Then "Save as draft" or "Publish".

Quota check on Publish click. If at limit, show modal with upgrade CTA.

### Season Detail
- Header: plot name, area, producer, crop, status badge.
- Tab: Timeline / Stock / Shopping List / Audit.
- Timeline: vertical list of recommendations. Each card shows status, predicted dates (original struck if changed), executed date, items with substitution markers.
- Edit pending recommendation in a side panel (not navigation).

### Producer Management
- List with avatar, name, email, farms granted, last activity.
- Detail: edit profile, manage farm access (multi-select with chips), invitation status, "Access as producer" button.

### Reports
- Filters: producer, farm, crop, season range.
- Charts: cost per ha, productivity per ha, planned vs executed compliance %.
- Drill-down: click bar → season detail.

### Plan & Quota
- Current plan card.
- Quota usage chart (active plots vs limit).
- List of historical seasons with status.

## API integration

- Generate types from `/api/v1/openapi.json` at build time and on `npm run codegen`.
- Each backend resource gets a hook file: `useFarms`, `useFarm`, `useCreateFarm`, etc.
- Mutations invalidate related queries.
- All hooks return discriminated `{ data, error, isLoading, isPending }`.

## Auth flow specifics

- On login → store refresh token in HTTP-only cookie (`Set-Cookie` from a Next route handler that proxies to backend). Access token in memory.
- On 401 → silent refresh attempt; if refresh fails, redirect to `/login`.
- Impersonation: clicking "Access as producer" → POST to backend → swap token in memory + cookie → render impersonation banner → reload current screen layout.

## Performance

- Server components for catalogs, plan info, low-volatility lists.
- Client components for anything with mutations or live data.
- Image-heavy: not applicable (mostly tabular).
- Use `next/dynamic` for heavy chart bundles only on report pages.

## Accessibility

- All shadcn components are accessible by default; preserve that.
- Keyboard support on tables (arrow keys to navigate rows).
- Focus rings preserved (don't disable Tailwind ring utilities).
- Color contrast AA minimum.

## Testing strategy

- Vitest unit tests on utilities (date math, cost computation, quota math).
- React Testing Library for stateful components: SeasonWizard, RecommendationCard substitution flow.
- Playwright e2e for: login, invite acceptance, create farm/plot, publish season, register harvest. Run in CI.

## Things to avoid

- Don't put business calculations in the frontend (cost, cascade dates, quota). Always use values returned by backend.
- Don't bypass React Query with raw `useEffect + fetch`.
- Don't skip the OpenAPI client; never hand-write fetch URLs.
- Don't render dates from raw strings without `date-fns-tz` formatting.
- Don't introduce a CSS-in-JS library. Tailwind only.
- Don't create role-specific pages outside the route groups (`(admin)`, `(agronomist)`); the segment groups make permission boundaries obvious.
