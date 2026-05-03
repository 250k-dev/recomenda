# Product Overview

## What this product is

A SaaS platform for **agronomists** to deliver agricultural recommendations to **producers** (farmers) and track field execution. The platform replaces spreadsheet-driven workflows with a structured app where:

- Agronomists configure recommendation templates (timing of applications and product mixes) once and reuse them across multiple plots and seasons.
- Producers receive a curated shopping list, register applications as they happen, manage stock, and report harvest results.
- The system automatically recalculates application dates when delays occur and tracks deviations between planned and executed actions.

The first two crops supported are **soybean** and **corn**.

## Personas

### Admin (platform-level)
Operates the SaaS company. Not a customer.
- Manages plans (talhão quotas + pricing).
- Maintains the **global product catalog** (products commonly available on the market).
- Onboards and supports agronomists.

### Agronomist (paying customer)
The technical professional who delivers recommendations.
- Subscribes to a plan with a quota of active plots.
- Configures **timing templates** (when to apply) and **mix templates** (what to apply).
- Manages a **local product catalog** that inherits from the global catalog and can be customized (own pricing, custom products, custom labels).
- Creates producer accounts and grants access to specific farms.
- Creates seasons (crop cycles) on plots, applying templates and adjusting per-season as needed.
- Can switch into a **producer view** to act on the producer's behalf (audited).

### Producer (farmer)
The end user who executes recommendations in the field.
- Receives invitations from agronomists.
- Read-mostly access: views farms, plots, recommendations, shopping list, reports.
- Action capabilities: register planting date, register application (or skip), substitute products, register product purchases, update stock, register harvest.

## Core concepts

**Farm** → a property. Has many **plots**.
**Plot (talhão)** → an area inside a farm with a defined size in hectares.
**Season (safra)** → an active crop cycle on a plot. Has crop, variety, planting date, possibly desiccation date.
**Timing Template** → reusable plan defining stages of application (per crop): name, trigger (DAP, days after desiccation, post-tasseling), application window.
**Mix Template** → reusable bundle of products with doses per hectare. Attached to one or more timing stages as default.
**Recommendation** → a concrete instance of a timing stage applied to a season. Generated when a season is created. Editable per-season without affecting templates.
**Stock** → product inventory held by a producer, debited automatically on application and credited on purchase.

## Key business decisions (locked)

1. **Templates are copied, not referenced, into seasons.** Editing a template later does not retroactively change recommendations of existing seasons.
2. **Plot quota counts only active seasons.** A plot with a non-harvested season consumes one quota slot. Harvest releases the slot.
3. **Hybrid product catalog.** Global catalog (Admin) + local overrides and additions (Agronomist).
4. **Producers can substitute products freely** during application registration. The agronomist is notified, no approval required.
5. **Stock is debited as `dose × plot area`** at the moment of application registration.
6. **Date cascade is automatic.** When an application is registered later than planned (or skipped), all subsequent pending recommendations are recalculated from the actual date. The original predicted date is preserved and shown alongside the new date for comparison.
7. **Agronomist impersonation of producer is allowed and audited.** Every action carries `actor_real` (agronomist) and `actor_apparent` (producer).
8. **Access is per-farm** (not per-plot). A producer with access to a farm sees all its plots.
9. **A producer may have access to multiple farms.** A farm may be shared by multiple producers (partners).
10. **Currencies for product pricing are BRL (R$) and USD (US$).** Stored separately (no live FX).

## Platforms

- **Web**: agronomist + admin tools. Configuration-heavy, dashboards, reports.
- **Mobile (iOS/Android)**: producer primary use, agronomist for in-field tasks. Must work in poor connectivity (offline-friendly registration).

## Out of scope (for v1)

- Telemetry/IoT integration with sensors or machinery.
- Automated weather pulls beyond manual notes.
- Marketplaces or direct purchase from suppliers.
- Crops other than soybean and corn.
- Multi-organization tenancy beyond agronomist-as-tenant.
- Live FX rates.
- SMS invitations (email + invite link only in v1).
