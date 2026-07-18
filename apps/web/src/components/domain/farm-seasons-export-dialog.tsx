"use client";

import { useMemo, useState } from "react";
import { Check, Copy, FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  buildMultiWhatsappMessage,
  type RecommendationShareData,
} from "@/lib/recommendations/share-message";
import { printRecommendations } from "@/lib/recommendations/print-document";
import { WhatsAppIcon } from "@/assets/whatsapp-icon";
import { cn } from "@/lib/utils";

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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmName?: string | null;
  contextLabel?: string;
  isLoading?: boolean;
  items: FarmExportItem[];
}) {
  const [copied, setCopied] = useState(false);
  const [shareAll, setShareAll] = useState(true);
  const [selectedStageIds, setSelectedStageIds] = useState<Set<string>>(new Set());

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
      () => printRecommendations(selectedItems.map((i) => i.data), `Recomendações - ${farmName ?? ""}`),
      250,
    );
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
                  <ul className="flex flex-col gap-3">
                    {items.map((item) => {
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
                        <span className="font-medium text-text-strong">{it.label}</span>
                        <span className="ml-auto text-xs text-muted-foreground">
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
