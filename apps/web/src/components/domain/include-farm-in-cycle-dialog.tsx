"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Leaf, Plus, Sprout } from "lucide-react";
import { toast } from "sonner";
import { routes } from "@recomenda/config";
import { apiErrorMessage } from "@recomenda/api/api-error";
import { addCycleFarm } from "@recomenda/api/cycles";
import { queryKeys, useProducerCycles } from "@recomenda/api-hooks";
import { Button } from "@recomenda/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@recomenda/ui/primitives/dialog";
import { EmptyState } from "@recomenda/ui/patterns/empty-state";
import { cn, CROP_LABELS } from "@recomenda/utils";
import { NewCycleDialog } from "@/components/domain/farm-cycles-section";

const fmtHa = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

type Mode = "choose" | "existing" | "create";

/**
 * Fluxo do botão "Incluir em safra" no card da fazenda:
 * 1) incluir em safra ACTIVE já existente do produtor, ou
 * 2) criar uma safra nova (NewCycleDialog).
 * Incluir recalcula a lista de compra (hectares da fazenda entram no total).
 */
export function IncludeFarmInCycleDialog({
  open,
  onOpenChange,
  farmId,
  farmName,
  producerId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmId: string;
  farmName: string;
  producerId: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>("choose");
  const [pendingCycleId, setPendingCycleId] = useState<string | null>(null);
  const { data: producerCycles, isLoading } = useProducerCycles(producerId);

  const eligibleCycles = useMemo(() => {
    return (producerCycles ?? []).filter((cycle) => {
      if (cycle.status !== "ACTIVE") return false;
      const alreadyIn = (cycle.farms ?? []).some((f) => f.id === farmId);
      return !alreadyIn;
    });
  }, [producerCycles, farmId]);

  const includeMutation = useMutation({
    mutationFn: ({ cycleId }: { cycleId: string }) =>
      addCycleFarm(cycleId, farmId),
    onSuccess: (cycle) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cycle(cycle.id) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.cycleAvailablePlots(cycle.id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.cyclePurchaseList(cycle.id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.cycleCostPlan(cycle.id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.producerCycles(producerId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.producerFarms(producerId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.farmCycles(farmId) });
      for (const farm of cycle.farms) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.farmCycles(farm.id),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.farmPurchaseLists(farm.id),
        });
      }
      void queryClient.invalidateQueries({
        queryKey: ["producer-purchase-lists"],
      });

      toast.success(
        `“${farmName}” incluída na safra. Área da lista recalculada.`,
      );
      handleOpenChange(false);
      router.push(
        routes.fazendas.safra(cycle.farm_id || farmId, cycle.id, {
          producer_id: producerId,
        }),
      );
    },
    onError: (err) => {
      toast.error(
        apiErrorMessage(err, "Não foi possível incluir a fazenda na safra."),
      );
      setPendingCycleId(null);
    },
  });

  const reset = () => {
    setMode("choose");
    setPendingCycleId(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  if (mode === "create") {
    return (
      <NewCycleDialog
        open={open}
        onOpenChange={handleOpenChange}
        farmId={farmId}
        producerId={producerId}
        onCreated={(cycleId) => {
          handleOpenChange(false);
          router.push(
            routes.fazendas.safra(farmId, cycleId, {
              producer_id: producerId,
            }),
          );
        }}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "choose"
              ? `Incluir “${farmName}” em uma safra`
              : "Escolher safra existente"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 px-6 py-5">
          {mode === "choose" ? (
            <>
              <p className="text-sm text-muted-foreground">
                A fazenda pode entrar numa safra que já existe (os hectares entram
                no cálculo da lista de compra) ou iniciar uma safra nova.
              </p>
              <button
                type="button"
                onClick={() => setMode("existing")}
                className="flex w-full items-start gap-3 rounded-xl border border-border p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-strong">
                  <Sprout className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-text-strong">
                    Incluir em safra existente
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    Soma esta fazenda a uma safra ACTIVE do produtor e recalcula
                    a área da lista.
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMode("create")}
                className="flex w-full items-start gap-3 rounded-xl border border-border p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-strong">
                  <Plus className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-text-strong">
                    Criar nova safra
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    Abre o cadastro de safra já com esta fazenda selecionada.
                  </span>
                </span>
              </button>
            </>
          ) : (
            <>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Carregando safras…</p>
              ) : eligibleCycles.length === 0 ? (
                <EmptyState
                  variant="inline"
                  title="Nenhuma safra disponível."
                  description="Não há safra ACTIVE deste produtor sem esta fazenda. Crie uma nova."
                  action={
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setMode("create")}
                    >
                      <Plus className="size-4" />
                      Criar nova safra
                    </Button>
                  }
                />
              ) : (
                <div className="flex flex-col gap-2">
                  {eligibleCycles.map((cycle) => {
                    const farmsCount = cycle.farms?.length ?? 1;
                    const areaHa =
                      cycle.total_cadastral_hectares || cycle.area_ha;
                    const pending = pendingCycleId === cycle.id;
                    return (
                      <div
                        key={cycle.id}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border border-border px-3 py-3",
                          pending && "border-primary/40 bg-primary/5",
                        )}
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-strong">
                          <Leaf className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-foreground">
                            {cycle.name}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {cycle.crops
                              .map((c) => CROP_LABELS[c] ?? c)
                              .join(" + ")}
                            {" · "}
                            {farmsCount}{" "}
                            {farmsCount === 1 ? "fazenda" : "fazendas"}
                            {areaHa > 0 ? ` · ${fmtHa(areaHa)} ha` : ""}
                          </span>
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0 gap-1.5"
                          disabled={includeMutation.isPending}
                          onClick={() => {
                            setPendingCycleId(cycle.id);
                            includeMutation.mutate({ cycleId: cycle.id });
                          }}
                        >
                          {pending ? (
                            "Incluindo…"
                          ) : (
                            <>
                              <Check className="size-3.5" />
                              Incluir
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex justify-between pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setMode("choose")}
                >
                  Voltar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setMode("create")}
                >
                  <Plus className="size-3.5" />
                  Criar nova
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
