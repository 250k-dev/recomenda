"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Sprout,
  ArrowRight,
  Plus,
  Trash2,
} from "lucide-react";
import { DoseUnitSelect } from "@/components/ui/dose-unit-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocalCatalog, queryKeys } from "@/lib/api/hooks";
import {
  createPurchaseList,
  type PurchaseListItemInput,
} from "@/lib/api/client";
import { cn } from "@/lib/utils";
import {
  Field,
  FieldError,
  StepFooter,
  StepHeader,
  SummaryCard,
  STAGES,
  fmt,
  extractError,
  type ListItem,
  type WizardPlot,
} from "@/components/domain/season/_shared";

export type PurchaseListWizardProps = {
  producerId: string;
  producerName: string;
  plots: WizardPlot[];
  farmName?: string;
  onComplete: () => void;
  onCancel: () => void;
  successRedirectLabel?: string;
};

const WIZARD_STEPS = 2;

export function PurchaseListWizard({
  producerId,
  producerName,
  plots,
  farmName,
  onComplete,
  onCancel,
  successRedirectLabel = "Ir para o produtor",
}: PurchaseListWizardProps) {
  const [step, setStep] = useState(1);
  const [crop, setCrop] = useState<"SOYBEAN" | "CORN">("SOYBEAN");
  const [listName, setListName] = useState("");
  const [variety, setVariety] = useState("");
  const [items, setItems] = useState<ListItem[]>([]);

  const totalHa = useMemo(() => plots.reduce((s, p) => s + p.area, 0), [plots]);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="mb-6 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(step / WIZARD_STEPS) * 100}%` }}
          />
        </div>
        <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
          Passo {step} de {WIZARD_STEPS}
        </span>
      </div>

      {step === 1 && (
        <StepList
          crop={crop}
          setCrop={(v) => setCrop(v as "SOYBEAN" | "CORN")}
          listName={listName}
          setListName={setListName}
          variety={variety}
          setVariety={setVariety}
          items={items}
          setItems={setItems}
          totalHa={totalHa}
          farmName={farmName}
          onBack={onCancel}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <StepReview
          producerId={producerId}
          producerName={producerName}
          plots={plots}
          crop={crop}
          listName={listName}
          variety={variety}
          items={items}
          totalHa={totalHa}
          successRedirectLabel={successRedirectLabel}
          onBack={() => setStep(1)}
          onComplete={onComplete}
        />
      )}
    </div>
  );
}

function StepList({
  crop,
  setCrop,
  listName,
  setListName,
  variety,
  setVariety,
  items,
  setItems,
  totalHa,
  farmName,
  onBack,
  onNext,
}: {
  crop: string;
  setCrop: (v: string) => void;
  listName: string;
  setListName: (v: string) => void;
  variety: string;
  setVariety: (v: string) => void;
  items: ListItem[];
  setItems: React.Dispatch<React.SetStateAction<ListItem[]>>;
  totalHa: number;
  farmName?: string;
  onBack: () => void;
  onNext: () => void;
}) {
  const catalog = useLocalCatalog();
  const products = catalog.data?.data ?? [];
  const [error, setError] = useState<string | null>(null);

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        key: `i-${Date.now()}-${prev.length}`,
        productId: "",
        productName: "",
        stage: STAGES[0],
        dose: "",
        unit: "L",
        nApps: "1",
        stock: "0",
        price: "",
      },
    ]);
  };

  const updateItem = (key: string, patch: Partial<ListItem>) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  };

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((it) => it.key !== key));
  };

  const next = () => {
    setError(null);
    if (!listName.trim()) return setError("Dê um nome para a lista de compra.");
    if (items.length === 0) return setError("Adicione pelo menos um produto.");
    for (const it of items) {
      if (!it.productId) return setError("Selecione o produto em todos os itens.");
      if (!Number(it.dose)) return setError("Informe a dose/ha em todos os itens.");
    }
    onNext();
  };

  const selectClass =
    "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

  return (
    <div className="flex flex-1 flex-col">
      <StepHeader
        title="Lista de compra"
        subtitle="Adicione os produtos da safra inteira e marque a etapa de cada um. As quantidades são calculadas pelos hectares."
        onBack={onBack}
        backLabel="Cancelar"
      />

      <div className="grid max-w-4xl gap-4 sm:grid-cols-3">
        <Field htmlFor="list-name" label="Nome da lista">
          <Input
            id="list-name"
            value={listName}
            onChange={(e) => setListName(e.target.value)}
            placeholder="Ex: Soja 24/25"
          />
        </Field>
        <Field htmlFor="crop" label="Cultura">
          <select
            id="crop"
            value={crop}
            onChange={(e) => setCrop(e.target.value)}
            className={selectClass}
          >
            <option value="SOYBEAN">Soja</option>
            <option value="CORN">Milho</option>
          </select>
        </Field>
        <Field htmlFor="variety" label="Variedade (opcional)">
          <Input
            id="variety"
            value={variety}
            onChange={(e) => setVariety(e.target.value)}
            placeholder="Ex: NS 5090"
          />
        </Field>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <Sprout className="h-4 w-4 text-primary" />
        {farmName ? (
          <>
            <span className="font-medium text-foreground">{farmName}</span>
            <span className="text-muted-foreground/60">·</span>
          </>
        ) : null}
        Área total: <strong className="text-foreground">{fmt(totalHa)} ha</strong>
        <span className="text-muted-foreground/60">·</span>
        as quantidades abaixo são dose/ha × área × nº de aplicações.
      </div>

      <div className="mt-6 hidden overflow-x-auto rounded-lg border bg-card lg:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Produto</th>
              <th className="px-3 py-2 text-left">Etapa</th>
              <th className="px-3 py-2 text-left">Dose/ha</th>
              <th className="px-3 py-2 text-left">Un.</th>
              <th className="px-3 py-2 text-left">Nº apl.</th>
              <th className="px-3 py-2 text-left">Estoque</th>
              <th className="px-3 py-2 text-left">Preço R$/un.</th>
              <th className="px-3 py-2 text-right">Necessário</th>
              <th className="px-3 py-2 text-right">A comprar</th>
              <th className="px-3 py-2 text-right">Valor total</th>
              <th className="w-10 px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Nenhum produto adicionado.
                </td>
              </tr>
            ) : (
              items.map((it) => {
                const required = Number(it.dose || 0) * totalHa * Number(it.nApps || 1);
                const toBuy = Math.max(0, required - Number(it.stock || 0));
                const totalValue = toBuy * Number(it.price || 0);
                return (
                  <tr key={it.key} className="align-middle">
                    <td className="px-3 py-2">
                      <select
                        value={it.productId}
                        onChange={(e) => {
                          const prod = products.find((p) => p.id === e.target.value);
                          updateItem(it.key, {
                            productId: e.target.value,
                            productName: prod?.name ?? "",
                            unit: prod?.dose_unit ?? it.unit,
                          });
                        }}
                        className={cn(selectClass, "min-w-[180px]")}
                      >
                        <option value="">Selecione…</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={it.stage}
                        onChange={(e) => updateItem(it.key, { stage: e.target.value })}
                        className={cn(selectClass, "min-w-[150px]")}
                      >
                        {STAGES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={it.dose}
                        onChange={(e) => updateItem(it.key, { dose: e.target.value })}
                        className="w-24"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <DoseUnitSelect
                        value={it.unit}
                        onChange={(val) => updateItem(it.key, { unit: val })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        value={it.nApps}
                        onChange={(e) => updateItem(it.key, { nApps: e.target.value })}
                        className="w-20"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={it.stock}
                        onChange={(e) => updateItem(it.key, { stock: e.target.value })}
                        className="w-24"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="opcional"
                        value={it.price}
                        onChange={(e) => updateItem(it.key, { price: e.target.value })}
                        className="w-28"
                      />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {fmt(required)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-foreground">
                      {fmt(toBuy)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground">
                      {it.price
                        ? totalValue.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                            maximumFractionDigits: 2,
                          })
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => removeItem(it.key)}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 space-y-3 lg:hidden">
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhum produto adicionado.
          </div>
        ) : (
          items.map((it) => {
            const required = Number(it.dose || 0) * totalHa * Number(it.nApps || 1);
            const toBuy = Math.max(0, required - Number(it.stock || 0));
            return (
              <div key={it.key} className="rounded-lg border bg-card p-4 shadow-sm">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Produto
                  </p>
                  <button
                    type="button"
                    onClick={() => removeItem(it.key)}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <select
                  value={it.productId}
                  onChange={(e) => {
                    const prod = products.find((p) => p.id === e.target.value);
                    updateItem(it.key, {
                      productId: e.target.value,
                      productName: prod?.name ?? "",
                      unit: prod?.dose_unit ?? it.unit,
                    });
                  }}
                  className={selectClass}
                >
                  <option value="">Selecione…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="Etapa">
                    <select
                      value={it.stage}
                      onChange={(e) => updateItem(it.key, { stage: e.target.value })}
                      className={selectClass}
                    >
                      {STAGES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Dose/ha">
                    <Input
                      type="number"
                      step="0.01"
                      value={it.dose}
                      onChange={(e) => updateItem(it.key, { dose: e.target.value })}
                    />
                  </Field>
                  <Field label="Unidade">
                    <DoseUnitSelect
                      value={it.unit}
                      onChange={(val) => updateItem(it.key, { unit: val })}
                    />
                  </Field>
                  <Field label="Nº aplicações">
                    <Input
                      type="number"
                      value={it.nApps}
                      onChange={(e) => updateItem(it.key, { nApps: e.target.value })}
                    />
                  </Field>
                  <Field label="Estoque atual">
                    <Input
                      type="number"
                      step="0.01"
                      value={it.stock}
                      onChange={(e) => updateItem(it.key, { stock: e.target.value })}
                    />
                  </Field>
                </div>

                <div className="mt-3 flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">
                    Necessário{" "}
                    <span className="tabular-nums text-foreground">{fmt(required)}</span>
                  </span>
                  <span className="font-semibold">
                    A comprar{" "}
                    <span className="tabular-nums text-foreground">{fmt(toBuy)}</span>
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-4">
        <Button variant="outline" onClick={addItem} className="gap-2">
          <Plus className="h-4 w-4" />
          Adicionar produto
        </Button>
      </div>

      {error ? (
        <div className="mt-4 max-w-xl">
          <FieldError message={error} />
        </div>
      ) : null}

      <StepFooter
        primary={
          <Button onClick={next} className="gap-2">
            Próximo
            <ArrowRight className="h-4 w-4" />
          </Button>
        }
      />
    </div>
  );
}

function StepReview({
  producerId,
  producerName,
  plots,
  crop,
  listName,
  variety,
  items,
  totalHa,
  successRedirectLabel,
  onBack,
  onComplete,
}: {
  producerId: string;
  producerName: string;
  plots: WizardPlot[];
  crop: string;
  listName: string;
  variety: string;
  items: ListItem[];
  totalHa: number;
  successRedirectLabel: string;
  onBack: () => void;
  onComplete: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => {
      const itemsPayload: PurchaseListItemInput[] = items.map((it) => ({
        local_product_id: it.productId,
        stage: it.stage,
        dose_per_hectare: Number(it.dose),
        dose_unit: it.unit,
        n_applications: Number(it.nApps) || 1,
        current_stock: Number(it.stock) || 0,
        price_brl_fixed: it.price ? Number(it.price) : null,
      }));
      return createPurchaseList({
        producer_id: producerId,
        crop,
        name: listName,
        variety: variety || undefined,
        season_id: null,
        plots: plots.map((p) => ({
          plot_id: p.id,
          planting_date: null,
          desiccation_date: null,
          cycle_days: null,
        })),
        items: itemsPayload,
      });
    },
    onSuccess: (list) => {
      setSavedId(list.id);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.producerPurchaseLists(producerId),
      });
      void queryClient.invalidateQueries({ queryKey: ["farm-purchase-lists"] });
    },
    onError: (e: unknown) => setError(extractError(e)),
  });

  const totalToBuy = items.reduce((s, it) => {
    const req = Number(it.dose || 0) * totalHa * Number(it.nApps || 1);
    return s + Math.max(0, req - Number(it.stock || 0));
  }, 0);

  if (savedId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Check className="h-8 w-8" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Lista de compra salva
        </h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          A lista de compra de{" "}
          <strong className="text-foreground">{producerName}</strong> foi salva.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            Imprimir
          </Button>
          <Button onClick={onComplete}>{successRedirectLabel}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <StepHeader
        title="Revisão da lista"
        subtitle="Confira os produtos antes de salvar."
        onBack={onBack}
        backLabel="Voltar à lista"
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Produtor" value={producerName} />
        <SummaryCard label="Talhões" value={String(plots.length)} />
        <SummaryCard label="Área total" value={`${fmt(totalHa)} ha`} />
      </div>

      <div className="mt-6 rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Lista de compra · {listName || "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {crop === "CORN" ? "Milho" : "Soja"}
              {variety ? ` · ${variety}` : ""} ·{" "}
              {items.length} {items.length === 1 ? "produto" : "produtos"}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          {items.map((it) => {
            const req = Number(it.dose || 0) * totalHa * Number(it.nApps || 1);
            const toBuy = Math.max(0, req - Number(it.stock || 0));
            return (
              <div
                key={it.key}
                className="flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/40"
              >
                <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {it.stage}
                </span>
                <span className="font-medium text-foreground">{it.productName}</span>
                <div className="flex-1" />
                <span className="tabular-nums text-muted-foreground">
                  comprar {fmt(toBuy)} {it.unit}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-baseline justify-between border-t pt-3 text-sm">
          <span className="text-muted-foreground">Total a comprar</span>
          <strong className="text-base text-foreground">{fmt(totalToBuy)}</strong>
        </div>
      </div>

      {error ? (
        <div className="mt-4 max-w-xl">
          <FieldError message={error} />
        </div>
      ) : null}

      <StepFooter
        primary={
          <Button size="lg" onClick={() => mutation.mutate()} disabled={mutation.isPending} className="gap-2">
            <Check className="h-4 w-4" />
            {mutation.isPending ? "Salvando…" : "Salvar lista"}
          </Button>
        }
      />
    </div>
  );
}
