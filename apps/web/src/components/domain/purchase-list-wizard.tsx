"use client";

import { routes } from "@recomenda/config";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check,
  Save,
  Sprout,
  ArrowRight,
  ArrowLeft,
  ShoppingCart,
  Leaf,
  Type,
  Target,
  Loader2,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  readLocalDraft,
  clearLocalDraft,
  useLocalDraft,
} from "@recomenda/api-hooks/use-local-draft";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PurchaseListItemsEditor } from "@/components/domain/purchase-list-items-editor";
import {
  useCurrencyStore,
  DEFAULT_GRAIN_PRICE_BRL,
  DEFAULT_SPACING_M,
} from "@/stores/currency";
import {
  CategoryMetaProgress,
  resolveTotalTargetScHa,
  TOTAL_SC_HA_KEY,
} from "@/components/domain/category-meta-progress";
import {
  createPurchaseList,
  updatePurchaseList,
  type PurchaseListDetail,
  type PurchaseListInput,
} from "@recomenda/api";
import { detailItemToListItem } from "@recomenda/domain/purchase-list/breakdown";
import { useUnsavedChangesWarning } from "@recomenda/api-hooks/use-unsaved-changes-warning";
import {
  queryKeys,
  usePurchaseListTemplates,
} from "@recomenda/api-hooks";
import { SavePurchaseListTemplateButton } from "@/components/domain/save-purchase-list-template-dialog";
import { CROP_LABELS } from "@recomenda/utils";
import {
  FieldError,
  StepFooter,
  SummaryCard,
  fmt,
  extractError,
  type WizardPlot,
} from "@/components/domain/season/_shared";
import {
  listItemToBuy,
  listItemToPayload,
  validateListItems,
  type ListItem,
} from "@recomenda/domain/purchase-list/list-item";

export type PurchaseListWizardProps = {
  producerId: string;
  producerName: string;
  plots: WizardPlot[];
  farmName?: string;
  /** Safra da fazenda dona da lista (fluxo novo: uma lista única por safra). */
  cycleId?: string | null;
  /** Rascunho salvo no servidor a ser retomado (reabre o wizard preenchido). */
  draftList?: PurchaseListDetail | null;
  onComplete: () => void;
  onCancel: () => void;
  successRedirectLabel?: string;
};

const WIZARD_STEPS = 3;

/** Progresso do wizard persistido localmente (rascunho). */
type WizardDraft = {
  step: number;
  crop: "SOYBEAN" | "CORN" | "ANY";
  listName: string;
  items: ListItem[];
  targets: Record<string, number>;
};

/** Se o erro for "a safra já tem lista" (409), devolve o id da lista existente. */
function existingCycleListId(e: unknown): string | null {
  if (e && typeof e === "object" && "response" in e) {
    const data = (
      e as {
        response?: {
          data?: { code?: string; details?: { purchase_list_id?: string } };
        };
      }
    ).response?.data;
    if (data?.code === "CYCLE_LIST_EXISTS" && data.details?.purchase_list_id) {
      return data.details.purchase_list_id;
    }
  }
  return null;
}

/** Botão "Salvar rascunho" — disponível em todos os passos do wizard. */
function SaveDraftButton({
  onSaveDraft,
  savingDraft,
  size = "lg",
}: {
  onSaveDraft: () => void;
  savingDraft: boolean;
  size?: "default" | "lg";
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      className="gap-2"
      onClick={onSaveDraft}
      disabled={savingDraft}
    >
      {savingDraft ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Save className="h-4 w-4" />
      )}
      Salvar rascunho
    </Button>
  );
}

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

/** Monta o payload da lista (rascunho ou finalizada) a partir do estado do wizard. */
function buildListPayload(opts: {
  producerId: string;
  crop: string;
  cycleId: string | null;
  listName: string;
  items: ListItem[];
  targets: Record<string, number>;
  plots: WizardPlot[];
  status: "draft" | "active";
}): PurchaseListInput {
  const {
    fxRate: fxRaw,
    grainPrice: grainRaw,
    spacing: spacingRaw,
  } = useCurrencyStore.getState();
  const cleanedTargets = Object.fromEntries(
    Object.entries(opts.targets).filter(([, v]) => v > 0),
  );
  return {
    producer_id: opts.producerId,
    crop: opts.crop,
    cycle_id: opts.cycleId,
    name: opts.listName,
    season_id: null,
    fx_rate_usd_brl: fxRaw ? Number(fxRaw) : null,
    grain_price_brl: grainRaw ? Number(grainRaw) : DEFAULT_GRAIN_PRICE_BRL,
    spacing_m: spacingRaw ? Number(spacingRaw) : DEFAULT_SPACING_M,
    category_targets: cleanedTargets,
    status: opts.status,
    plots: opts.plots.map((p) => ({
      plot_id: p.id,
      planting_date: null,
      desiccation_date: null,
      cycle_days: null,
    })),
    items: opts.items.map((it) => listItemToPayload(it, opts.crop)),
  };
}

export function PurchaseListWizard({
  producerId,
  producerName,
  plots,
  farmName,
  cycleId,
  draftList,
  onComplete,
  onCancel,
  successRedirectLabel = "Ir para o produtor",
}: PurchaseListWizardProps) {
  // Rascunho local: restaura o progresso ao voltar/recarregar (e sobrevive a
  // queda de internet). Some quando a lista é criada de verdade.
  const draftKey = `pl-draft:${cycleId ?? producerId ?? "new"}`;
  const savedDraft = useMemo(
    () => readLocalDraft<WizardDraft>(draftKey),
    [draftKey],
  );

  // O rascunho LOCAL (localStorage, atualizado a cada digitação e só apagado após
  // salvar de verdade) é o estado mais fresco — tem prioridade sobre o rascunho do
  // servidor, senão reabrir um rascunho poderia descartar o que ainda não subiu.
  const [step, setStep] = useState(savedDraft?.step ?? (draftList ? 2 : 1));
  const [crop, setCrop] = useState<"SOYBEAN" | "CORN" | "ANY">(
    savedDraft?.crop ?? (draftList?.crop as "SOYBEAN" | "CORN" | "ANY") ?? "SOYBEAN",
  );
  const [listName, setListName] = useState(
    savedDraft?.listName ?? draftList?.name ?? "",
  );
  const [items, setItems] = useState<ListItem[]>(
    savedDraft?.items ?? (draftList ? draftList.items.map(detailItemToListItem) : []),
  );
  const [targets, setTargets] = useState<Record<string, number>>(
    savedDraft?.targets ?? draftList?.category_targets ?? {},
  );
  const [saved, setSaved] = useState(false);
  // Id da lista no servidor: já existe se estamos retomando um rascunho; passa a
  // existir na primeira vez que "Salvar rascunho" é clicado.
  const [listId, setListId] = useState<string | null>(draftList?.id ?? null);
  const [savingDraft, setSavingDraft] = useState(false);

  const queryClient = useQueryClient();
  const totalHa = useMemo(() => plots.reduce((s, p) => s + p.area, 0), [plots]);

  // Ao retomar um rascunho, carrega dólar/saca/espaçamento salvos nele na store.
  useEffect(() => {
    if (!draftList) return;
    const store = useCurrencyStore.getState();
    if (draftList.fx_rate_usd_brl != null) {
      store.setFxRate(String(draftList.fx_rate_usd_brl));
    }
    store.setGrainPrice(
      draftList.grain_price_brl != null ? String(draftList.grain_price_brl) : "",
    );
    store.setSpacing(draftList.spacing_m != null ? String(draftList.spacing_m) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftList?.id]);

  // Autosave silencioso: salva o progresso no fundo enquanto a lista não é criada.
  const draft: WizardDraft = { step, crop, listName, items, targets };
  useLocalDraft(draftKey, draft, !saved);

  // Trava contra perder trabalho: avisa antes de fechar/recarregar/sair com itens
  // não salvos. O rascunho local acima restaura o progresso ao voltar.
  const hasUnsavedProgress =
    !saved &&
    (items.length > 0 ||
      listName.trim() !== "" ||
      Object.values(targets).some((v) => (v ?? 0) > 0));
  useUnsavedChangesWarning(hasUnsavedProgress);

  // Ao criar a lista: para de autosalvar e apaga o rascunho.
  const onSaved = () => {
    setSaved(true);
    clearLocalDraft(draftKey);
  };

  const invalidateAfterSave = () => {
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
  };

  // "Salvar rascunho": grava a lista como `draft` no servidor (cria na 1ª vez,
  // atualiza depois) e volta para a safra. Ao reabrir a lista, cai no rascunho.
  const saveDraft = async () => {
    if (savingDraft) return;
    setSavingDraft(true);
    try {
      const payload = buildListPayload({
        producerId,
        crop,
        cycleId: cycleId ?? null,
        listName: listName.trim() || "Rascunho de lista",
        items,
        targets,
        plots,
        status: "draft",
      });
      let saved;
      if (listId) {
        saved = await updatePurchaseList(listId, payload);
      } else {
        try {
          saved = await createPurchaseList(payload);
        } catch (e) {
          // Já existe uma lista para a safra (ex.: rascunho criado antes): atualiza.
          const existing = existingCycleListId(e);
          if (!existing) throw e;
          saved = await updatePurchaseList(existing, payload);
        }
      }
      setListId(saved.id);
      onSaved();
      invalidateAfterSave();
      toast.success("Rascunho salvo. É só voltar aqui para continuar.");
      onComplete();
    } catch (e) {
      toast.error(extractError(e));
    } finally {
      setSavingDraft(false);
    }
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
        <StepTargets
          targets={targets}
          setTargets={setTargets}
          totalHa={totalHa}
          onBack={onCancel}
          onNext={() => setStep(2)}
          onSaveDraft={saveDraft}
          savingDraft={savingDraft}
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
          targets={targets}
          totalHa={totalHa}
          farmName={farmName}
          onBack={() => setStep(1)}
          onEditTargets={() => setStep(1)}
          onNext={() => setStep(3)}
          onSaveDraft={saveDraft}
          savingDraft={savingDraft}
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
          listId={listId}
          successRedirectLabel={successRedirectLabel}
          onBack={() => setStep(2)}
          onComplete={onComplete}
          onSaved={onSaved}
          onSaveDraft={saveDraft}
          savingDraft={savingDraft}
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
  targets,
  totalHa,
  farmName,
  onBack,
  onEditTargets,
  onNext,
  onSaveDraft,
  savingDraft,
}: {
  crop: string;
  setCrop: (v: string) => void;
  listName: string;
  setListName: (v: string) => void;
  items: ListItem[];
  setItems: React.Dispatch<React.SetStateAction<ListItem[]>>;
  targets: Record<string, number>;
  totalHa: number;
  farmName?: string;
  onBack: () => void;
  onEditTargets: () => void;
  onNext: () => void;
  onSaveDraft: () => void;
  savingDraft: boolean;
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

      {items.length === 0 ? (
        <section className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Começar de um template</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {templates && templates.length > 0
                  ? "Importe um modelo pronto e ajuste o que precisar. Você ainda escolhe os talhões no próximo passo."
                  : "Você ainda não tem templates. Crie um para reaproveitar listas em outras safras."}
              </p>
            </div>
            <Button asChild type="button" variant="outline" size="sm" className="gap-1.5">
              <Link href={routes.templatesDeCompra} target="_blank" rel="noopener noreferrer">
                <Settings2 className="h-4 w-4" />
                Criar/gerenciar templates
              </Link>
            </Button>
          </div>
          {templates && templates.length > 0 ? (
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
          ) : null}
        </section>
      ) : null}

      {/* Metas definidas no passo anterior — o agrônomo acompanha o Real × Meta
          enquanto monta a lista, e pode voltar para editá-las. */}
      {Object.values(targets).some((v) => (v ?? 0) > 0) ? (
        <div className="mb-6">
          <CategoryMetaProgress items={items} totalHa={totalHa} targets={targets} />
          <div className="mt-2 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={onEditTargets}
            >
              <Target className="h-4 w-4" />
              Editar metas
            </Button>
          </div>
        </div>
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
        secondary={
          <SaveDraftButton
            onSaveDraft={onSaveDraft}
            savingDraft={savingDraft}
            size="default"
          />
        }
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

function StepTargets({
  targets,
  setTargets,
  totalHa,
  onBack,
  onNext,
  onSaveDraft,
  savingDraft,
}: {
  targets: Record<string, number>;
  setTargets: (next: Record<string, number>) => void;
  totalHa: number;
  onBack: () => void;
  onNext: () => void;
  onSaveDraft: () => void;
  savingDraft: boolean;
}) {
  // Pergunta antes de montar a lista: quer definir meta? Se já há meta
  // (voltou ao passo), abre direto no campo.
  const [enabled, setEnabled] = useState(
    Object.values(targets).some((v) => (v ?? 0) > 0),
  );
  const num = (n: number, d = 2) =>
    n.toLocaleString("pt-BR", { maximumFractionDigits: d });

  // Pré-preenche em sc/ha a partir de TOTAL_SC_HA, TOTAL legado (÷ ha) ou
  // soma das metas por categoria. Ao editar, grava só TOTAL_SC_HA.
  const targetScHa = resolveTotalTargetScHa(targets, totalHa);
  const displayScHa =
    targetScHa > 0
      ? Number.isInteger(targetScHa)
        ? String(targetScHa)
        : String(Number(targetScHa.toFixed(2)))
      : "";

  const setTargetScHa = (value: string) => {
    const n = value === "" ? 0 : Number(value);
    setTargets({ [TOTAL_SC_HA_KEY]: Number.isFinite(n) && n > 0 ? n : 0 });
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
            Antes de montar a lista, quer definir uma meta?
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Diga a meta de custo em sacas por hectare. Ao montar você acompanha o quanto já
            comprometeu e recebe um aviso se passar da meta. É opcional.
          </p>
        </div>
      </div>

      {!enabled ? (
        <section className="flex flex-col items-center gap-4 rounded-xl border bg-card px-6 py-10 text-center shadow-sm">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Target className="h-6 w-6" />
          </span>
          <p className="max-w-md text-sm text-muted-foreground">
            Você pode definir a meta em sc/ha agora, ou seguir direto para montar a lista e
            definir depois.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button size="lg" className="gap-2" onClick={() => setEnabled(true)}>
              <Target className="h-4 w-4" />
              Sim, definir meta
            </Button>
            <Button size="lg" variant="outline" className="gap-2" onClick={onNext}>
              Agora não
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      ) : (
        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="max-w-md space-y-2.5">
            <Label htmlFor="total-target" className="text-sm font-semibold text-foreground">
              Meta desejada (sc/ha)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="total-target"
                type="number"
                min="0"
                step="0.01"
                value={displayScHa}
                placeholder="Ex: 45"
                onChange={(e) => setTargetScHa(e.target.value)}
                className="h-12 max-w-[220px] text-right text-lg font-semibold tabular-nums"
                autoFocus
              />
              <span className="text-sm text-muted-foreground">sc/ha</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {targetScHa > 0 && totalHa > 0
                ? `≈ ${num(targetScHa * totalHa)} sacas totais nos ${num(totalHa)} ha da safra.`
                : "Compare com o custo em sc/ha que a lista calcula conforme você adiciona os produtos."}
            </p>
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
        secondary={
          <SaveDraftButton onSaveDraft={onSaveDraft} savingDraft={savingDraft} />
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
  listId,
  successRedirectLabel,
  onBack,
  onComplete,
  onSaved,
  onSaveDraft,
  savingDraft,
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
  /** Id da lista no servidor quando veio de um rascunho (finaliza via update). */
  listId: string | null;
  successRedirectLabel: string;
  onBack: () => void;
  onComplete: () => void;
  /** Chamado quando a lista é criada (ou já existia) — limpa o rascunho local. */
  onSaved: () => void;
  onSaveDraft: () => void;
  savingDraft: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Marca a lista como salva e atualiza os caches — usado tanto no sucesso quanto
  // quando o backend responde que a lista da safra JÁ existe (envio duplicado).
  const handleSaved = (listId: string) => {
    setSavedId(listId);
    setError(null);
    onSaved();
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
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = buildListPayload({
        producerId,
        crop,
        cycleId,
        listName,
        items,
        targets,
        plots,
        status: "active",
      });
      // Veio de um rascunho: finaliza o MESMO registro (draft → active).
      if (listId) return updatePurchaseList(listId, payload);
      try {
        return await createPurchaseList(payload);
      } catch (e) {
        // A safra já tem uma lista (ex.: rascunho criado em outra aba): finaliza-a.
        const existing = existingCycleListId(e);
        if (existing) return updatePurchaseList(existing, payload);
        throw e;
      }
    },
    onSuccess: (list) => handleSaved(list.id),
    onError: (e: unknown) => setError(extractError(e)),
  });

  const totalToBuy = items.reduce((s, it) => s + listItemToBuy(it, totalHa), 0);

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
            const toBuy = listItemToBuy(it, totalHa);
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

      {/* Card próprio (fora do rodapé): com 4 botões o rodapé quebrava o layout
          em telas menores, e o template merece explicação do que ele guarda. */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Reaproveitar esta lista</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Salve os produtos como template para importar em outras safras.
          </p>
        </div>
        <SavePurchaseListTemplateButton
          items={items}
          crop={crop}
          suggestedName={listName}
          size="sm"
          className="shrink-0"
        />
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
        secondary={
          <SaveDraftButton onSaveDraft={onSaveDraft} savingDraft={savingDraft} />
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
