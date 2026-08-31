"use client";

import { useMemo, useState } from "react";
import { Check, Copy, FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@recomenda/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@recomenda/ui/primitives/dialog";
import {
  buildMultiWhatsappMessage,
  type RecommendationShareData,
} from "@recomenda/domain/recommendations/share-message";
import {
  printRecommendations,
  type DocumentCover,
} from "@recomenda/domain/recommendations/print-document";
import { WhatsAppIcon } from "@recomenda/ui/assets/whatsapp-icon";
import {
  readPricePreference,
  writePricePreference,
} from "@/components/domain/export/price-preference";
import { cn } from "@recomenda/utils";

const APPLIED = new Set(["APPLIED_ON_TIME", "APPLIED_LATE"]);

export interface FarmExportItem {
  id: string;
  label: string;
  data: RecommendationShareData;
}

export function FarmSeasonsExportDialog({
  open,
  onOpenChange,
  farmName,
  contextLabel = "FAZENDA",
  isLoading = false,
  items,
  cover,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmName?: string | null;
  contextLabel?: string;
  isLoading?: boolean;
  items: FarmExportItem[];
  /** Capa do documento (números da safra/fazenda + consolidado). */
  cover?: DocumentCover | null;
}) {
  const [copied, setCopied] = useState(false);
  const [shareAll, setShareAll] = useState(true);
  const [selectedStageIds, setSelectedStageIds] = useState<Set<string>>(new Set());
  const [showPrices, setShowPrices] = useState(() => readPricePreference());
  // Só oferece a escolha quando há preço no payload (isto é, quem exporta tem
  // PRICE_VIEW). Sem isso o documento sai sem valores de qualquer forma.
  const canChoosePrices = items.some((item) => item.data.unitPriceByProduct);

  const allStageIds = useMemo(
    () => items.flatMap((i) => i.data.recommendations.map((rec) => rec.id)),
    [items],
  );
  const allStageKey = allStageIds.join("|");

  const [resetKey, setResetKey] = useState("");
  const nextResetKey = open ? allStageKey : "";
  if (nextResetKey !== resetKey) {
    setResetKey(nextResetKey);
    if (open) {
      setShareAll(true);
      setSelectedStageIds(new Set(allStageKey ? allStageKey.split("|") : []));
    }
  }

  const stageNames = useMemo(() => {
    const seen = new Map<string, string>();
    for (const item of items) {
      for (const rec of item.data.recommendations) {
        const key = rec.name.trim().toLocaleLowerCase("pt-BR");
        if (key && !seen.has(key)) seen.set(key, rec.name.trim());
      }
    }
    return [...seen.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [items]);

  const selectedItems = useMemo(() => {
    if (shareAll) return items.filter((i) => i.data.recommendations.length > 0);

    return items
      .map((item) => {
        const recommendations = item.data.recommendations.filter((rec) =>
          selectedStageIds.has(rec.id),
        );
        const done = recommendations.filter((rec) => APPLIED.has(rec.status)).length;
        return {
          ...item,
          data: {
            ...item.data,
            recommendations,
            done,
            total: recommendations.length,
          },
        };
      })
      .filter((item) => item.data.recommendations.length > 0);
  }, [items, selectedStageIds, shareAll]);
  const message = selectedItems.length
    ? buildMultiWhatsappMessage(
        farmName,
        selectedItems.map((i) => i.data),
        contextLabel,
      )
    : "";
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

  const toggleStage = (id: string) => {
    setShareAll(false);
    setSelectedStageIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /** Talhões agrupados pela fazenda a que pertencem (safra multi-fazenda). */
  const farmGroups = useMemo(() => {
    const map = new Map<string, { farmName: string; items: FarmExportItem[] }>();
    for (const item of items) {
      const farmName = item.data.spec?.farmName ?? "Sem fazenda";
      const group = map.get(farmName);
      if (group) group.items.push(item);
      else map.set(farmName, { farmName, items: [item] });
    }
    return [...map.values()].sort((a, b) =>
      a.farmName.localeCompare(b.farmName, "pt-BR"),
    );
  }, [items]);

  /** Marca/desmarca todas as etapas de todos os talhões de uma fazenda. */
  const setFarmSelected = (groupItems: FarmExportItem[], on: boolean) => {
    setShareAll(false);
    setSelectedStageIds((prev) => {
      const next = new Set(prev);
      for (const item of groupItems) {
        for (const rec of item.data.recommendations) {
          if (on) next.add(rec.id);
          else next.delete(rec.id);
        }
      }
      return next;
    });
  };

  const setSeasonSelected = (item: FarmExportItem, on: boolean) => {
    setShareAll(false);
    setSelectedStageIds((prev) => {
      const next = new Set(prev);
      for (const rec of item.data.recommendations) {
        if (on) next.add(rec.id);
        else next.delete(rec.id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setShareAll(false);
    setSelectedStageIds(new Set(allStageIds));
  };

  const clearSelection = () => {
    setShareAll(false);
    setSelectedStageIds(new Set());
  };

  const selectStageByName = (stageKey: string) => {
    setShareAll(false);
    const ids = items.flatMap((item) =>
      item.data.recommendations
        .filter((rec) => rec.name.trim().toLocaleLowerCase("pt-BR") === stageKey)
        .map((rec) => rec.id),
    );
    setSelectedStageIds(new Set(ids));
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast.success("Texto copiado para a area de transferencia.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Nao foi possivel copiar. Copie o texto manualmente.");
    }
  };

  const handlePrint = () => {
    onOpenChange(false);
    window.setTimeout(
      () =>
        printRecommendations(
          selectedItems.map((i) => i.data),
          `Recomendações - ${farmName ?? ""}`,
          { showPrices: canChoosePrices && showPrices, cover },
        ),
      250,
    );
  };

  const togglePrices = (value: boolean) => {
    setShowPrices(value);
    writePricePreference(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Exportar safra</DialogTitle>
          <DialogDescription>
            Exporte a safra completa ou escolha etapas específicas dentro dos talhões.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto px-6 py-5">
          {/* Primeiro item do modal: é a decisão que muda o que sai no documento. */}
          {canChoosePrices ? (
            <section className="rounded-xl border border-border bg-surface-2 p-4">
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-primary"
                  checked={showPrices}
                  onChange={(e) => togglePrices(e.target.checked)}
                />
                <span className="text-sm">
                  <span className="font-semibold text-text-strong">
                    Incluir preços e custos
                  </span>
                  <span className="mt-0.5 block text-[13px] text-muted-foreground">
                    Custo por talhão e total da safra. Desmarque para entregar só a
                    parte técnica.
                  </span>
                </span>
              </label>
            </section>
          ) : null}

          <section className="rounded-xl border border-border bg-surface-2 p-4">
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={shareAll}
                onChange={(e) => {
                  setShareAll(e.target.checked);
                  if (e.target.checked) setSelectedStageIds(new Set(allStageIds));
                }}
              />
              <span className="text-sm font-semibold text-text-strong">
                Exportar safra completa
              </span>
            </label>

            {isLoading ? (
              <p className="mt-3 text-[13px] text-muted-foreground">
                Carregando cronogramas dos talhões...
              </p>
            ) : !shareAll ? (
              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    Selecione as etapas que deseja exportar em cada talhão.
                  </p>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      className="text-xs font-medium text-primary-strong hover:underline"
                      onClick={selectAll}
                    >
                      Todas
                    </button>
                    <span className="text-muted-foreground">·</span>
                    <button
                      type="button"
                      className="text-xs font-medium text-primary-strong hover:underline"
                      onClick={clearSelection}
                    >
                      Nenhuma
                    </button>
                  </div>
                </div>

                {stageNames.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {stageNames.map((stage) => (
                      <button
                        key={stage.key}
                        type="button"
                        className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
                        onClick={() => selectStageByName(stage.key)}
                      >
                        {stage.label}
                      </button>
                    ))}
                  </div>
                ) : null}

                {items.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">
                    Nenhuma safra com cronograma para exportar.
                  </p>
                ) : (
                  <div className="flex flex-col gap-4">
                    {farmGroups.map((group) => {
                      const groupStageIds = group.items.flatMap((it) =>
                        it.data.recommendations.map((rec) => rec.id),
                      );
                      const groupSelected = groupStageIds.filter((id) =>
                        selectedStageIds.has(id),
                      ).length;
                      const groupAll =
                        groupStageIds.length > 0 &&
                        groupSelected === groupStageIds.length;

                      return (
                        <div key={group.farmName} className="flex flex-col gap-2">
                          {/* Cabeçalho da fazenda: marca todos os talhões dela de
                              uma vez — com 2 fazendas × 20 talhões, marcar um a um
                              é o que consome o tempo. */}
                          <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2">
                            <label className="flex min-w-0 cursor-pointer items-center gap-2.5">
                              <input
                                type="checkbox"
                                className="size-4 accent-primary"
                                checked={groupAll}
                                ref={(node) => {
                                  if (node) {
                                    node.indeterminate =
                                      groupSelected > 0 && !groupAll;
                                  }
                                }}
                                onChange={(e) =>
                                  setFarmSelected(group.items, e.target.checked)
                                }
                              />
                              <span className="truncate text-sm font-semibold text-text-strong">
                                {group.farmName}
                              </span>
                            </label>
                            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                              {group.items.length}{" "}
                              {group.items.length === 1 ? "talhão" : "talhões"}
                            </span>
                          </div>

                  <ul className="flex flex-col gap-3">
                    {group.items.map((item) => {
                      const seasonStageIds = item.data.recommendations.map((rec) => rec.id);
                      const selectedCount = seasonStageIds.filter((id) =>
                        selectedStageIds.has(id),
                      ).length;
                      const allSelected =
                        seasonStageIds.length > 0 &&
                        selectedCount === seasonStageIds.length;

                      return (
                        <li
                          key={item.id}
                          className="rounded-xl border border-border bg-card p-3"
                        >
                          <div className="mb-2 flex items-center gap-2">
                            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                              <input
                                type="checkbox"
                                className="size-4 accent-primary"
                                checked={allSelected}
                                ref={(node) => {
                                  if (node) {
                                    node.indeterminate =
                                      selectedCount > 0 && !allSelected;
                                  }
                                }}
                                onChange={(e) => setSeasonSelected(item, e.target.checked)}
                              />
                              <span className="truncate text-sm font-semibold text-text-strong">
                                {item.label}
                              </span>
                            </label>
                            <span className="text-xs text-muted-foreground">
                              {selectedCount}/{seasonStageIds.length}
                            </span>
                          </div>

                          <ul className="flex flex-col gap-1">
                            {item.data.recommendations.map((rec, index) => {
                              const on = selectedStageIds.has(rec.id);
                              return (
                                <li key={rec.id}>
                                  <label
                                    className={cn(
                                      "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm",
                                      on
                                        ? "border-primary/40 bg-primary/5"
                                        : "border-border bg-surface",
                                    )}
                                  >
                                    <input
                                      type="checkbox"
                                      className="size-4 accent-primary"
                                      checked={on}
                                      onChange={() => toggleStage(rec.id)}
                                    />
                                    <span className="min-w-0 flex-1 truncate font-medium text-text-strong">
                                      {index + 1}. {rec.name}
                                    </span>
                                  </label>
                                </li>
                              );
                            })}
                          </ul>
                        </li>
                      );
                    })}
                  </ul>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-3">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-text-strong">Talhões</h3>
                  <span className="text-xs text-muted-foreground">
                    {items.length} {items.length === 1 ? "talhão" : "talhões"}
                  </span>
                </div>
                {items.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">
                    Nenhuma safra com cronograma para exportar.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {items.map((it) => (
                      <li
                        key={it.id}
                        className="flex items-center gap-2.5 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 truncate font-medium text-text-strong">
                          {it.label}
                          {it.data.spec?.farmName ? (
                            <span className="font-normal text-muted-foreground">
                              {" "}· {it.data.spec.farmName}
                            </span>
                          ) : null}
                        </span>
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                          {it.data.done}/{it.data.total}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-surface-2 p-4">
            <div className="mb-2 flex items-center gap-2">
              <WhatsAppIcon className="h-4 w-4 text-[#25D366]" />
              <h3 className="text-sm font-semibold text-text-strong">Mensagem do WhatsApp</h3>
            </div>
            {selectedItems.length ? (
              <div className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-card px-3 py-2.5 font-mono text-[12px] leading-relaxed text-foreground">
                {message}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border bg-card px-3 py-2.5 text-[13px] text-muted-foreground">
                Selecione ao menos uma etapa.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                className="gap-2 bg-[#25D366] text-white hover:bg-[#20BD5A]"
                onClick={() => window.open(whatsappUrl, "_blank", "noopener,noreferrer")}
                disabled={!selectedItems.length}
              >
                <WhatsAppIcon className="h-4 w-4" />
                Enviar no WhatsApp
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleCopy}
                disabled={!selectedItems.length}
              >
                {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copiado" : "Copiar texto"}
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={handlePrint}
                disabled={!selectedItems.length}
              >
                <FileDown className="h-4 w-4" />
                Baixar PDF
              </Button>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
