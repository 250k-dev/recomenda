"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Button } from "@recomenda/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recomenda/ui/primitives/dialog";
import { Label } from "@recomenda/ui/primitives/label";
import { Select } from "@recomenda/ui/forms/select";
import {
  useBulkApplySeasonTemplate,
  useSyncCycleListDoses,
  useTimingTemplates,
} from "@recomenda/api-hooks";
import type { CycleDetail, CycleSeasonRow } from "@recomenda/api/cycles";
import { CROP_LABELS } from "@recomenda/utils";
import {
  FarmPlotSelection,
  type SelectablePlot,
} from "@/components/domain/cycle/farm-plot-selection";

/** Talhões arquivados não recebem programação nova. */
const APPLICABLE_STATUS = new Set(["DRAFT", "PUBLISHED", "IN_PROGRESS"]);

/**
 * Etapas que o modelo vai descartar neste talhão: só as PENDENTES.
 * `total - aplicadas` incluiria as PULADAS, que o servidor preserva.
 * Fallback para servidor antigo, que não manda `recommendations_pending`.
 */
function pendingOf(season: CycleSeasonRow): number {
  return Math.max(
    0,
    season.recommendations_pending ??
      season.recommendations_total - season.recommendations_done,
  );
}

/**
 * Aplica um modelo de timing a vários talhões da safra de uma vez.
 *
 * Substitui as etapas **pendentes** de cada talhão selecionado (as já aplicadas
 * permanecem) — mesmo comportamento do botão "Aplicar modelo" de um talhão só,
 * que este diálogo evita repetir 40 vezes.
 */
export function BulkApplyTemplateDialog({
  open,
  onOpenChange,
  cycle,
  producerId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cycle: CycleDetail;
  producerId: string;
}) {
  const { data: templates, isLoading } = useTimingTemplates(producerId);
  const bulkApply = useBulkApplySeasonTemplate();
  const syncListDoses = useSyncCycleListDoses(cycle.id);
  const [templateId, setTemplateId] = useState("");
  // A dose que manda na programação passou a ser a do modelo; sem isto a lista
  // de compra continuaria com a dose antiga e as duas telas divergiriam.
  const [syncList, setSyncList] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const options = useMemo(
    () =>
      (templates ?? [])
        .filter((t) => !t.is_archived)
        .map((t) => ({
          value: t.id,
          label: `${t.name} · ${CROP_LABELS[t.crop] ?? t.crop}`,
        })),
    [templates],
  );

  const template = useMemo(
    () => (templates ?? []).find((t) => t.id === templateId) ?? null,
    [templates, templateId],
  );

  // Ao abrir (ou quando a lista de modelos chega), cai no primeiro modelo.
  // Ajuste durante o render — mesmo padrão dos outros diálogos do app; dentro
  // de um efeito o lint reprova (cascading renders).
  const optionsKey = open ? options.map((o) => o.value).join("|") : "";
  const [prevOptionsKey, setPrevOptionsKey] = useState("");
  if (optionsKey !== prevOptionsKey) {
    setPrevOptionsKey(optionsKey);
    if (open) {
      setTemplateId((current) =>
        current && options.some((o) => o.value === current)
          ? current
          : (options[0]?.value ?? ""),
      );
      setSelected(new Set());
    }
  }

  // Talhão que já teve aplicação registrada sai da lista: não se passa produto
  // por cima de aplicação feita. Ele é contado à parte para explicar a ausência
  // — talhão sumir sem motivo confunde mais do que ajuda.
  const applicable = useMemo(
    () => cycle.seasons.filter((s) => APPLICABLE_STATUS.has(s.status)),
    [cycle.seasons],
  );
  const seasons = useMemo(
    () => applicable.filter((s) => s.recommendations_done === 0),
    [applicable],
  );
  const alreadyAppliedCount = applicable.length - seasons.length;

  // O servidor recusa modelo de cultura diferente da do talhão — em vez de
  // deixar falhar no lote, o talhão já aparece bloqueado com o motivo.
  const plots = useMemo<SelectablePlot[]>(
    () =>
      seasons.map((season) => {
        const cropMismatch =
          template && template.crop !== "ANY" && template.crop !== season.crop;
        // Pendentes de verdade (as puladas não são apagadas pelo servidor).
        const pending = pendingOf(season);
        return {
          id: season.id,
          farmId: season.farm_id ?? cycle.farm_id,
          farmName: season.farm_name ?? "Fazenda",
          label: season.plot_name,
          hint: [
            `${season.plot_area_ha.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ha`,
            CROP_LABELS[season.crop] ?? season.crop,
            season.recommendations_total > 0
              ? `${season.recommendations_total} ${season.recommendations_total === 1 ? "etapa" : "etapas"}${pending > 0 ? ` · ${pending} pendente${pending === 1 ? "" : "s"}` : ""}`
              : "sem etapas",
          ].join(" · "),
          disabledReason: cropMismatch
            ? `Modelo é de ${CROP_LABELS[template.crop] ?? template.crop}; o talhão é ${CROP_LABELS[season.crop] ?? season.crop}.`
            : null,
        };
      }),
    [cycle.farm_id, seasons, template],
  );

  // Trocar de modelo pode bloquear talhões já marcados (cultura diferente).
  // Derivado, não sincronizado por efeito: o bloqueado simplesmente não conta.
  const validSelected = useMemo(() => {
    const blocked = new Set(
      plots.filter((p) => p.disabledReason).map((p) => p.id),
    );
    return new Set([...selected].filter((id) => !blocked.has(id)));
  }, [plots, selected]);

  const selectedSeasons = seasons.filter((s) => validSelected.has(s.id));
  // Quantas etapas pendentes serão descartadas — o agrônomo vê o custo antes.
  const pendingToReplace = selectedSeasons.reduce(
    (sum, s) => sum + pendingOf(s),
    0,
  );

  const handleApply = () => {
    if (!templateId) {
      toast.error("Selecione um modelo.");
      return;
    }
    if (validSelected.size === 0) {
      toast.error("Selecione ao menos um talhão.");
      return;
    }
    bulkApply.mutate(
      {
        timingTemplateId: templateId,
        seasons: selectedSeasons.map((s) => ({
          id: s.id,
          label: s.plot_name,
        })),
      },
      {
        onSuccess: async ({ ok, failed, errors }) => {
          // Uma vez só no fim do lote — o sync é da safra inteira.
          let listMsg = "";
          if (syncList && ok > 0) {
            try {
              const res = await syncListDoses.mutateAsync();
              if (res.updated > 0) {
                listMsg = ` ${res.updated} ${res.updated === 1 ? "item" : "itens"} da lista de compra ${res.updated === 1 ? "atualizado" : "atualizados"}.`;
              }
              if (res.conflicts.length > 0) {
                toast.warning(
                  `${res.conflicts.length} ${res.conflicts.length === 1 ? "item da lista não foi alterado" : "itens da lista não foram alterados"} porque já têm compra confirmada: ${res.conflicts
                    .slice(0, 3)
                    .map((c) => c.product_name)
                    .join(", ")}.`,
                );
              }
            } catch {
              toast.warning(
                "Modelo aplicado, mas não deu para atualizar a lista de compra.",
              );
            }
          }
          if (failed === 0) {
            toast.success(
              `Modelo aplicado em ${ok} ${ok === 1 ? "talhão" : "talhões"}.${listMsg}`,
            );
            onOpenChange(false);
            return;
          }
          // Falha parcial: não fecha o diálogo, para o agrônomo ver quem falhou.
          toast.warning(
            `Aplicado em ${ok}; ${failed} falhou: ${errors
              .slice(0, 3)
              .map((e) => e.label)
              .join(", ")}${errors.length > 3 ? "…" : ""}`,
          );
        },
        onError: () => toast.error("Não foi possível aplicar o modelo."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Aplicar modelo em massa</DialogTitle>
          <DialogDescription>
            Escolha o modelo e os talhões que vão recebê-lo. Dá para marcar a
            fazenda inteira de uma vez.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto px-6 py-5">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Modelo</Label>
            <Select
              value={templateId}
              onValueChange={setTemplateId}
              disabled={isLoading || options.length === 0}
              placeholder={isLoading ? "Carregando…" : "Selecione um modelo…"}
              options={options}
            />
            {options.length === 0 && !isLoading ? (
              <p className="text-xs text-muted-foreground">
                Nenhum modelo cadastrado para este produtor.
              </p>
            ) : null}
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-primary"
              checked={syncList}
              onChange={(e) => setSyncList(e.target.checked)}
            />
            <span className="text-sm">
              <span className="font-semibold text-text-strong">
                Atualizar a lista de compra com as doses do modelo
              </span>
              <span className="mt-0.5 block text-[13px] text-muted-foreground">
                Mantém a lista alinhada com o que foi programado. Estoque, preços
                e itens com compra confirmada não são alterados.
              </span>
            </span>
          </label>

          {pendingToReplace > 0 ? (
            <p className="flex items-start gap-2 rounded-lg border border-warning-border bg-warning-soft px-3 py-2.5 text-[13px] font-medium leading-snug text-warning-strong">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                {pendingToReplace}{" "}
                {pendingToReplace === 1 ? "etapa pendente" : "etapas pendentes"}{" "}
                {pendingToReplace === 1 ? "será substituída" : "serão substituídas"}{" "}
                pelo modelo nos talhões marcados. Etapas já aplicadas permanecem.
              </span>
            </p>
          ) : null}

          {alreadyAppliedCount > 0 ? (
            <p className="text-[13px] text-muted-foreground">
              {alreadyAppliedCount}{" "}
              {alreadyAppliedCount === 1
                ? "talhão não aparece porque já tem aplicação registrada"
                : "talhões não aparecem porque já têm aplicação registrada"}
              .
            </p>
          ) : null}

          {seasons.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              {applicable.length > 0
                ? "Todos os talhões desta safra já têm aplicação registrada."
                : "Esta safra ainda não tem talhões programados."}
            </p>
          ) : (
            <FarmPlotSelection
              plots={plots}
              selected={validSelected}
              onChange={setSelected}
            />
          )}

          {bulkApply.data?.errors.length ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5">
              <p className="text-[13px] font-semibold text-destructive">
                Não deu para aplicar em {bulkApply.data.errors.length}:
              </p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {bulkApply.data.errors.map((e) => (
                  <li key={e.seasonId} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{e.label}</span>{" "}
                    — {e.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleApply}
            disabled={
              bulkApply.isPending || !templateId || validSelected.size === 0
            }
          >
            {bulkApply.isPending
              ? "Aplicando…"
              : `Aplicar a ${validSelected.size} ${validSelected.size === 1 ? "talhão" : "talhões"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
