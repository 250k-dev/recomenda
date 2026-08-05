"use client";

import { useMemo, useState } from "react";
import { Check, MapPinned, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@recomenda/ui/primitives/button";
import { Card, CardContent } from "@recomenda/ui/primitives/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@recomenda/ui/primitives/dialog";
import { ConfirmDialog } from "@recomenda/ui/patterns/confirm-dialog";
import { EmptyState } from "@recomenda/ui/patterns/empty-state";
import { SectionToolbar } from "@/components/domain/section-toolbar";
import {
  useAddCycleFarm,
  useCan,
  useProducerFarms,
  useRemoveCycleFarm,
} from "@recomenda/api-hooks";
import { apiErrorMessage } from "@recomenda/api/api-error";
import type { CycleDetail } from "@recomenda/api/cycles";

const fmtHa = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/** Fazendas participantes da safra (multi-fazenda): lista, adiciona e remove
 *  vínculos. A safra sempre precisa manter ao menos uma fazenda. */
export function CycleFarmsSection({
  cycle,
  producerId,
}: {
  cycle: CycleDetail;
  producerId: string;
}) {
  const canManage = useCan("CYCLE_CRUD");
  const [addOpen, setAddOpen] = useState(false);
  const [removeFarm, setRemoveFarm] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const removeCycleFarm = useRemoveCycleFarm(cycle.id);

  const farms = cycle.farms ?? [];
  const canRemove = farms.length > 1;

  return (
    <div>
      <SectionToolbar
        title="Fazendas desta safra"
        actions={
          canManage ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="size-4" />
              Adicionar fazenda
            </Button>
          ) : null
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {farms.map((farm) => (
          <Card key={farm.id} className="gap-0 p-0">
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex items-center justify-center rounded-xl size-10 shrink-0 bg-primary-soft text-primary-strong">
                <MapPinned className="size-5" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-semibold truncate text-text-strong">
                  {farm.name}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {fmtHa(farm.area_hectares_sum)} ha cadastrados
                </span>
              </span>
              {canManage && canRemove ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-danger-strong"
                  title="Remover fazenda da safra"
                  onClick={() => {
                    setRemoveError(null);
                    setRemoveFarm({ id: farm.id, name: farm.name });
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <AddCycleFarmDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        cycleId={cycle.id}
        producerId={producerId}
        cycleFarms={farms}
      />

      <ConfirmDialog
        open={!!removeFarm}
        onOpenChange={(open) => {
          if (!open) {
            setRemoveFarm(null);
            setRemoveError(null);
          }
        }}
        title="Remover fazenda da safra"
        description={
          <>
            {removeFarm
              ? `"${removeFarm.name}" será desvinculada desta safra. Talhões com programação publicada, em andamento ou colhida impedem a remoção.`
              : null}
            {removeError ? (
              <span className="mt-2 block font-medium text-danger-strong">
                {removeError}
              </span>
            ) : null}
          </>
        }
        confirmLabel="Remover"
        tone="destructive"
        loading={removeCycleFarm.isPending}
        onConfirm={async () => {
          if (!removeFarm) return;
          setRemoveError(null);
          await new Promise<void>((resolve) =>
            removeCycleFarm.mutate(removeFarm.id, {
              onSuccess: () => {
                toast.success("Fazenda removida da safra.");
                setRemoveFarm(null);
                resolve();
              },
              onError: (err) => {
                setRemoveError(
                  apiErrorMessage(
                    err,
                    "Não foi possível remover a fazenda desta safra.",
                  ),
                );
                resolve();
              },
            }),
          );
        }}
      />
    </div>
  );
}

/** Diálogo "Adicionar fazenda": lista as fazendas do produtor que ainda não
 *  fazem parte da safra. Fica aberto após adicionar — permite incluir mais
 *  de uma em sequência. */
export function AddCycleFarmDialog({
  open,
  onOpenChange,
  cycleId,
  producerId,
  cycleFarms,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cycleId: string;
  producerId: string;
  cycleFarms: { id: string; name: string; area_hectares_sum: number }[];
}) {
  const { data: producerFarms, isLoading } = useProducerFarms(producerId);
  const addCycleFarm = useAddCycleFarm(cycleId);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const cycleFarmIds = useMemo(
    () => new Set(cycleFarms.map((f) => f.id)),
    [cycleFarms],
  );
  const availableFarms = (producerFarms ?? []).filter(
    (f) => !cycleFarmIds.has(f.id),
  );

  const addFarm = (farmId: string) => {
    setPendingId(farmId);
    addCycleFarm.mutate(farmId, {
      onSuccess: () => {
        toast.success("Fazenda adicionada à safra.");
        setPendingId(null);
      },
      onError: (err) => {
        toast.error(
          apiErrorMessage(err, "Não foi possível adicionar a fazenda."),
        );
        setPendingId(null);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar fazenda à safra</DialogTitle>
        </DialogHeader>
        <div className="px-6 py-5">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : availableFarms.length === 0 ? (
            <EmptyState
              variant="inline"
              title="Nenhuma fazenda disponível."
              description="Todas as fazendas deste produtor já fazem parte da safra."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {availableFarms.map((farm) => {
                const area = farm.plots.reduce(
                  (s, p) => s + Number(p.area_hectares || 0),
                  0,
                );
                const pending = pendingId === farm.id && addCycleFarm.isPending;
                return (
                  <div
                    key={farm.id}
                    className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm"
                  >
                    <span className="flex-1 min-w-0 truncate">
                      {farm.name}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                      {fmtHa(area)} ha
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 shrink-0"
                      disabled={addCycleFarm.isPending}
                      onClick={() => addFarm(farm.id)}
                    >
                      {pending ? (
                        "Adicionando..."
                      ) : (
                        <>
                          <Check className="size-3.5" />
                          Adicionar
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
