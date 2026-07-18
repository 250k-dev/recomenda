"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, Leaf, Rocket } from "lucide-react";
import { toast } from "sonner";
import type { Route } from "next";
import { BreadcrumbBack, type BreadcrumbItem } from "@/components/domain/breadcrumb-back";
import { PageHero, type PageHeroStat } from "@/components/domain/page-hero";
import { ListCardsSkeleton } from "@/components/domain/page-skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useCycle, useFarm, useProducer, usePublishCycle } from "@/lib/api/hooks";
import type { CycleSeasonRow } from "@/lib/api/cycles";
import { CROP_LABELS } from "@recomenda/utils";
import { routes } from "@/config/routes";

const CYCLE_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativa",
  HARVESTED: "Colhida",
  ARCHIVED: "Removida",
};

/**
 * Contexto comum das telas da safra da fazenda (`/fazendas/[id]/safras/[cycleId]`
 * e subrotas): dados do ciclo, produtor do contexto, hrefs e breadcrumbs.
 * As queries são compartilhadas via cache do React Query entre as subrotas.
 */
export function useCyclePage() {
  const params = useParams<{ id: string; cycleId: string }>();
  const farmId = params.id;
  const cycleId = params.cycleId;
  const searchParams = useSearchParams();
  const producerIdParam = searchParams.get("producer_id");

  const { data: cycle, isLoading } = useCycle(cycleId);
  const { data: farm } = useFarm(farmId);
  const producerId = producerIdParam ?? cycle?.producer_id ?? "";
  const { data: producer } = useProducer(producerId);

  const ctx = { producer_id: producerIdParam };
  const hrefs = {
    farm: routes.fazendas.detalhe(farmId, ctx),
    base: routes.fazendas.safra(farmId, cycleId, ctx),
    listaDeCompra: routes.fazendas.safraListaDeCompra(farmId, cycleId, ctx),
    planoDeCusto: routes.fazendas.safraPlanoDeCusto(farmId, cycleId, ctx),
    estoque: routes.fazendas.estoque(farmId, ctx),
    novaListaDeCompra: routes.fazendas.novaListaDeCompra(farmId, {
      cycle_id: cycleId,
      producer_id: producerId,
    }),
  };

  const breadcrumbs: BreadcrumbItem[] = [
    { label: "Produtores", href: routes.produtores.lista },
    ...(producerIdParam && producer
      ? [
          {
            label: producer.name,
            href: routes.produtores.detalhe(producerIdParam),
          },
        ]
      : []),
    ...(farm ? [{ label: farm.name, href: hrefs.farm }] : []),
    { label: cycle?.name ?? "Safra" },
  ];

  const seasons: CycleSeasonRow[] = useMemo(
    () => cycle?.seasons ?? [],
    [cycle],
  );
  const draftSeasons = useMemo(
    () => seasons.filter((s) => s.status === "DRAFT"),
    [seasons],
  );

  return {
    farmId,
    cycleId,
    producerIdParam,
    producerId,
    cycle,
    farm,
    producer,
    isLoading,
    hrefs,
    breadcrumbs,
    seasons,
    draftSeasons,
  };
}

export type CyclePage = ReturnType<typeof useCyclePage>;

/**
 * Moldura das telas da safra: breadcrumb + hero (nome, status, publicar) e,
 * nas subrotas, o link de volta. Publicar fica visível em TODAS as telas
 * enquanto houver talhão em rascunho — sem isso a programação não aparece no
 * cronograma e o botão passava despercebido.
 */
export function CyclePageShell({
  page,
  stats = [],
  actions,
  backHref,
  children,
}: {
  page: CyclePage;
  /** Métricas extras do hero, depois de Culturas/Fazenda. */
  stats?: PageHeroStat[];
  /** Ações extras do hero, depois do botão Publicar. */
  actions?: ReactNode;
  /** Quando definido, mostra "Voltar à safra" acima do conteúdo. */
  backHref?: Route;
  children: ReactNode;
}) {
  const { cycle, farm, isLoading, breadcrumbs, draftSeasons } = page;
  const publishCycle = usePublishCycle(page.cycleId);
  const [publishConfirm, setPublishConfirm] = useState(false);

  if (isLoading || !cycle) {
    return (
      <>
        <BreadcrumbBack items={breadcrumbs} />
        <ListCardsSkeleton count={3} />
      </>
    );
  }

  const isPlanning = page.seasons.length === 0;

  const heroStats: PageHeroStat[] = [
    {
      label: "Culturas",
      value: cycle.crops.map((c) => CROP_LABELS[c] ?? c).join(" + "),
    },
    ...(farm?.name ? [{ label: "Fazenda", value: farm.name }] : []),
    ...stats,
  ];

  return (
    <>
      <BreadcrumbBack items={breadcrumbs} />

      <PageHero
        variant="inverted"
        icon={<Leaf className="size-6" />}
        eyebrow="Safra"
        title={cycle.name}
        titleBadge={
          isPlanning ? (
            <Badge variant="neutral">Em planejamento</Badge>
          ) : (
            <Badge variant={cycle.status === "ACTIVE" ? "success" : "neutral"}>
              {CYCLE_STATUS_LABELS[cycle.status] ?? cycle.status}
            </Badge>
          )
        }
        actions={
          <>
            {draftSeasons.length > 0 ? (
              <Button
                className="gap-1.5"
                onClick={() => setPublishConfirm(true)}
                disabled={publishCycle.isPending}
              >
                <Rocket className="size-4" />
                {publishCycle.isPending
                  ? "Publicando..."
                  : "Revisar e publicar"}
              </Button>
            ) : null}
            {actions}
          </>
        }
        stats={heroStats}
      />

      {backHref ? (
        <div className="mb-6">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
          >
            <Link href={backHref}>
              <ArrowLeft className="size-4" />
              Voltar à safra
            </Link>
          </Button>
        </div>
      ) : null}

      {children}

      <ConfirmDialog
        open={publishConfirm}
        onOpenChange={setPublishConfirm}
        title="Publicar programação da safra"
        description={`${draftSeasons.length} ${
          draftSeasons.length === 1
            ? "talhão em rascunho será publicado"
            : "talhões em rascunho serão publicados"
        } e o produtor passa a ver o cronograma. Continuar?`}
        confirmLabel="Publicar"
        loading={publishCycle.isPending}
        onConfirm={async () => {
          await new Promise<void>((resolve, reject) =>
            publishCycle.mutate(undefined, {
              onSuccess: () => {
                setPublishConfirm(false);
                toast.success("Programação da safra publicada!");
                resolve();
              },
              onError: (err) => {
                toast.error(
                  "Não foi possível publicar. Verifique a quota do plano.",
                );
                reject(err);
              },
            }),
          );
        }}
      />
    </>
  );
}
