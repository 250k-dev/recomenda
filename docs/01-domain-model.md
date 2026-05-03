# Domain Model

This document defines entities, relationships, and the canonical English vocabulary. **All code (database tables, API fields, type names) must use these exact terms.**

## Glossary (PT ↔ EN)

| Portuguese | English (canonical) |
|---|---|
| Fazendeiro / Produtor | Producer |
| Agrônomo | Agronomist |
| Fazenda | Farm |
| Talhão | Plot |
| Safra / Ciclo | Season |
| Cultura | Crop |
| Variedade / Cultivar | Variety |
| Plantio | Planting |
| Dessecação | Desiccation |
| Pendoamento | Tasseling |
| DAP (Dias Após Plantio) | DAP (Days After Planting) |
| Recomendação | Recommendation |
| Etapa de Aplicação | Application Stage |
| Mix de Produtos | Product Mix |
| Bula | Product Label |
| Estoque | Stock |
| Lista de Compras | Shopping List |
| Compra | Purchase |
| Aplicação | Application |
| Colheita | Harvest |
| Saca | Bag (60 kg) |
| Catálogo | Catalog |
| Plano | Plan |
| Cota | Quota |
| Convite | Invitation |

## Entities

### Plan
The subscription tier an Agronomist holds.
- `id`
- `name` (e.g., "Starter", "Pro")
- `plot_quota` (max simultaneous active seasons across the agronomist's plots)
- `price_brl_monthly`
- `is_active`

### User
Generic identity. Has exactly one `role`.
- `id`
- `name`
- `email` (unique)
- `phone` (optional)
- `password_hash`
- `role` enum: `ADMIN | AGRONOMIST | PRODUCER`
- `is_active`
- `created_at`

### Agronomist (extends User where role = AGRONOMIST)
- `user_id` (PK, FK → User)
- `plan_id` (FK → Plan)
- `plan_started_at`
- `active_plots_count` (denormalized counter; source of truth lives in Season aggregation)

### Producer (extends User where role = PRODUCER)
- `user_id` (PK, FK → User)
- `agronomist_id` (FK → Agronomist) — the agronomist who created this producer

### Farm
- `id`
- `agronomist_id` (FK → Agronomist) — owner of the data
- `name`
- `location` (text/coordinates, optional)
- `created_at`

### Plot
- `id`
- `farm_id` (FK → Farm)
- `name`
- `area_hectares` (decimal)
- `created_at`

### FarmAccess (N:N between Producer and Farm)
- `producer_id` (FK)
- `farm_id` (FK)
- `granted_at`
- PK = (producer_id, farm_id)

### GlobalProduct (catalog maintained by Admin)
- `id`
- `name` (e.g., "BELYAN")
- `category` enum: `HERBICIDE | FUNGICIDE | INSECTICIDE | ADJUVANT | BIOLOGICAL | FOLIAR | SEED_TREATMENT | FERTILIZER | OTHER`
- `dose_unit` enum: `L | KG | G | ML | DOSE` — base unit for stock and dose calculations
- `default_label_url` (optional PDF link)
- `equivalence_group` (optional — products with same group are interchangeable, e.g., "tebuconazole_fungicide_premium")
- `is_active`

### LocalProduct (per-Agronomist override or addition)
- `id`
- `agronomist_id` (FK → Agronomist)
- `global_product_id` (FK → GlobalProduct, nullable — null means custom product not in global catalog)
- `name` (defaults from global, editable)
- `category` (same enum, editable)
- `dose_unit` (same enum, editable)
- `label_url` (override)
- `price_brl` (per dose_unit)
- `price_usd` (per dose_unit)
- `equivalence_group` (override)
- `is_active`

> **Effective product**: when an Agronomist references a product, the system resolves to a LocalProduct. If the agronomist has not customized a global product, a LocalProduct is auto-created on first reference, copying values from GlobalProduct.

### TimingTemplate
- `id`
- `agronomist_id` (FK)
- `crop` enum: `SOYBEAN | CORN`
- `name` (e.g., "Soybean Standard")
- `created_at`
- `is_archived`

### TimingStage
A stage within a TimingTemplate.
- `id`
- `timing_template_id` (FK)
- `order_index` (int — sequence)
- `name` (e.g., "First Fungicide")
- `trigger_type` enum: `DAYS_AFTER_PLANTING | DAYS_AFTER_DESICCATION | DAYS_AFTER_TASSELING | FIXED_DATE_OFFSET`
- `window_start_days` (int — earliest day to apply)
- `window_end_days` (int — latest day; equals start when single-day)
- `default_mix_template_id` (FK → MixTemplate, nullable)
- `notes` (optional)

### MixTemplate
A reusable product mix.
- `id`
- `agronomist_id` (FK)
- `crop` enum: `SOYBEAN | CORN | ANY`
- `name` (e.g., "Premium Fungicide Mix")
- `category_hint` (matches a TimingStage purpose, optional)
- `is_archived`

### MixTemplateItem
- `id`
- `mix_template_id` (FK)
- `local_product_id` (FK)
- `dose_per_hectare` (decimal, in product's `dose_unit`)

### Season (the active crop cycle on a plot)
- `id`
- `plot_id` (FK)
- `producer_id` (FK) — primary producer for this season (the one who registers actions)
- `agronomist_id` (FK) — the supervising agronomist
- `crop` enum: `SOYBEAN | CORN`
- `variety` (text, e.g., "OLIMPO")
- `cycle_days` (int, optional — variety cycle length)
- `timing_template_id` (FK — the template applied; copy is generated)
- `desiccation_date` (date, nullable)
- `planting_date` (date, nullable — set by producer event)
- `status` enum: `DRAFT | PUBLISHED | IN_PROGRESS | HARVESTED | ARCHIVED`
- `created_at`
- `published_at` (nullable)
- `harvested_at` (nullable)
- **Quota rule**: status in (`PUBLISHED`, `IN_PROGRESS`) consumes one slot of the agronomist's plot quota.

### Recommendation
A concrete stage instance for a season (copy from TimingStage at season creation).
- `id`
- `season_id` (FK)
- `order_index` (int)
- `name`
- `trigger_type` (same enum)
- `window_start_days` / `window_end_days`
- `predicted_date_original` (date, nullable — first calculated date, frozen for comparison)
- `predicted_date_current` (date, nullable — recalculated by cascade)
- `executed_date` (date, nullable — when actually applied or marked skipped)
- `status` enum: `PENDING | APPLIED_ON_TIME | APPLIED_LATE | SKIPPED`
- `notes` (optional)
- `created_at`

### RecommendationItem
The products and doses for a recommendation (copied from MixTemplateItem at season creation, then editable).
- `id`
- `recommendation_id` (FK)
- `local_product_id` (FK)
- `dose_per_hectare` (decimal)
- `is_substitution` (bool — true if producer changed the product from original)
- `original_local_product_id` (FK, nullable — set if substituted)

### Stock
A producer's inventory. One row per (producer, local_product).
- `id`
- `producer_id` (FK)
- `local_product_id` (FK)
- `quantity` (decimal, in product's `dose_unit`)
- `updated_at`
- Unique constraint on (producer_id, local_product_id)

### StockMovement
Append-only log of every stock change.
- `id`
- `stock_id` (FK)
- `movement_type` enum: `INITIAL_LOAD | PURCHASE | APPLICATION_DEBIT | MANUAL_ADJUSTMENT | SUBSTITUTION_REVERSAL`
- `quantity_delta` (decimal — positive for credit, negative for debit)
- `quantity_after` (decimal — snapshot)
- `source_type` enum: `RECOMMENDATION | PURCHASE | MANUAL`
- `source_id` (UUID, nullable)
- `actor_user_id` (FK → User)
- `actor_real_user_id` (FK → User, nullable — set when impersonation)
- `notes`
- `created_at`

### Purchase
- `id`
- `producer_id` (FK)
- `local_product_id` (FK)
- `quantity` (decimal, in dose_unit)
- `unit_price_brl` (decimal, optional)
- `unit_price_usd` (decimal, optional)
- `purchased_at` (date)
- `notes`

### Harvest
- `id`
- `season_id` (FK, unique)
- `harvest_date` (date)
- `bags_per_hectare` (decimal — sacas/ha)
- `sale_price_per_bag_brl` (decimal, optional)
- `notes`

### Invitation
- `id`
- `agronomist_id` (FK)
- `email` (target)
- `producer_id` (FK, nullable — set after acceptance)
- `farm_ids` (array of UUIDs to grant access on acceptance)
- `token` (unique random token for the link)
- `status` enum: `PENDING | ACCEPTED | REVOKED | EXPIRED`
- `created_at`
- `accepted_at` (nullable)
- `expires_at`

### AuditLog
- `id`
- `actor_user_id`
- `actor_real_user_id` (nullable, for impersonation)
- `action` (string, e.g., `recommendation.applied`, `season.published`)
- `entity_type`
- `entity_id`
- `payload_diff` (JSON)
- `created_at`

### Notification
- `id`
- `user_id` (FK — recipient)
- `type` enum: `INVITATION | RECOMMENDATION_DUE | RECOMMENDATION_LATE | PRODUCT_SUBSTITUTED | SEASON_PUBLISHED | HARVEST_REGISTERED`
- `payload` (JSON)
- `read_at` (nullable)
- `created_at`

## Critical relationships at a glance

- Plan 1 — N Agronomist
- Agronomist 1 — N Producer (creator relationship)
- Agronomist 1 — N Farm
- Farm 1 — N Plot
- Producer N — N Farm (via FarmAccess)
- Plot 1 — N Season (over time, but only one with status in [PUBLISHED, IN_PROGRESS] at a time)
- TimingTemplate 1 — N TimingStage
- MixTemplate 1 — N MixTemplateItem
- TimingStage 0..1 — 1 MixTemplate (default mix)
- Season 1 — N Recommendation (generated copy)
- Recommendation 1 — N RecommendationItem
- Producer 1 — N Stock (one row per product they hold)
- Stock 1 — N StockMovement

## Invariants (must always hold)

1. A Season may only be PUBLISHED if `desiccation_date` or `planting_date` is set, depending on the timing template's earliest trigger.
2. `predicted_date_original` is set once on first calculation and never changes.
3. `predicted_date_current` is recalculated only for recommendations with status = PENDING.
4. A Recommendation transitions from PENDING to either APPLIED_ON_TIME (if executed_date inside window), APPLIED_LATE (after window), or SKIPPED.
5. Once a Recommendation leaves PENDING, its `executed_date` and any subsequent recalculation cascade are immutable except by an explicit "undo" action (which reverts stock movements as well).
6. The Agronomist's `active_plots_count` must equal the count of seasons where status ∈ (PUBLISHED, IN_PROGRESS) and the agronomist owns the farm.
7. Stock quantity must be ≥ 0 at all times (debit operations that would push below zero are warnings, not blockers — producer may have used product not yet registered in stock).
8. Every action performed under impersonation must record both `actor_real_user_id` and `actor_user_id` in StockMovement, AuditLog, and any timestamped state transitions.
