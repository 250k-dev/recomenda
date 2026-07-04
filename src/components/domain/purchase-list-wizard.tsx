"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Sprout,
  ArrowRight,
  ArrowLeft,
  ShoppingCart,
  Leaf,
  Type,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PurchaseListItemsEditor } from "@/components/domain/purchase-list-items-editor";
import {
  useCurrencyStore,
  DEFAULT_GRAIN_PRICE_BRL,
  DEFAULT_SPACING_M,
} from "@/stores/currency";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/cost-plan/categories";
import { CategoryMetaProgress } from "@/components/domain/category-meta-progress";
import {
  createPurchaseList,
  type PurchaseListDetail,
  type PurchaseListItemInput,
} from "@/lib/api/client";
import { queryKeys, usePurchaseListTemplates } from "@/lib/api/hooks";
import { CROP_LABELS } from "@/lib/season-constants";
import {
  FieldError,
  StepFooter,
  SummaryCard,
  fmt,
  extractError,
  listItemToPayload,
  validateListItems,
  type ListItem,
  type WizardPlot,
} from "@/components/domain/season/_shared";

export type PurchaseListWizardProps = {
  producerId: string;
  producerName: string;
  plots: WizardPlot[];
  farmName?: string;
  /** Safra da fazenda dona da lista (fluxo novo: uma lista única por safra). */
  cycleId?: string | null;
  onComplete: () => void;
  onCancel: () => void;
  successRedirectLabel?: string;
};

const WIZARD_STEPS = 3;

/** Converte um item de template (PurchaseListDetail) no item do formulário. */
function templateItemToListItem(it: PurchaseListDetail["items"][number]): ListItem {
  return {
    key: `tpl-${it.id}-${Math.random().toString(36).slice(2, 8)}`,
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

export function PurchaseListWizard({
  producerId,
  producerName,
  plots,
  farmName,
  cycleId,
  onComplete,
  onCancel,
  successRedirectLabel = "Ir para o produtor",
}: PurchaseListWizardProps) {
  const [step, setStep] = useState(1);
  const [crop, setCrop] = useState<"SOYBEAN" | "CORN" | "ANY">("SOYBEAN");
  const [listName, setListName] = useState("");
  const [items, setItems] = useState<ListItem[]>([]);
  const [targets, setTargets] = useState<Record<string, number>>({});

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
        <StepTargets
          targets={targets}
          setTargets={setTargets}
          onBack={onCancel}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <StepList
          crop={crop}
          setCrop={(v) => setCrop(v as "SOYBEAN" | "CORN" | "ANY")}
          listName={listName}
          setListName={setListName}
          items={items}
          setItems={setItems}
          totalHa={totalHa}
          farmName={farmName}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}
      {step === 3 && (
        <StepReview
          producerId={producerId}
          producerName={producerName}
          plots={plots}
          crop={crop}
          cycleId={cycleId ?? null}
          listName={listName}
          items={items}
          targets={targets}
          totalHa={totalHa}
          successRedirectLabel={successRedirectLabel}
          onBack={() => setStep(2)}
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
  const { data: templates } = usePurchaseListTemplates();

  const importTemplate = (tpl: PurchaseListDetail) => {
    setCrop(tpl.crop ?? "ANY");
    setItems(tpl.items.map(templateItemToListItem));
  };

  const next = () => {
    setError(null);
    if (!listName.trim()) return setError("Dê um nome para a lista de compra.");
    const itemsError = validateListItems(items);
    if (itemsError) return setError(itemsError);
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
            <Label className="text-sm font-medium text-muted-foreground">
              Cultura(s)
            </Label>
            <div className="flex gap-2">
              {(["SOYBEAN", "CORN"] as const).map((c) => {
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
                      if (!nextSoja && !nextMilho) return; // mantém ao menos 1
                      setCrop(
                        nextSoja && nextMilho ? "ANY" : nextSoja ? "SOYBEAN" : "CORN",
                      );
                    }}
                  >
                    {CROP_LABELS[c]}
                  </Button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Selecione 1 ou 2 culturas. As categorias de variedade (cultivar de soja /
              híbrido de milho) aparecem conforme a escolha.
            </p>
          </div>
        </div>
      </section>

      {items.length === 0 && templates && templates.length > 0 ? (
        <section className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-semibold text-foreground">Começar de um template</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Importe um modelo pronto e ajuste o que precisar. Você ainda escolhe os talhões no
            próximo passo.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {templates.map((tpl) => (
              <Button
                key={tpl.id}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => importTemplate(tpl)}
              >
                {tpl.name}
                <span className="ml-1 text-muted-foreground">· {tpl.items.length}</span>
              </Button>
            ))}
          </div>
        </section>
      ) : null}

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
          <PurchaseListItemsEditor
            items={items}
            setItems={setItems}
            totalHa={totalHa}
            crop={crop as "SOYBEAN" | "CORN" | "ANY"}
          />
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

/** Categorias que o agrônomo pode orçar — antes de montar a lista (sem crop ainda). */
const META_CATEGORIES = [
  "CULTIVAR_SOJA",
  "HIBRIDO_MILHO",
  "FERTILIZER",
  "HERBICIDE",
  "FUNGICIDE",
  "INSECTICIDE",
  "BIOLOGICAL",
  "FOLIAR",
  "ADJUVANT",
];

function StepTargets({
  targets,
  setTargets,
  onBack,
  onNext,
}: {
  targets: Record<string, number>;
  setTargets: (next: Record<string, number>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  // Pergunta antes de montar a lista: quer definir metas? Se já há metas
  // (voltou ao passo), abre direto nos campos.
  const [enabled, setEnabled] = useState(
    Object.values(targets).some((v) => (v ?? 0) > 0),
  );
  const num = (n: number, d = 2) =>
    n.toLocaleString("pt-BR", { maximumFractionDigits: d });
  const totalDesejado = META_CATEGORIES.reduce((s, c) => s + (targets[c] ?? 0), 0);

  const setOne = (category: string, value: string) => {
    const n = value === "" ? 0 : Number(value);
    setTargets({ ...targets, [category]: Number.isFinite(n) ? n : 0 });
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-6 flex min-w-0 items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Target className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Metas
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-foreground">
            Antes de montar a lista, quer definir metas?
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Diga quanto pretende gastar por categoria (em sacas/ha). Ao montar a lista você
            acompanha o quanto já comprometeu e recebe um aviso se passar da meta. É opcional.
          </p>
        </div>
      </div>

      {!enabled ? (
        <section className="flex flex-col items-center gap-4 rounded-xl border bg-card px-6 py-10 text-center shadow-sm">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Target className="h-6 w-6" />
          </span>
          <p className="max-w-md text-sm text-muted-foreground">
            Você pode definir uma meta de gasto por categoria agora, ou seguir direto para
            montar a lista e definir depois.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button size="lg" className="gap-2" onClick={() => setEnabled(true)}>
              <Target className="h-4 w-4" />
              Sim, definir metas
            </Button>
            <Button size="lg" variant="outline" className="gap-2" onClick={onNext}>
              Agora não
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      ) : (
        <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b bg-muted/30 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Categoria</span>
            <span>Meta (sc/ha)</span>
          </div>
          <div className="flex flex-col gap-3.5 p-5">
            {META_CATEGORIES.map((category) => {
              const target = targets[category] ?? 0;
              const color = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.OTHER;
              return (
                <div
                  key={category}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="flex min-w-0 items-center gap-2 text-sm">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: color }}
                    />
                    <span className="truncate font-medium text-foreground">
                      {CATEGORY_LABELS[category] ?? category}
                    </span>
                  </span>
                  <Input
                    type="number"
                    step="0.1"
                    value={target ? String(target) : ""}
                    placeholder="meta"
                    onChange={(e) => setOne(category, e.target.value)}
                    className="h-8 w-20 px-2 text-right text-sm tabular-nums"
                  />
                </div>
              );
            })}
            <div className="mt-1 flex items-center justify-between border-t pt-3 text-sm">
              <span className="font-semibold text-foreground">Total</span>
              <span className="tabular-nums">
                <strong className="text-foreground">
                  {totalDesejado > 0 ? num(totalDesejado) : "—"}
                </strong>
                <span className="text-muted-foreground"> sc/ha</span>
              </span>
            </div>
          </div>
        </section>
      )}

      <StepFooter
        back={
          <Button variant="ghost" onClick={onBack} size="lg" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        }
        primary={
          enabled ? (
            <Button onClick={onNext} size="lg" className="gap-2">
              Próximo
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : undefined
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
  cycleId,
  listName,
  items,
  targets,
  totalHa,
  successRedirectLabel,
  onBack,
  onComplete,
}: {
  producerId: string;
  producerName: string;
  plots: WizardPlot[];
  crop: string;
  cycleId: string | null;
  listName: string;
  items: ListItem[];
  targets: Record<string, number>;
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
      const itemsPayload: PurchaseListItemInput[] = items.map((it) =>
        listItemToPayload(it, crop),
      );
      const {
        fxRate: fxRaw,
        grainPrice: grainRaw,
        spacing: spacingRaw,
      } = useCurrencyStore.getState();
      const cleanedTargets = Object.fromEntries(
        Object.entries(targets).filter(([, v]) => v > 0),
      );
      return createPurchaseList({
        producer_id: producerId,
        crop,
        cycle_id: cycleId,
        name: listName,
        season_id: null,
        fx_rate_usd_brl: fxRaw ? Number(fxRaw) : null,
        grain_price_brl: grainRaw ? Number(grainRaw) : DEFAULT_GRAIN_PRICE_BRL,
        spacing_m: spacingRaw ? Number(spacingRaw) : DEFAULT_SPACING_M,
        category_targets: cleanedTargets,
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
      if (cycleId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.cyclePurchaseList(cycleId),
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.cycleCostPlan(cycleId),
        });
        void queryClient.invalidateQueries({ queryKey: queryKeys.cycle(cycleId) });
        void queryClient.invalidateQueries({ queryKey: ["farm-cycles"] });
      }
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

      <CategoryMetaProgress
        items={items}
        totalHa={totalHa}
        targets={targets}
        className="mt-4"
      />

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
