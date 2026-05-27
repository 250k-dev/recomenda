"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Sprout,
  CalendarDays,
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  Clock,
  Droplet,
} from "lucide-react";
import { NativeSelect } from "@/components/ui/native-select";
import { DoseUnitSelect } from "@/components/ui/dose-unit-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocalCatalog, useGlobalCatalog, queryKeys } from "@/lib/api/hooks";
import {
  createPurchaseList,
  type PurchaseListItemInput,
  type Product,
} from "@/lib/api/client";
import { cn } from "@/lib/utils";

export type WizardPlot = {
  id: string;
  name: string;
  area: number;
  farmId: string;
  farmName: string;
};

export type SeasonSetupWizardProps = {
  producerId: string;
  producerName: string;
  plots: WizardPlot[];
  farmName?: string;
  seasonId?: string | null;
  onComplete: () => void;
  onCancel: () => void;
  successRedirectLabel?: string;
};

type ListItem = {
  key: string;
  productId: string;
  productName: string;
  stage: string;
  dose: string;
  unit: string;
  nApps: string;
  stock: string;
  price: string;
};
type PlotSchedule = {
  plotId: string;
  plantingDate: string;
  desiccationDate: string;
  cycleDays: string;
};
type TimingTrigger =
  | "DAYS_AFTER_PLANTING"
  | "DAYS_AFTER_DESICCATION"
  | "DAYS_AFTER_TASSELING"
  | "FIXED_DATE_OFFSET";
type TimingStage = {
  key: string;
  name: string;
  trigger: TimingTrigger;
  startDays: string;
  farmId: string;
  plotId: string;
  productKey: string;
  dose: string;
};

const TRIGGER_LABELS: Record<TimingTrigger, string> = {
  DAYS_AFTER_PLANTING: "Dias após plantio",
  DAYS_AFTER_DESICCATION: "Dias após dessecação",
  DAYS_AFTER_TASSELING: "Dias após pendoamento",
  FIXED_DATE_OFFSET: "Offset de data fixa",
};

function createEmptyTimingStage(plots: WizardPlot[], key: string): TimingStage {
  const firstPlot = plots[0];
  return {
    key,
    name: "",
    trigger: "DAYS_AFTER_PLANTING",
    startDays: "",
    farmId: firstPlot?.farmId ?? "",
    plotId: firstPlot?.id ?? "",
    productKey: "",
    dose: "",
  };
}
const STAGES = [
  "Dessecação",
  "Pós-emergência",
  "Fungicida V4",
  "Fungicida V6",
  "Fungicida VT",
  "Inseticida",
  "Foliar",
  "Outra",
];
const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
function StepHeader({
  title,
  subtitle,
  onBack,
  backLabel = "Voltar",
}: {
  title: string;
  subtitle: string;
  onBack?: () => void;
  backLabel?: string;
}) {
  return (
    <div className="mb-8">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </button>
      ) : null}
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {title}
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {subtitle}
      </p>
    </div>
  );
}

function Field({
  htmlFor,
  label,
  hint,
  children,
}: {
  htmlFor?: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-foreground">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      {message}
    </div>
  );
}

function StepFooter({
  back,
  primary,
  secondary,
}: {
  back?: ReactNode;
  primary: ReactNode;
  secondary?: ReactNode;
}) {
  return (
    <div className="sticky bottom-0 mt-10 -mx-4 border-t bg-background/95 px-4 py-4 backdrop-blur sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12">
      <div className="flex flex-wrap items-center gap-2">
        {back}
        <div className="flex-1" />
        {secondary}
        {primary}
      </div>
    </div>
  );
}

function ContextBadge({
  tone,
  children,
}: {
  tone: "primary" | "sky";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        tone === "primary" && "bg-primary/10 text-primary",
        tone === "sky" && "bg-sky-100 text-sky-600",
      )}
    >
      {children}
    </span>
  );
}

const WIZARD_STEPS = 4;

export function SeasonSetupWizard({
  producerId,
  producerName,
  plots,
  farmName,
  seasonId,
  onComplete,
  onCancel,
  onStepChange,
  successRedirectLabel = "Ir para a fazenda",
}: SeasonSetupWizardProps & { onStepChange?: (step: number) => void }) {
  const [step, setStep] = useState(1);
  const [crop, setCrop] = useState<"SOYBEAN" | "CORN">("SOYBEAN");
  const [listName, setListName] = useState("");
  const [variety, setVariety] = useState("");
  const [items, setItems] = useState<ListItem[]>([]);
  const [schedules, setSchedules] = useState<PlotSchedule[]>([]);
  const [timingName, setTimingName] = useState("");
  const [stages, setStages] = useState<TimingStage[]>([]);

  const totalHa = useMemo(
    () => plots.reduce((s, p) => s + p.area, 0),
    [plots],
  );

  const goToPlantationStep = () => {
    setSchedules(
      plots.map((p) => ({
        plotId: p.id,
        plantingDate: "",
        desiccationDate: "",
        cycleDays: "",
      })),
    );
    setStep(2);
    onStepChange?.(6);
  };

  const goToSeasonStep = () => {
    if (stages.length === 0) {
      setStages([createEmptyTimingStage(plots, "s-1")]);
    }
    if (!timingName.trim()) {
      setTimingName(
        listName.trim() || (crop === "CORN" ? "Cronograma Milho" : "Cronograma Soja"),
      );
    }
    setStep(3);
    onStepChange?.(5);
  };

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
          onBack={() => { onStepChange?.(4); onCancel(); }}
          onNext={goToPlantationStep}
        />
      )}
      {step === 2 && (
        <StepPlantation
          plots={plots}
          farmName={farmName}
          schedules={schedules}
          setSchedules={setSchedules}
          onBack={() => { setStep(1); onStepChange?.(4); }}
          onNext={goToSeasonStep}
        />
      )}
      {step === 3 && (
        <StepSeason
          plots={plots}
          farmName={farmName}
          schedules={schedules}
          setSchedules={setSchedules}
          crop={crop}
          timingName={timingName}
          setTimingName={setTimingName}
          stages={stages}
          setStages={setStages}
          items={items}
          setItems={setItems}
          onBack={() => { setStep(2); onStepChange?.(6); }}
          onNext={() => { setStep(4); onStepChange?.(7); }}
        />
      )}
      {step === 4 && (
        <StepReview
          producerId={producerId}
          producerName={producerName}
          plots={plots}
          crop={crop}
          listName={listName}
          variety={variety}
          items={items}
          schedules={schedules}
          timingName={timingName}
          stages={stages}
          totalHa={totalHa}
          seasonId={seasonId ?? null}
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
  variety,
  setVariety,
  items,
  setItems,
  totalHa,
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
        title="Lista de compra da safra"
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
        Área total da safra:{" "}
        <strong className="text-foreground">{fmt(totalHa)} ha</strong>
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

function ProductPicker({
  value,
  items,
  setItems,
  onChange,
}: {
  value: string;
  items: ListItem[];
  setItems: React.Dispatch<React.SetStateAction<ListItem[]>>;
  onChange: (productKey: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [addMode, setAddMode] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemKeyRef = useRef(0);

  const nextItemKey = () => {
    itemKeyRef.current += 1;
    return `i-${itemKeyRef.current}`;
  };

  const { data: globalCatalogData } = useGlobalCatalog();
  const { data: localCatalogData } = useLocalCatalog();

  const selected = items.find((it) => it.key === value);
  const localProducts = localCatalogData?.data ?? [];

  const normalizedQuery = query.trim().toLowerCase();

  const listMatches = useMemo(() => {
    if (addMode) return [];
    return items.filter(
      (it) =>
        it.productName &&
        (!normalizedQuery || it.productName.toLowerCase().includes(normalizedQuery)),
    );
  }, [items, normalizedQuery, addMode]);

  const globalMatches = useMemo(() => {
    if (!addMode) return [];
    const products = globalCatalogData?.data ?? [];
    return products
      .filter(
        (p) => !normalizedQuery || p.name.toLowerCase().includes(normalizedQuery),
      )
      .slice(0, 10);
  }, [globalCatalogData?.data, normalizedQuery, addMode]);

  const showCustomAdd =
    addMode &&
    normalizedQuery.length > 0 &&
    !globalMatches.some((p) => p.name.toLowerCase() === normalizedQuery);

  const appendItem = (item: ListItem) => {
    setItems((prev) => [...prev, item]);
    onChange(item.key);
    setOpen(false);
    setQuery("");
    setAddMode(false);
  };

  const selectListItem = (key: string) => {
    onChange(key);
    setOpen(false);
    setQuery("");
    setAddMode(false);
  };

  const selectGlobalProduct = (product: Product) => {
    const existing = items.find(
      (it) => it.productName.toLowerCase() === product.name.toLowerCase(),
    );
    if (existing) {
      selectListItem(existing.key);
      return;
    }

    const localMatch = localProducts.find(
      (lp) => lp.name.toLowerCase() === product.name.toLowerCase(),
    );

    appendItem({
      key: nextItemKey(),
      productId: localMatch?.id ?? "",
      productName: product.name,
      stage: STAGES[0],
      dose: "",
      unit: product.dose_unit ?? "L",
      nApps: "1",
      stock: "0",
      price: "",
    });
  };

  const addCustomProduct = () => {
    const name = query.trim();
    if (!name) return;

    const existing = items.find((it) => it.productName.toLowerCase() === name.toLowerCase());
    if (existing) {
      selectListItem(existing.key);
      return;
    }

    appendItem({
      key: nextItemKey(),
      productId: "",
      productName: name,
      stage: STAGES[0],
      dose: "",
      unit: "L",
      nApps: "1",
      stock: "0",
      price: "",
    });
  };

  const displayValue = open ? query : (selected?.productName ?? "");

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={displayValue}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!open) setOpen(true);
          if (addMode && !e.target.value) setAddMode(false);
        }}
        onFocus={() => {
          setOpen(true);
          setQuery(selected?.productName ?? "");
        }}
        onBlur={(e) => {
          if (containerRef.current?.contains(e.relatedTarget as Node)) return;
          setTimeout(() => {
            setOpen(false);
            setQuery("");
            setAddMode(false);
          }, 150);
        }}
        placeholder="Buscar produto…"
        className="h-9"
      />

      {open ? (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover py-1 shadow-md">
          {!addMode ? (
            <>
              {listMatches.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  {normalizedQuery
                    ? "Nenhum produto na lista de compra."
                    : "Nenhum produto na lista ainda."}
                </p>
              ) : (
                listMatches.map((it) => (
                  <button
                    key={it.key}
                    type="button"
                    className={cn(
                      "flex w-full px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                      it.key === value && "bg-accent/60 font-medium",
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectListItem(it.key)}
                  >
                    {it.productName}
                  </button>
                ))
              )}
              <button
                type="button"
                className="flex w-full items-center gap-1.5 border-t px-3 py-2 text-left text-sm text-primary transition-colors hover:bg-accent"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setAddMode(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar produto
              </button>
            </>
          ) : (
            <>
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Catálogo global
              </p>
              {globalMatches.length === 0 && !showCustomAdd ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  {normalizedQuery ? "Nenhum produto encontrado." : "Digite para buscar no catálogo."}
                </p>
              ) : (
                globalMatches.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="flex w-full px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectGlobalProduct(p)}
                  >
                    {p.name}
                  </button>
                ))
              )}
              {showCustomAdd ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-1.5 border-t px-3 py-2 text-left text-sm text-primary transition-colors hover:bg-accent"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={addCustomProduct}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar &quot;{query.trim()}&quot;
                </button>
              ) : null}
              <button
                type="button"
                className="flex w-full border-t px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-accent"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setAddMode(false);
                  setQuery("");
                }}
              >
                Voltar à lista de compra
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
function StepPlantation({
  plots,
  farmName,
  schedules,
  setSchedules,
  onBack,
  onNext,
}: {
  plots: WizardPlot[];
  farmName?: string;
  schedules: PlotSchedule[];
  setSchedules: React.Dispatch<React.SetStateAction<PlotSchedule[]>>;
  onBack: () => void;
  onNext: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const farms = useMemo(() => {
    const map = new Map<string, string>();
    plots.forEach((p) => map.set(p.farmId, p.farmName));
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [plots]);
  const hasMultipleFarms = farms.length > 1;

  const updateSchedule = (plotId: string, patch: Partial<PlotSchedule>) => {
    setSchedules((prev) => prev.map((s) => (s.plotId === plotId ? { ...s, ...patch } : s)));
  };

  const next = () => {
    setError(null);
    if (!plots.every((p) => schedules.find((s) => s.plotId === p.id)?.plantingDate)) {
      return setError("Informe a data de plantio de todos os talhões.");
    }
    onNext();
  };

  const totalHa = useMemo(() => plots.reduce((s, p) => s + p.area, 0), [plots]);

  return (
    <div className="flex flex-1 flex-col">
      <StepHeader
        title="Plantation"
        subtitle="Defina as datas de plantio, dessecação e ciclo para cada talhão."
        onBack={onBack}
        backLabel="Voltar à lista de compra"
      />

      <div className="mb-6 rounded-xl border bg-card p-4 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Talhões</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{plots.length}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Área total</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{totalHa.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ha</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fazenda</p>
            <p className="mt-1 text-lg font-semibold text-foreground text-ellipsis overflow-hidden">{farmName || (hasMultipleFarms ? "Múltiplas" : farms[0]?.name || "—")}</p>
          </div>
        </div>
      </div>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600">
            <CalendarDays className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              Datas por talhão
            </h3>
            <p className="text-sm text-muted-foreground">
              Dessecação (quando houver), plantio e ciclo de cada talhão.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {plots.map((p) => {
            const sch = schedules.find((s) => s.plotId === p.id);
            return (
              <div key={p.id} className="rounded-lg border bg-background p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Sprout className="h-3.5 w-3.5" />
                  </span>
                  <span className="font-medium text-foreground">{p.name}</span>
                  <span className="text-sm text-muted-foreground">
                    · {p.farmName} · {p.area.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ha
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Dessecação" hint="Opcional — costuma ocorrer antes do plantio.">
                    <Input
                      type="date"
                      value={sch?.desiccationDate ?? ""}
                      onChange={(e) => updateSchedule(p.id, { desiccationDate: e.target.value })}
                    />
                  </Field>
                  <Field label="Plantio">
                    <Input
                      type="date"
                      value={sch?.plantingDate ?? ""}
                      onChange={(e) => updateSchedule(p.id, { plantingDate: e.target.value })}
                    />
                  </Field>
                  <Field label="Ciclo (dias)">
                    <Input
                      type="number"
                      value={sch?.cycleDays ?? ""}
                      onChange={(e) => updateSchedule(p.id, { cycleDays: e.target.value })}
                      placeholder="Ex: 120"
                    />
                  </Field>
                </div>
              </div>
            );
          })}
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

function StepSeason({
  plots,
  farmName,
  schedules,
  setSchedules,
  crop,
  timingName,
  setTimingName,
  stages,
  setStages,
  items,
  setItems,
  onBack,
  onNext,
}: {
  plots: WizardPlot[];
  farmName?: string;
  schedules: PlotSchedule[];
  setSchedules: React.Dispatch<React.SetStateAction<PlotSchedule[]>>;
  crop: "SOYBEAN" | "CORN";
  timingName: string;
  setTimingName: (v: string) => void;
  stages: TimingStage[];
  setStages: React.Dispatch<React.SetStateAction<TimingStage[]>>;
  items: ListItem[];
  setItems: React.Dispatch<React.SetStateAction<ListItem[]>>;
  onBack: () => void;
  onNext: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const stageKeyRef = useRef(1);

  const farms = useMemo(() => {
    const map = new Map<string, string>();
    plots.forEach((p) => map.set(p.farmId, p.farmName));
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [plots]);
  const hasMultipleFarms = farms.length > 1;

  const updateStage = (key: string, patch: Partial<TimingStage>) => {
    setStages((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  };

  const onFarmChange = (key: string, farmId: string) => {
    const firstPlotOfFarm = plots.find((p) => p.farmId === farmId);
    updateStage(key, { farmId, plotId: firstPlotOfFarm?.id ?? "" });
  };

  const addStage = () => {
    stageKeyRef.current += 1;
    setStages((prev) => [
      ...prev,
      createEmptyTimingStage(plots, `s-${stageKeyRef.current}`),
    ]);
  };

  const removeStage = (key: string) => {
    setStages((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((s) => s.key !== key);
    });
  };

  const moveStage = (index: number, direction: -1 | 1) => {
    setStages((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const farmsLabel =
    farmName ?? farms.map((f) => f.name).join(" · ");

  const next = () => {
    setError(null);
    if (!timingName.trim()) return setError("Dê um nome para o cronograma da recomendação.");
    if (stages.length === 0) return setError("Adicione ao menos um estágio.");
    for (const s of stages) {
      if (!s.name.trim()) return setError("Todos os estágios precisam de nome.");
      if (!s.plotId) return setError("Selecione o talhão de todos os estágios.");
    }
    onNext();
  };

  return (
    <div className="flex flex-1 flex-col">
      <StepHeader
        title="Configurar a safra"
        subtitle="Defina o cronograma de aplicação (recomendação) e as datas de cada talhão. O cronograma é a base para alertas e relatórios."
        onBack={onBack}
        backLabel="Voltar à lista de compra"
      />

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Clock className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              Cronograma de aplicação
              {farmsLabel ? (
                <span className="font-normal text-muted-foreground"> · {farmsLabel}</span>
              ) : null}
            </h3>
            <p className="text-sm text-muted-foreground">
              {crop === "CORN" ? "Milho" : "Soja"} · cada estágio aponta para um talhão e um produto.
            </p>
          </div>
        </div>

        <div className="max-w-md">
          <Field htmlFor="timing-name" label="Nome da recomendação">
            <Input
              id="timing-name"
              value={timingName}
              onChange={(e) => setTimingName(e.target.value)}
              placeholder="Ex: Soja padrão 24/25"
            />
          </Field>
        </div>

        <ul className="mt-5 flex flex-col gap-2">
          {stages.map((s, index) => {
            const plotsOfFarm = plots.filter((p) => p.farmId === s.farmId);
            return (
              <li
                key={s.key}
                className="rounded-lg border bg-background p-3 shadow-xs transition-colors hover:border-primary/30"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  <Input
                    value={s.name}
                    onChange={(e) => updateStage(s.key, { name: e.target.value })}
                    placeholder="Ex: Fungicida V6"
                    className="h-9 flex-1 min-w-[160px]"
                  />
                  <div className="ml-auto flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveStage(index, -1)}
                      disabled={index === 0}
                      className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                      aria-label="Mover para cima"
                    >
                      <ArrowLeft className="h-4 w-4 rotate-90" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveStage(index, 1)}
                      disabled={index === stages.length - 1}
                      className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
                      aria-label="Mover para baixo"
                    >
                      <ArrowLeft className="h-4 w-4 -rotate-90" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeStage(s.key)}
                      disabled={stages.length <= 1}
                      className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                      aria-label="Remover estágio"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div
                  className={cn(
                    "mt-3 grid gap-3",
                    hasMultipleFarms ? "sm:grid-cols-6" : "sm:grid-cols-5",
                  )}
                >
                  {hasMultipleFarms ? (
                    <Field label="Fazenda">
                      <NativeSelect
                        value={s.farmId}
                        onChange={(e) => onFarmChange(s.key, e.target.value)}
                      >
                        {farms.map((f) => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </NativeSelect>
                    </Field>
                  ) : null}
                  <Field label="Talhão">
                    <NativeSelect
                      value={s.plotId}
                      onChange={(e) => updateStage(s.key, { plotId: e.target.value })}
                    >
                      {plotsOfFarm.length === 0 ? (
                        <option value="">—</option>
                      ) : (
                        plotsOfFarm.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))
                      )}
                    </NativeSelect>
                  </Field>
                  <Field label="Gatilho">
                    <NativeSelect
                      value={s.trigger}
                      onChange={(e) => updateStage(s.key, { trigger: e.target.value as TimingTrigger })}
                    >
                      {(Object.entries(TRIGGER_LABELS) as [TimingTrigger, string][]).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field label="Dias">
                    <Input
                      type="number"
                      value={s.startDays}
                      onChange={(e) => updateStage(s.key, { startDays: e.target.value })}
                    />
                  </Field>
                  <Field label="Produto">
                    <ProductPicker
                      value={s.productKey}
                      items={items}
                      setItems={setItems}
                      onChange={(productKey) => {
                        const prod = items.find((it) => it.key === productKey);
                        updateStage(s.key, {
                          productKey,
                          dose: s.dose || prod?.dose || "",
                        });
                      }}
                    />
                  </Field>
                  <Field label="Dosagem">
                    <Input
                      type="number"
                      step="0.01"
                      value={s.dose}
                      onChange={(e) => updateStage(s.key, { dose: e.target.value })}
                      placeholder={(() => {
                        const prod = items.find((it) => it.key === s.productKey);
                        return prod?.dose ? `${prod.dose} ${prod.unit}/ha` : "0,00";
                      })()}
                    />
                  </Field>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 flex justify-center py-2">
          <button
            type="button"
            onClick={addStage}
            className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-dashed border-primary/40 bg-primary/5 text-primary transition-all duration-200 hover:scale-105 hover:border-primary hover:bg-primary/10 hover:shadow-sm"
            aria-label="Adicionar estágio"
          >
            <Plus className="h-5 w-5" />
          </button>
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
  variety,
  items,
  schedules,
  timingName,
  stages,
  totalHa,
  seasonId,
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
  schedules: PlotSchedule[];
  timingName: string;
  stages: TimingStage[];
  totalHa: number;
  seasonId: string | null;
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
        season_id: seasonId ?? null,
        plots: schedules.map((s) => ({
          plot_id: s.plotId,
          planting_date: s.plantingDate || null,
          desiccation_date: s.desiccationDate || null,
          cycle_days: s.cycleDays ? Number(s.cycleDays) : null,
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
          Safra configurada
        </h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          A lista de compra e o cronograma de{" "}
          <strong className="text-foreground">{producerName}</strong> foram salvos.
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
        title="Revisão final"
        subtitle="Confira os dados antes de concluir. Você poderá compartilhar a recomendação depois."
        onBack={onBack}
        backLabel="Voltar à safra"
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

      <div className="mt-6 rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Clock className="h-3.5 w-3.5" />
            </span>
            <p className="text-sm font-semibold text-foreground">
              Recomendação · {timingName || "—"}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {stages.length} {stages.length === 1 ? "estágio" : "estágios"}
          </p>
        </div>
        <ol className="mt-3 flex flex-col gap-1.5">
          {stages.map((s, i) => {
            const plot = plots.find((p) => p.id === s.plotId);
            const product = items.find((it) => it.key === s.productKey);
            return (
              <li
                key={s.key}
                className="flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/40"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                  {i + 1}
                </span>
                <span className="font-medium text-foreground">{s.name || "Sem nome"}</span>
                <span className="text-xs text-muted-foreground">
                  · {plot ? `${plot.farmName} / ${plot.name}` : "Talhão —"}
                </span>
                <span className="text-xs text-muted-foreground">
                  · {TRIGGER_LABELS[s.trigger]} {s.startDays}d
                </span>
                {product?.productName ? (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    <Droplet className="h-3 w-3" />
                    {product.productName}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>

      {error ? (
        <div className="mt-4 max-w-xl">
          <FieldError message={error} />
        </div>
      ) : null}

      <StepFooter
        primary={
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="gap-2">
            <Check className="h-4 w-4" />
            {mutation.isPending ? "Salvando…" : "Concluir"}
          </Button>
        }
      />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight text-foreground">{value}</p>
    </div>
  );
}

function extractError(e: unknown): string {
  if (e && typeof e === "object" && "response" in e) {
    const resp = (e as { response?: { data?: { message?: string } } }).response;
    if (resp?.data?.message) return resp.data.message;
  }
  if (e instanceof Error) return e.message;
  return "Não foi possível concluir. Tente novamente.";
}
