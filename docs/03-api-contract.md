# API Contract

REST + JSON over HTTPS. Consumed by the web client (agronomist+admin) and mobile client (producer + agronomist on field). Backend is the single source of truth.

## Conventions

### Base URL
```
/api/v1
```

### Authentication
- Bearer token (JWT) in `Authorization: Bearer <token>` header.
- Tokens issued by `/auth/login` and `/auth/refresh`.
- Access token lifetime: 1 hour. Refresh token: 30 days.
- Impersonation: a separate endpoint issues a short-lived token (`/auth/impersonate/:producerId`) that carries both `sub` (apparent user = producer) and `act` (real user = agronomist). All actions made with this token are audited with both IDs.

### Naming
- Resources: plural snake_case in URLs (`/farms`, `/timing_templates`).
- Field names in payloads: snake_case (`planting_date`, `dose_per_hectare`).
- Enums: SCREAMING_SNAKE_CASE.

### Pagination
List endpoints accept `?page=1&page_size=20` (default page_size 20, max 100).
Response wrapper:
```json
{
  "data": [...],
  "pagination": { "page": 1, "page_size": 20, "total": 47, "total_pages": 3 }
}
```

### Error format
```json
{
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "Plan quota of 6 active plots reached",
    "details": { "current": 6, "limit": 6 }
  }
}
```

Common error codes:
- `UNAUTHENTICATED` (401)
- `FORBIDDEN` (403)
- `NOT_FOUND` (404)
- `VALIDATION_ERROR` (422) — `details` lists field errors
- `QUOTA_EXCEEDED` (409)
- `CONFLICT` (409) — generic conflict (e.g., duplicate)
- `RATE_LIMITED` (429)
- `INTERNAL` (500)

### Idempotency
Mutating endpoints accept `Idempotency-Key` header. Critical for mobile (offline replay). Backend stores key+result for 24h.

### Timestamps
- All timestamps ISO 8601 with timezone (`2026-04-26T14:30:00-03:00`).
- Calendar dates as `YYYY-MM-DD` strings.

## Endpoints by domain

### Auth

```
POST   /auth/register-producer       (via invitation token)
POST   /auth/login                   { email, password } → { access_token, refresh_token, user }
POST   /auth/refresh                 { refresh_token } → { access_token }
POST   /auth/logout
POST   /auth/forgot-password         { email }
POST   /auth/reset-password          { token, new_password }

POST   /auth/impersonate/:producer_id   (agronomist only) → { access_token }
POST   /auth/impersonate/exit
GET    /auth/me                      → current user + role + active impersonation if any
```

### Plans (admin only for write; agronomist reads own)

```
GET    /plans                        (public list of available plans)
GET    /plans/:id
POST   /plans                        (admin)
PATCH  /plans/:id                    (admin)
GET    /agronomists/me/plan          → current plan + quota usage
```

### Users / Agronomists / Producers (admin)

```
GET    /admin/agronomists
POST   /admin/agronomists            (admin onboards an agronomist)
PATCH  /admin/agronomists/:id
GET    /admin/agronomists/:id
```

### Producers (managed by agronomist)

```
GET    /producers                    (agronomist sees their own producers)
GET    /producers/:id
PATCH  /producers/:id                (limited fields; producer can update their own profile)
```

### Invitations

```
GET    /invitations                  (agronomist sees their sent invites)
POST   /invitations                  { email?, farm_ids: [...] } → { id, link, token }
POST   /invitations/:id/revoke
POST   /invitations/:id/resend
GET    /invitations/by-token/:token  (public — preview before accepting)
POST   /invitations/by-token/:token/accept   { name?, password } (public)
```

### Farms and Plots

```
GET    /farms                        (agronomist sees own; producer sees granted)
POST   /farms                        (agronomist)
GET    /farms/:id
PATCH  /farms/:id                    (agronomist)
DELETE /farms/:id                    (agronomist; only if no active seasons)

GET    /farms/:id/plots
POST   /farms/:id/plots              { name, area_hectares }
PATCH  /plots/:id
DELETE /plots/:id

GET    /farms/:id/access             (list producers granted)
POST   /farms/:id/access             { producer_id }
DELETE /farms/:id/access/:producer_id
```

### Catalogs

```
GET    /catalog/global               (all roles, read-only)
POST   /catalog/global               (admin)
PATCH  /catalog/global/:id           (admin)
DELETE /catalog/global/:id           (admin)

GET    /catalog/local                (agronomist's products, including auto-created from global)
POST   /catalog/local                (agronomist creates a custom product)
PATCH  /catalog/local/:id            (agronomist customizes price, label, etc.)
DELETE /catalog/local/:id            (agronomist; only if not referenced)
POST   /catalog/local/from-global/:global_id   (clone a global product into local)
```

### Timing Templates

```
GET    /timing_templates             (agronomist's own; filter ?crop=SOYBEAN)
POST   /timing_templates             { name, crop }
GET    /timing_templates/:id         → includes stages
PATCH  /timing_templates/:id
DELETE /timing_templates/:id

POST   /timing_templates/:id/stages  { name, trigger_type, window_start_days, window_end_days, default_mix_template_id, order_index }
PATCH  /timing_stages/:id
DELETE /timing_stages/:id
POST   /timing_templates/:id/stages/reorder  { stage_ids_in_order: [...] }
```

### Mix Templates

```
GET    /mix_templates                (agronomist's own)
POST   /mix_templates                { name, crop, items: [{ local_product_id, dose_per_hectare }] }
GET    /mix_templates/:id
PATCH  /mix_templates/:id
DELETE /mix_templates/:id

POST   /mix_templates/:id/items      { local_product_id, dose_per_hectare }
PATCH  /mix_template_items/:id
DELETE /mix_template_items/:id
```

### Seasons

```
GET    /seasons                      (filter: ?producer_id, ?farm_id, ?status, ?crop)
POST   /seasons                      (agronomist; see request body below)
GET    /seasons/:id                  → includes recommendations
PATCH  /seasons/:id                  (limited fields while in DRAFT; broader for IN_PROGRESS)
POST   /seasons/:id/publish          → enforces quota, generates Recommendations, sends notif
POST   /seasons/:id/archive

GET    /seasons/:id/shopping_list    → derived shopping list (see Business Rules §4)
GET    /seasons/:id/timeline         → recommendations sorted with dates resolved
```

#### POST /seasons body
```json
{
  "plot_id": "uuid",
  "producer_id": "uuid",
  "crop": "SOYBEAN",
  "variety": "OLIMPO",
  "cycle_days": 120,
  "timing_template_id": "uuid",
  "desiccation_date": "2026-09-15",
  "stages_overrides": [
    {
      "timing_stage_id": "uuid",
      "mix_template_id": "uuid"
    }
  ],
  "initial_stock": [
    { "local_product_id": "uuid", "quantity": 50 }
  ],
  "publish_now": false
}
```

### Recommendations

```
GET    /recommendations/:id          → with items
PATCH  /recommendations/:id          (agronomist; only fields allowed by status)
POST   /recommendations/:id/apply    { executed_date, notes? }
POST   /recommendations/:id/skip     { notes }
POST   /recommendations/:id/undo     (reverts to PENDING; reverses stock movements)

POST   /recommendation_items         { recommendation_id, local_product_id, dose_per_hectare }
PATCH  /recommendation_items/:id     { dose_per_hectare? }
DELETE /recommendation_items/:id

POST   /recommendation_items/:id/substitute   { new_local_product_id }
```

### Stock

```
GET    /producers/:id/stock          (list current stock per product)
GET    /producers/:id/stock/movements
POST   /producers/:id/stock/adjust   { local_product_id, new_quantity, notes }
```

### Purchases

```
GET    /producers/:id/purchases
POST   /producers/:id/purchases      { local_product_id, quantity, unit_price_brl?, unit_price_usd?, purchased_at, notes? }
PATCH  /purchases/:id
DELETE /purchases/:id                (reverses stock credit)
```

### Harvest and Reports

```
POST   /seasons/:id/harvest          { harvest_date, bags_per_hectare, sale_price_per_bag_brl?, notes? }
GET    /seasons/:id/report           → productivity report (see Business Rules §9)
GET    /agronomists/me/reports       (cross-season comparatives — filters in query)
```

### Notifications

```
GET    /notifications                (current user; ?unread_only=true)
POST   /notifications/:id/read
POST   /notifications/read-all
POST   /notifications/devices        (mobile push registration: { token, platform })
```

### Audit (admin and agronomist for own scope)

```
GET    /audit_logs                   (filter: actor_user_id, entity_type, entity_id, date range)
```

## Authorization matrix

| Resource | Admin | Agronomist (own) | Producer (granted) |
|---|---|---|---|
| Plans | CRUD | R | – |
| GlobalCatalog | CRUD | R | – |
| LocalCatalog | – | CRUD | R |
| Agronomists | CRUD | R (self), U (self) | – |
| Producers | – | CRUD | R (self), U (self) |
| Farms / Plots | – | CRUD | R |
| TimingTemplates / MixTemplates | – | CRUD | R |
| Seasons | – | CRUD, publish, archive | R, register actions |
| Recommendations | – | CRUD on PENDING | R, apply/skip/undo, substitute |
| Stock | – | CR (initial load), R, adjust | R, adjust |
| Purchases | – | R | CRUD |
| Harvest | – | R | C, R |
| Notifications | own | own | own |
| AuditLog | full | own scope | – |

## Webhooks (future, mark as v2)

Not exposed in v1. Backend should leave room in design for outbound webhooks on key events (season published, harvest registered, recommendation applied).

## Versioning policy

- URL-versioned (`/api/v1`).
- Breaking changes → new version. Non-breaking additions go in v1.
- Deprecated fields kept for 6 months minimum, marked in OpenAPI.

## OpenAPI

Backend must expose `/api/v1/openapi.json` with the full spec auto-generated from controllers and DTOs. Both frontends consume this for type generation.
