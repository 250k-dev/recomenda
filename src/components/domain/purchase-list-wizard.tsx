"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Sprout,
  ArrowRight,
  ShoppingCart,
  Leaf,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { PurchaseListItemsEditor } from "@/components/domain/purchase-list-items-editor";
import {
  createPurchaseList,
  type PurchaseListItemInput,
} from "@/lib/api/client";
import { queryKeys } from "@/lib/api/hooks";
import { CROP_LABELS } from "@/lib/season-constants";
import {
  FieldError,
  StepFooter,
  SummaryCard,
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
  items: ListItem[];
  setItems: React.Dispatch<React.SetStateAction<ListItem[]>>;
  totalHa: number;
  farmName?: string;
  onBack: () => void;
  onNext: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const next = () => {
    setError(null);
    if (!listName.trim()) return setError("Dê um nome para a lista de compra.");
    if (items.length === 0) return setError("Adicione pelo menos um produto.");
    for (const it of items) {
      if (!it.category) return setError("Selecione a categoria em todos os itens.");
      if (!it.productId) return setError("Selecione o produto em todos os itens.");
      if (!Number(it.dose)) return setError("Informe a dose/ha em todos os itens.");
    }
    onNext();
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShoppingCart className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Lista de compra
            </p>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-foreground">
              Montar insumos da safra
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Defina o nome e a cultura, depois adicione os produtos por categoria. As quantidades
              são calculadas pelos hectares dos talhões.
            </p>
          </div>
        </div>
        <Button variant="ghost" onClick={onBack} className="shrink-0">
          Cancelar
        </Button>
      </div>

      <section className="mb-6 overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b bg-muted/30 px-5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Identificação
          </p>
        </div>
        <div className="grid gap-6 p-5 lg:grid-cols-2">
          <div className="space-y-2.5 rounded-lg border border-primary/30 bg-primary/5 p-4 shadow-sm ring-1 ring-primary/10">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                <Type className="h-3.5 w-3.5" />
              </span>
              <Label htmlFor="list-name" className="text-sm font-semibold text-primary">
                Nome da lista
              </Label>
            </div>
            <Input
              id="list-name"
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              placeholder="Ex: Soja 26/27"
              className="h-12 border-primary/35 bg-background text-lg font-semibold shadow-sm focus-visible:border-primary focus-visible:ring-primary/30 placeholder:font-normal placeholder:text-muted-foreground/80"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Use um nome que identifique a safra ou o planejamento desta fazenda.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="list-crop" className="text-sm font-medium text-muted-foreground">
              Cultura
            </Label>
            <NativeSelect
              id="list-crop"
              value={crop}
              onChange={(e) => setCrop(e.target.value)}
              className="w-full"
            >
              <option value="SOYBEAN">{CROP_LABELS.SOYBEAN}</option>
              <option value="CORN">{CROP_LABELS.CORN}</option>
            </NativeSelect>
            <p className="text-xs text-muted-foreground">
              A cultura orienta relatórios e vínculos futuros com a safra.
            </p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-5 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Produtos
            </p>
            <p className="mt-0.5 text-sm font-medium text-foreground">
              Selecione a categoria antes do produto
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {farmName ? (
              <>
                <Leaf className="h-4 w-4 text-primary" />
                <span className="font-medium text-foreground">{farmName}</span>
                <span>·</span>
              </>
            ) : null}
            <Sprout className="h-4 w-4 text-primary" />
            <span>
              <strong className="text-foreground">{fmt(totalHa)} ha</strong> · dose/ha × área ×
              nº de aplicações
            </span>
          </div>
        </div>
        <div className="p-5">
          <PurchaseListItemsEditor items={items} setItems={setItems} totalHa={totalHa} />
        </div>
      </section>

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
      <div className="mb-6 flex min-w-0 items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShoppingCart className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Revisão
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-foreground">
            Confirme a lista
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Verifique os produtos antes de salvar.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Produtor" value={producerName} />
        <SummaryCard label="Talhões" value={String(plots.length)} />
        <SummaryCard label="Área total" value={`${fmt(totalHa)} ha`} />
      </div>

      <div className="mt-6 rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {listName || "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {CROP_LABELS[crop as keyof typeof CROP_LABELS] ?? crop} ·{" "}
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
        back={
          <Button variant="ghost" onClick={onBack} size="lg" className="gap-2">
            Voltar
          </Button>
        }
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
