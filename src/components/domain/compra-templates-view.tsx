"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Check, FileText, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PurchaseListItemsEditor } from "@/components/domain/purchase-list-items-editor";
import {
  useCreatePurchaseListTemplate,
  useDeletePurchaseListTemplate,
  usePurchaseListTemplates,
  useUpdatePurchaseListTemplate,
} from "@/lib/api/hooks";
import { apiErrorMessage } from "@/lib/api-error";
import type { PurchaseListDetail } from "@/lib/api/purchase-lists";
import { CROP_LABELS } from "@/lib/season-constants";
import {
  listItemToPayload,
  validateListItems,
  type ListItem,
} from "@/components/domain/season/_shared";

type Crop = "SOYBEAN" | "CORN" | "ANY";

function detailItemToListItem(it: PurchaseListDetail["items"][number]): ListItem {
  return {
    key: it.id,
    category: it.category ?? "OTHER",
    productId: it.local_product_id,
    productName: it.product_name,
    stage: it.stage,
    dose: String(it.dose_per_hectare),
    unit: it.dose_unit,
    nApps: String(it.n_applications),
    stock: String(it.current_stock),
    price: it.price_brl_fixed != null ? String(it.price_brl_fixed) : "",
    priceUsd: it.price_usd != null ? String(it.price_usd) : "",
    seedsPerMeter: it.seeds_per_meter != null ? String(it.seeds_per_meter) : "",
    cycleDays: it.cycle_days != null ? String(it.cycle_days) : "",
    thousandPlants: it.thousand_plants_per_ha != null ? String(it.thousand_plants_per_ha) : "",
    seedingArea: it.seeding_area_ha != null ? String(it.seeding_area_ha) : "",
    bagsOverride: it.bags_override != null ? String(it.bags_override) : undefined,
    outOfProgram: it.out_of_program || undefined,
  };
}

export function CompraTemplatesView() {
  const { data: templates, isLoading } = usePurchaseListTemplates();
  const [editing, setEditing] = useState<PurchaseListDetail | "new" | null>(null);
  const [toDelete, setToDelete] = useState<PurchaseListDetail | null>(null);
  const deleteMutation = useDeletePurchaseListTemplate();

  if (editing) {
    return (
      <TemplateEditor
        template={editing === "new" ? null : editing}
        onDone={() => setEditing(null)}
      />
    );
  }

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteMutation.mutateAsync(toDelete.id);
      toast.success("Template excluído.");
      setToDelete(null);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Não foi possível excluir o template."));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Templates de compra
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Crie listas de compra modelo e reutilize ao montar a lista de qualquer produtor —
              sem refazer do zero.
            </p>
          </div>
        </div>
        <Button onClick={() => setEditing("new")} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo template
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : !templates || templates.length === 0 ? (
        <EmptyState
          title="Nenhum template ainda."
          description="Crie um template para reaproveitar em vários produtores."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <li
              key={t.id}
              className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <button
                type="button"
                onClick={() => setEditing(t)}
                className="flex flex-1 flex-col items-start gap-1 text-left"
              >
                <span className="flex items-center gap-2 font-semibold text-text-strong">
                  <ShoppingCart className="h-4 w-4 text-primary" />
                  {t.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {CROP_LABELS[t.crop as keyof typeof CROP_LABELS] ?? t.crop} · {t.items.length}{" "}
                  {t.items.length === 1 ? "produto" : "produtos"}
                </span>
              </button>
              <div className="flex justify-end gap-1.5">
                <Button variant="outline" size="sm" onClick={() => setEditing(t)}>
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Excluir template"
                  className="text-muted-foreground hover:text-danger-strong"
                  onClick={() => setToDelete(t)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={toDelete != null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        title="Excluir template?"
        description={
          toDelete ? `O template "${toDelete.name}" será removido. Esta ação não pode ser desfeita.` : undefined
        }
        tone="destructive"
        confirmLabel="Excluir"
        loading={deleteMutation.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function TemplateEditor({
  template,
  onDone,
}: {
  template: PurchaseListDetail | null;
  onDone: () => void;
}) {
  const isNew = template == null;
  const [name, setName] = useState(template?.name ?? "");
  const [crop, setCrop] = useState<Crop>((template?.crop as Crop) ?? "SOYBEAN");
  const [items, setItems] = useState<ListItem[]>(
    template ? template.items.map(detailItemToListItem) : [],
  );
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreatePurchaseListTemplate();
  const updateMutation = useUpdatePurchaseListTemplate(template?.id ?? "");
  const saving = createMutation.isPending || updateMutation.isPending;

  const cropButtons = useMemo(() => ["SOYBEAN", "CORN"] as const, []);

  const save = async () => {
    setError(null);
    if (!name.trim()) return setError("Dê um nome para o template.");
    const itemsError = validateListItems(items);
    if (itemsError) return setError(itemsError);

    const payload = {
      crop,
      name: name.trim(),
      plots: [],
      items: items.map((it) => listItemToPayload(it, crop)),
    };
    try {
      if (isNew) {
        await createMutation.mutateAsync(payload);
        toast.success("Template criado.");
      } else {
        await updateMutation.mutateAsync(payload);
        toast.success("Template atualizado.");
      }
      onDone();
    } catch (e) {
      setError(apiErrorMessage(e, "Não foi possível salvar o template."));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon-sm" onClick={onDone} title="Voltar">
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {isNew ? "Novo template de compra" : "Editar template"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Defina nome, cultura e os produtos. As quantidades são calculadas depois, quando o
              template é importado para um produtor com seus talhões.
            </p>
          </div>
        </div>
      </div>

      <section className="grid gap-6 rounded-xl border bg-card p-5 shadow-sm lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="template-name">Nome do template</Label>
          <Input
            id="template-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Soja padrão alta tecnologia"
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">Cultura(s)</Label>
          <div className="flex gap-2">
            {cropButtons.map((c) => {
              const on = crop === c || crop === "ANY";
              return (
                <Button
                  key={c}
                  type="button"
                  variant={on ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    const sojaOn = crop === "SOYBEAN" || crop === "ANY";
                    const milhoOn = crop === "CORN" || crop === "ANY";
                    const nextSoja = c === "SOYBEAN" ? !sojaOn : sojaOn;
                    const nextMilho = c === "CORN" ? !milhoOn : milhoOn;
                    if (!nextSoja && !nextMilho) return;
                    setCrop(nextSoja && nextMilho ? "ANY" : nextSoja ? "SOYBEAN" : "CORN");
                  }}
                >
                  {CROP_LABELS[c]}
                </Button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border bg-card p-5 shadow-sm">
        <PurchaseListItemsEditor items={items} setItems={setItems} totalHa={0} crop={crop} />
      </section>

      {error ? <p className="text-sm text-danger-strong">{error}</p> : null}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={save} disabled={saving} className="gap-2">
          <Check className="h-4 w-4" />
          {saving ? "Salvando…" : "Salvar template"}
        </Button>
      </div>
    </div>
  );
}
