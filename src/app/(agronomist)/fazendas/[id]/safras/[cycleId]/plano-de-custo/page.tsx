"use client";

import { useRouter } from "next/navigation";
import { CycleCostPlanView } from "@/components/domain/cycle-cost-plan-view";
import {
  CyclePageShell,
  useCyclePage,
} from "@/components/domain/cycle/cycle-page-shell";

/** Plano de custo agregado da safra da fazenda (era `?tab=cost-plan` na safra). */
export default function CycleCostPlanPage() {
  const router = useRouter();
  const page = useCyclePage();

  return (
    <CyclePageShell page={page} backHref={page.hrefs.base}>
      <CycleCostPlanView
        cycleId={page.cycleId}
        producerName={page.producer?.name}
        farmName={page.farm?.name}
        onOpenPurchaseList={() => router.push(page.hrefs.listaDeCompra)}
      />
    </CyclePageShell>
  );
}
