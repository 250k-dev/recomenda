"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Calculator,
  Plus,
  ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";
import { BreadcrumbBack } from "@/components/domain/breadcrumb-back";
import { type PageHeroStat } from "@/components/domain/page-hero";
import { StickyMobileCta } from "@/components/domain/sticky-mobile-cta";
import { Button } from "@recomenda/ui/primitives/button";
import { ConfirmDialog } from "@recomenda/ui/patterns/confirm-dialog";
import { EmptyState } from "@recomenda/ui/patterns/empty-state";
import { CycleBlockWizard } from "@/components/domain/cycle-block-wizard";
import {
  CyclePageShell,
  useCyclePage,
} from "@/components/domain/cycle/cycle-page-shell";
import { CycleFarmDisclosures } from "@/components/domain/cycle/cycle-farm-disclosures";
import {
  useArchiveSeason,
  useCycleAvailablePlots,
  useCyclePurchaseList,
} from "@recomenda/api-hooks";
import { useCan } from "@recomenda/api-hooks/use-can";

const fmtHa = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export default function CycleDetailPage() {
  const router = useRouter();
  const canListCrud = useCan("LIST_CRUD");
  const page = useCyclePage();
  const { cycleId, producerId, cycle, seasons } = page;

  const { data: purchaseList } = useCyclePurchaseList(cycleId);
  const { data: availablePlots = [] } = useCycleAvailablePlots(cycleId);
  const archiveSeason = useArchiveSeason();
  const hasActivePurchaseList = purchaseList?.status === "active";
  const hasAvailablePlots = availablePlots.length > 0;

  const [wizardOpen, setWizardOpen] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const tryOpenWizard = () => {
    if (!hasActivePurchaseList) {
      toast.error(
        "Finalize a lista de compra da safra antes de programar talhões.",
      );
      router.push(
        purchaseList?.status === "draft"
          ? page.hrefs.listaDeCompra
          : page.hrefs.novaListaDeCompra,
      );
      return;
    }
    setWizardOpen(true);
  };

  const totalRecs = seasons.reduce(
    (s, row) => s + row.recommendations_total,
    0,
  );
  const doneRecs = seasons.reduce((s, row) => s + row.recommendations_done, 0);
  const progressPct =
    totalRecs > 0 ? Math.round((doneRecs / totalRecs) * 100) : 0;
  const areaByPlot = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of seasons) {
      // Um talhão físico conta uma vez (2 culturas no mesmo talhão não dobram ha).
      if (!map.has(s.plot_id)) {
        map.set(s.plot_id, s.planted_area_ha ?? s.plot_area_ha);
      }
    }
    return map;
  }, [seasons]);
  const programmedArea = [...areaByPlot.values()].reduce((s, v) => s + v, 0);
  // Em planejamento (sem talhões programados) mostra a área cadastral das fazendas.
  const totalArea =
    programmedArea > 0
      ? programmedArea
      : (cycle?.total_cadastral_hectares ?? 0);
  const plotCount = areaByPlot.size;

  if (wizardOpen && cycle && hasActivePurchaseList) {
    return (
      <>
        <BreadcrumbBack
          items={[...page.breadcrumbs.slice(0, -1), { label: cycle.name }]}
        />
        <CycleBlockWizard
          cycle={cycle}
          producerId={producerId}
          onDone={() => setWizardOpen(false)}
          onCancel={() => setWizardOpen(false)}
        />
      </>
    );
  }

  const heroStats: PageHeroStat[] = [
    ...(cycle && cycle.farms.length > 1
      ? [{ label: "Fazendas", value: cycle.farms.length }]
      : []),
    { label: "Talhões", value: plotCount },
    { label: "Área", value: `${fmtHa(totalArea)} ha` },
    {
      label: "Aplicações",
      value: totalRecs > 0 ? `${doneRecs}/${totalRecs}` : "—",
      sub: totalRecs > 0 ? `${progressPct}%` : undefined,
    },
    {
      label: purchaseList?.name ?? "Lista de compra",
      value: purchaseList ? (purchaseList.items ?? []).length : 0,
      sub: "produtos",
      onClick: () => router.push(page.hrefs.listaDeCompra),
    },
  ];

  return (
    <CyclePageShell
      page={page}
      stats={heroStats}
      actions={
        <>
          <Button asChild variant="outline" className="gap-1.5">
            <Link href={page.hrefs.planoDeCusto}>
              <Calculator className="size-4" />
              Plano de custo
            </Link>
          </Button>
          <Button asChild variant="clay" className="gap-1.5">
            <Link href={page.hrefs.listaDeCompra}>
              <ShoppingCart className="size-4" />
              Lista de compra
            </Link>
          </Button>
        </>
      }
    >
      {cycle ? (
        <>
          <CycleFarmDisclosures
            cycle={cycle}
            producerId={producerId}
            seasons={seasons}
            onAddPlot={tryOpenWizard}
            onArchiveSeason={setArchiveConfirm}
            archivePending={archiveSeason.isPending}
          />

          {!hasActivePurchaseList && canListCrud ? (
            <div className="mt-6">
              <EmptyState
                icon={ShoppingCart}
                title={
                  purchaseList?.status === "draft"
                    ? "Finalize a lista de compra da safra."
                    : "Primeiro passo: lista de compra."
                }
                description="A programação dos talhões só libera depois que a lista de compra estiver finalizada. Assim dose, unidade e hectares ficam alinhados."
                action={
                  <Button asChild size="sm" className="gap-1.5">
                    <Link
                      href={
                        purchaseList?.status === "draft"
                          ? page.hrefs.listaDeCompra
                          : page.hrefs.novaListaDeCompra
                      }
                    >
                      <ShoppingCart className="size-4" />
                      {purchaseList?.status === "draft"
                        ? "Continuar lista de compra"
                        : "Montar lista de compra"}
                    </Link>
                  </Button>
                }
              />
            </div>
          ) : null}

          <StickyMobileCta>
            {hasActivePurchaseList && hasAvailablePlots ? (
              <Button size="lg" className="gap-2" onClick={tryOpenWizard}>
                <Plus className="size-4" />
                Adicionar talhão
              </Button>
            ) : !hasActivePurchaseList && canListCrud ? (
              <Button asChild size="lg" className="gap-2">
                <Link
                  href={
                    purchaseList?.status === "draft"
                      ? page.hrefs.listaDeCompra
                      : page.hrefs.novaListaDeCompra
                  }
                >
                  <ShoppingCart className="size-4" />
                  {purchaseList?.status === "draft"
                    ? "Continuar lista de compra"
                    : "Montar lista de compra"}
                </Link>
              </Button>
            ) : null}
          </StickyMobileCta>
        </>
      ) : null}

      <ConfirmDialog
        open={!!archiveConfirm}
        onOpenChange={(open) => !open && setArchiveConfirm(null)}
        title="Remover talhão da safra"
        description={
          archiveConfirm
            ? `A programação de "${archiveConfirm.name}" será movida para Removidas.`
            : undefined
        }
        confirmLabel="Remover"
        tone="destructive"
        loading={archiveSeason.isPending}
        onConfirm={async () => {
          if (!archiveConfirm) return;
          await new Promise<void>((resolve, reject) =>
            archiveSeason.mutate(archiveConfirm.id, {
              onSuccess: () => {
                setArchiveConfirm(null);
                toast.success("Talhão removido da safra.");
                resolve();
              },
              onError: (err) => reject(err),
            }),
          );
        }}
      />
    </CyclePageShell>
  );
}
