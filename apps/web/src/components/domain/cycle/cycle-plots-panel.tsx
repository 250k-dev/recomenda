"use client";

import { useMemo, useState } from "react";
import { Sprout, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { CycleDetail, CyclePlotRow } from "@recomenda/api/cycles";
import { apiErrorMessage } from "@recomenda/api/api-error";
import {
  useAddCyclePlots,
  useProducerFarms,
  useProducerPlotCycleUsage,
  useRemoveCyclePlot,
  useUpdateCyclePlotArea,
} from "@recomenda/api-hooks";
import { Badge } from "@recomenda/ui/primitives/badge";
import { Button } from "@recomenda/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@recomenda/ui/primitives/dialog";
import { MoneyInput } from "@recomenda/ui/forms/money-input";
import {
  CyclePlotPicker,
  defaultPlotSelection,
  plotSelectionToInput,
  plotUsageMap,
  type PlotSelection,
} from "@/components/domain/cycle/cycle-plot-picker";

const fmtHa = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/** Área do talhão na safra, editada no próprio campo e salva ao sair dele. */
function PlotAreaField({
  row,
  disabled,
  onCommit,
}: {
  row: CyclePlotRow;
  disabled: boolean;
  onCommit: (areaHa: number | null) => void;
}) {
  const initial = row.cycle_area_ha != null ? String(row.cycle_area_ha) : "";
  const [value, setValue] = useState(initial);
  const [lastInitial, setLastInitial] = useState(initial);
  if (initial !== lastInitial) {
    setLastInitial(initial);
    setValue(initial);
  }
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
      <MoneyInput
        aria-label={`Área de ${row.plot_name} na safra (ha)`}
        className="h-8 w-24 text-right tabular-nums"
        value={value}
        placeholder={fmtHa(row.plot_area_ha)}
        disabled={disabled}
        onValueChange={setValue}
        onBlur={() => {
          if (value === initial) return;
          const n = value ? Number(value) : NaN;
          onCommit(Number.isFinite(n) && n > 0 ? n : null);
        }}
      />
      <span>de {fmtHa(row.plot_area_ha)} ha</span>
    </span>
  );
}

/**
 * Talhões da safra ainda sem programação, dentro do card da fazenda: a safra já
 * os reservou (a lista de compra conta a área deles). Daqui o agrônomo
 * programa, ajusta a área na safra ou tira o talhão da safra.
 */
export function CyclePendingPlotRows({
  cycle,
  rows,
  canEdit,
  onProgram,
}: {
  cycle: CycleDetail;
  rows: CyclePlotRow[];
  canEdit: boolean;
  /** Abre a programação com estes talhões já marcados. */
  onProgram: (plotIds: string[]) => void;
}) {
  const updateArea = useUpdateCyclePlotArea(cycle.id);
  const removePlot = useRemoveCyclePlot(cycle.id);
  const editable = canEdit && cycle.status === "ACTIVE";
  const totalPlots = cycle.plots?.length ?? 0;
  if (rows.length === 0) return null;

  const commitArea = (row: CyclePlotRow, areaHa: number | null) => {
    updateArea.mutate(
      { plotId: row.plot_id, areaHa },
      {
        onSuccess: () => toast.success(`Área de ${row.plot_name} atualizada. Lista recalculada.`),
        onError: (e) => toast.error(apiErrorMessage(e, "Não foi possível salvar a área.")),
      },
    );
  };

  const remove = (row: CyclePlotRow) => {
    removePlot.mutate(row.plot_id, {
      onSuccess: () => toast.success(`${row.plot_name} saiu da safra. Lista recalculada.`),
      onError: (e) => toast.error(apiErrorMessage(e, "Não foi possível tirar o talhão da safra.")),
    });
  };

  return (
    <div className="divide-y divide-border">
      {rows.map((row) => (
        <div
          key={row.plot_id}
          className="flex flex-wrap items-center gap-2.5 px-5 py-3 text-sm"
        >
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <span className="truncate font-semibold text-text-strong">
              Talhão {row.plot_name}
            </span>
            <Badge variant="neutral" className="px-1.5 py-0 text-[10px]">
              Sem programação
            </Badge>
          </span>
          {editable ? (
            <PlotAreaField
              row={row}
              disabled={updateArea.isPending}
              onCommit={(areaHa) => commitArea(row, areaHa)}
            />
          ) : (
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {fmtHa(row.area_ha)} ha
            </span>
          )}
          {editable ? (
            <span className="flex shrink-0 items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => onProgram([row.plot_id])}
              >
                <Sprout className="size-3.5" />
                Programar
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Tirar ${row.plot_name} da safra`}
                title="Tirar da safra"
                disabled={removePlot.isPending || totalPlots <= 1}
                onClick={() => remove(row)}
              >
                <Trash2 className="size-4" />
              </Button>
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** Inclui na safra talhões de uma fazenda dela (os que ainda não estão). */
export function AddCyclePlotsDialog({
  cycle,
  producerId,
  farmId,
  open,
  onOpenChange,
}: {
  cycle: CycleDetail;
  producerId: string;
  /** Só esta fazenda; sem ela, todas as fazendas da safra. */
  farmId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const addPlots = useAddCyclePlots(cycle.id);
  const { data: producerFarms } = useProducerFarms(producerId);
  const usageQuery = useProducerPlotCycleUsage(producerId, open);
  const usage = useMemo(
    () => plotUsageMap(usageQuery.data, cycle.id),
    [usageQuery.data, cycle.id],
  );
  const addableFarms = useMemo(() => {
    const inCycle = new Set((cycle.plots ?? []).map((p) => p.plot_id));
    const cycleFarmIds = new Set(cycle.farms.map((f) => f.id));
    return (producerFarms ?? [])
      .filter((f) => cycleFarmIds.has(f.id) && (!farmId || f.id === farmId))
      .map((f) => ({ ...f, plots: f.plots.filter((p) => !inCycle.has(p.id)) }));
  }, [producerFarms, cycle.farms, cycle.plots, farmId]);
  const [selection, setSelection] = useState<PlotSelection>(new Map());

  // Ao abrir: sugere os talhões livres (e a área que sobrou dos usados em parte).
  const [seeded, setSeeded] = useState(false);
  if (!open && seeded) setSeeded(false);
  if (open && !seeded && usageQuery.data) {
    setSeeded(true);
    setSelection(defaultPlotSelection(addableFarms, usage));
  }

  const confirmAdd = () => {
    const input = plotSelectionToInput(selection, addableFarms);
    if (input.length === 0) {
      toast.error("Marque pelo menos um talhão.");
      return;
    }
    addPlots.mutate(input, {
      onSuccess: () => {
        toast.success(
          `${input.length} ${input.length === 1 ? "talhão incluído" : "talhões incluídos"} na safra. Lista recalculada.`,
        );
        onOpenChange(false);
      },
      onError: (e) => toast.error(apiErrorMessage(e, "Não foi possível incluir os talhões.")),
    });
  };

  const addableCount = addableFarms.reduce((s, f) => s + f.plots.length, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,760px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle>Adicionar talhões à safra</DialogTitle>
          <DialogDescription>
            A área dos talhões marcados entra na lista de compra desta safra.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-2">
          {addableCount === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Todos os talhões desta fazenda já estão na safra. Cadastre novos
              talhões na ficha da fazenda.
            </p>
          ) : (
            <CyclePlotPicker
              farms={addableFarms}
              selection={selection}
              onChange={setSelection}
              usage={usage}
            />
          )}
        </div>
        <div className="flex shrink-0 gap-2 border-t border-border px-6 py-4">
          <Button
            className="flex-1"
            onClick={confirmAdd}
            disabled={addPlots.isPending || addableCount === 0}
          >
            {addPlots.isPending ? "Incluindo..." : "Incluir na safra"}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
