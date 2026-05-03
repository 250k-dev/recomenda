# Business Rules

Algorithms and behavior that must be consistent across backend, web, and mobile. Whenever a rule conflicts with UI implementation, **this document wins**.

## 1. Plot Quota

### Counting active plots
A plot consumes one quota slot if and only if it has a Season with status in (`PUBLISHED`, `IN_PROGRESS`).

```
active_plots_count(agronomist) =
  count(seasons where status ∈ {PUBLISHED, IN_PROGRESS}
        and farm.agronomist_id = agronomist.id)
```

### Enforcement points
- **On creating Season as PUBLISHED**: block if `active_plots_count >= plan.plot_quota`.
- **On transitioning Season DRAFT → PUBLISHED**: same block.
- **On creating Season as DRAFT**: allowed (does not consume slot).
- **On Harvest registration**: season transitions to `HARVESTED`, slot is released.

### UI feedback
The agronomist's dashboard always displays "X of Y plots in use". When near limit, show warning. When at limit, the "Publish season" button is disabled with tooltip explaining upgrade path.

## 2. Date Calculation and Cascade

### Initial calculation (when Season is published)
For each Recommendation copied from TimingStage, compute predicted dates based on `trigger_type`:

```
anchor_date =
  if trigger_type = DAYS_AFTER_PLANTING        → season.planting_date
  if trigger_type = DAYS_AFTER_DESICCATION     → season.desiccation_date
  if trigger_type = DAYS_AFTER_TASSELING       → tasseling_date (set by producer event)
  if trigger_type = FIXED_DATE_OFFSET          → previous recommendation's executed_date or predicted_date_current

predicted_date_current = anchor_date + window_start_days
predicted_date_original = predicted_date_current   (set once, never changes)
```

### Cascade on application registration
When a producer registers a Recommendation as applied or skipped:

```
1. Set executed_date and final status (APPLIED_ON_TIME / APPLIED_LATE / SKIPPED).
2. Determine status:
     APPLIED_ON_TIME if executed_date ≤ predicted_date_current + (window_end_days - window_start_days)
     APPLIED_LATE    if executed_date > that threshold
     SKIPPED         if explicitly skipped (executed_date may be null or set to "marked-skipped" date)
3. delta_days = executed_date - predicted_date_current
4. For every Recommendation in the same Season with status = PENDING and order_index > current.order_index:
     predicted_date_current += delta_days
     predicted_date_original is preserved untouched
5. Persist all changes in one transaction.
6. Notify agronomist asynchronously.
```

### Display rule
On any UI showing recommendation dates: show `predicted_date_current` as primary. If `predicted_date_original` differs, show it secondarily (e.g., struck through, in muted color, or as "originally planned: DD/MM").

### Unwinding
If a producer or agronomist undoes an application:
- Revert recommendation to PENDING.
- Revert stock movements (create reverse StockMovement entries).
- Recompute the cascade for subsequent pending recommendations using the previous-previous executed date.
- Audit log records the unwind.

## 3. Stock

### Initial setup
- Producer's stock starts empty.
- Agronomist may pre-load initial stock when creating a Season (for products the producer already has on the property). This generates StockMovement entries with `movement_type = INITIAL_LOAD`.

### Debit on application
When a Recommendation is set to APPLIED_ON_TIME or APPLIED_LATE:
```
For each RecommendationItem in the recommendation:
    quantity_to_debit = item.dose_per_hectare × plot.area_hectares
    decrement Stock(producer, item.local_product_id) by quantity_to_debit
    create StockMovement {
        movement_type: APPLICATION_DEBIT,
        quantity_delta: -quantity_to_debit,
        source_type: RECOMMENDATION,
        source_id: recommendation.id,
        actor_user_id: <current user>,
        actor_real_user_id: <impersonator if any>
    }
```

### Skipped recommendations do not debit stock.

### Negative stock
Stock may go negative. Treat as warning, not error. The producer may have product not yet registered. UI surfaces a yellow indicator on the product, never a blocker.

### Credit on purchase
When a Producer registers a Purchase:
```
Stock(producer, local_product_id) += purchase.quantity
StockMovement { movement_type: PURCHASE, quantity_delta: +qty, source_type: PURCHASE, source_id: purchase.id }
```

### Manual adjustment
Producer or agronomist can set stock to any value:
```
delta = new_quantity - current_quantity
StockMovement { movement_type: MANUAL_ADJUSTMENT, quantity_delta: delta }
```

## 4. Shopping List

For a published Season, derive the shopping list from all PENDING recommendations:

```
For each unique local_product across all RecommendationItems of pending recommendations:
    total_required = sum_over_recommendations(dose_per_hectare × plot.area_hectares)
    current_stock = Stock(producer, local_product).quantity (default 0)
    quantity_to_buy = max(0, total_required - current_stock)
    estimated_cost_brl = quantity_to_buy × local_product.price_brl
    estimated_cost_usd = quantity_to_buy × local_product.price_usd
```

Shopping list shows: product name, category, label link, total required, current stock, quantity to buy, estimated cost in BRL and USD.

If `quantity_to_buy = 0`: show "In stock ✓" badge instead of cost.

## 5. Product Substitution

### Producer can freely substitute
On the Recommendation detail screen, the producer may replace a product in a RecommendationItem with another product from the agronomist's local catalog. Approval is **not** required.

### Substitution effect
```
1. Set RecommendationItem.original_local_product_id = current local_product_id
2. Set RecommendationItem.local_product_id = new product
3. Set RecommendationItem.is_substitution = true
4. Notify agronomist (Notification + push if subscribed)
```

### Stock implications
At application time, debit goes to the **substituted product** (the one the producer actually used). Original product's stock is untouched.

### Equivalence hint (UX, not enforcement)
If `equivalence_group` is set on both products, UI shows "compatible substitution". If groups differ or are missing, UI shows "non-standard substitution — please confirm". Either is allowed; the label is purely informational.

## 6. Impersonation (Agronomist as Producer)

### Activation
Agronomist selects a Producer → "Access as producer". App enters impersonation mode:
- Top-of-screen banner persistent: "Acting as <Producer Name> — exit".
- All UI follows the Producer's permissions.
- Backend session token carries `actor_real_user_id` (agronomist) and `actor_apparent_user_id` (producer).

### Auditing
Every mutating action recorded with both user IDs:
```
StockMovement.actor_user_id = producer (apparent)
StockMovement.actor_real_user_id = agronomist (real)
AuditLog.actor_user_id = producer
AuditLog.actor_real_user_id = agronomist
```

### Restrictions during impersonation
- Cannot change a Producer's password or email.
- Cannot accept invitations on their behalf.
- Cannot modify their notification preferences.
- Can perform every other Producer action.

## 7. Templates and Seasons

### Template versioning
Templates (Timing, Mix) are not versioned in v1. Editing a template only affects future seasons created from it.

### Season creation flow
```
1. Agronomist selects: plot, crop, variety, timing template, dates (planting/desiccation if known).
2. System loads the timing template's stages.
3. For each stage: agronomist confirms or replaces the default mix template.
4. Optionally pre-load producer stock with quantities they already hold.
5. Click "Save as DRAFT" or "Publish".
6. On publish:
     a. Quota check passes.
     b. Recommendations and RecommendationItems are deep-copied from templates.
     c. Initial date calculation runs (see Rule 2).
     d. Notification sent to producer.
```

### Editing a season after publish
Allowed:
- Edit any PENDING recommendation's products, doses, predicted_date_current.
- Add/remove RecommendationItems on PENDING recommendations.
- Add new Recommendation to a season (e.g., emergency spraying).
Not allowed:
- Modify recommendations whose status is not PENDING (must undo first).
- Change the Season's plot or crop.

## 8. Invitations

### Email invite flow
1. Agronomist enters email + selects farms to grant access.
2. System creates Invitation with token, sends email containing link `/invite/<token>`.
3. Recipient opens link:
     - If logged in as a User with matching email → "Accept access".
     - Else → registration form (creates Producer User), then accept.
4. On accept: create FarmAccess for each farm; mark invitation ACCEPTED.

### Generic link
Agronomist may generate a link without specifying email:
- Token is created; first recipient to open and register accepts.
- Useful for QR codes or in-person.

### Expiration
Invitations expire after 14 days. Agronomist may revoke or regenerate.

## 9. Harvest and Reporting

### Harvest registration (by Producer)
1. Producer selects Season → "Register Harvest".
2. Inputs: harvest_date, bags_per_hectare, optional sale_price_per_bag_brl.
3. System transitions Season to HARVESTED, releases plot quota slot, generates report data.

### Productivity report
Per Season:
- Total area (ha), planting date, harvest date, days in cycle.
- Recommendations: planned vs executed (counts and dates).
- Total cost: sum across all RecommendationItems where status ∈ (APPLIED_ON_TIME, APPLIED_LATE), of `dose_per_hectare × area × price_brl`. Same in USD.
- Cost per hectare.
- Yield: bags_per_hectare and total bags (× area).
- Revenue (if sale price set): bags × sale_price_per_bag_brl.
- Margin: revenue − cost.

### Comparative reports (Agronomist only)
- Across producers within the same crop and region.
- Across seasons of the same plot historically.

## 10. Notifications

### Triggers
- `INVITATION` → producer when invited.
- `SEASON_PUBLISHED` → producer when a new season is published.
- `RECOMMENDATION_DUE` → producer 2 days before `predicted_date_current`.
- `RECOMMENDATION_LATE` → producer 1 day after window end if still PENDING.
- `PRODUCT_SUBSTITUTED` → agronomist when producer substitutes.
- `HARVEST_REGISTERED` → agronomist when producer registers harvest.

### Channels
- In-app notification list (always).
- Push notification (mobile, when device is registered).
- Email (transactional, for invitations and major events).

## 11. Time and Timezone

- All dates stored as `DATE` (no time) in UTC-equivalent, treated as the producer's local civil date.
- Producer's farm location may carry a timezone string for display; v1 assumes Brazil (`America/Sao_Paulo`).
- Calculations on dates are done in days, not timestamps. No DST surprises.
