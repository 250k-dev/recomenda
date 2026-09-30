"use client";

import Link from "next/link";
import { Loader2, Wallet } from "lucide-react";
import { Button } from "@recomenda/ui/primitives/button";
import { EmptyState } from "@recomenda/ui/patterns/empty-state";
import { routes } from "@recomenda/config";
import { CostPlanView } from "@/components/domain/cost-plan/cost-plan-view";
import { useSeasonPage } from "@/components/domain/season/use-season-page";

/** Plano de custo da safra do talhão (era `?tab=cost-plan`). */
export default function SeasonCostPlanPage() {
  const {
    seasonId,
    season,
    farmId,
    producerId,
    producer,
    farm,
    cycleId,
    cycleFarmId,
    loadingSeason,
  } = useSeasonPage();

  if (!seasonId) {
    return (
      <p className="text-sm text-destructive">ID da safra não encontrado.</p>
    );
  }

  if (loadingSeason) {
    return (
      <div role="status" aria-label="Carregando" className="flex justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Talhão de uma safra: a lista de compra (e o plano de custo) é da safra.
  // Editar aqui seria um segundo editor da mesma lista — leva para o da safra.
  if (cycleId) {
    return (
      <EmptyState
        icon={Wallet}
        title="O plano de custo é da safra"
        description="Este talhão faz parte de uma safra. Os produtos, doses e preços ficam na lista de compra da safra, e o plano de custo mostra a quebra por talhão."
        action={
          cycleFarmId ? (
            <Button asChild>
              <Link
                href={routes.fazendas.safraPlanoDeCusto(cycleFarmId, cycleId, {
                  producer_id: producerId || undefined,
                })}
              >
                Abrir plano de custo da safra
              </Link>
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <CostPlanView
      seasonId={seasonId}
      crop={season?.crop ?? "SOYBEAN"}
      farmId={farmId || undefined}
      producerId={producerId || undefined}
      producerName={producer?.name}
      farmName={farm?.name}
    />
  );
}
