"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, Leaf, Pencil, Rocket } from "lucide-react";
import { toast } from "sonner";
import type { Route } from "next";
import { BreadcrumbBack, type BreadcrumbItem } from "@/components/domain/breadcrumb-back";
import { PageHero, type PageHeroStat } from "@/components/domain/page-hero";
import { ListCardsSkeleton } from "@/components/domain/page-skeletons";
import { Badge } from "@recomenda/ui/primitives/badge";
import { Button } from "@recomenda/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recomenda/ui/primitives/dialog";
import { Input } from "@recomenda/ui/primitives/input";
import { ConfirmDialog } from "@recomenda/ui/patterns/confirm-dialog";
import {
  useCan,
  useCycle,
  useFarm,
  useProducer,
  usePublishCycle,
  useUpdateCycle,
} from "@recomenda/api-hooks";
import { apiErrorMessage, publishBlockedMessage } from "@recomenda/api/api-error";
import type { CycleSeasonRow } from "@recomenda/api/cycles";
import { CROP_LABELS, CYCLE_STATUS_LABELS, labelStatus } from "@recomenda/utils";
import { routes } from "@recomenda/config";
import { CycleExportButton } from "@/components/domain/cycle/cycle-export";

/**
 * Contexto comum das telas da safra da fazenda (`/fazendas/[id]/safras/[cycleId]`
 * e subrotas): dados do ciclo, produtor do contexto, hrefs e breadcrumbs.
 * As queries são compartilhadas via cache do React Query entre as subrotas.
 *
 * Breadcrumb dentro da safra: Produtores → Produtor → Safra
 * (fazenda só aparece nas telas de talhão/recomendação, abaixo da safra).
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
  const updateCycle = useUpdateCycle(page.cycleId);
  const canEdit = useCan("CYCLE_CRUD");
  const [publishConfirm, setPublishConfirm] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");

  if (isLoading || !cycle) {
    return (
      <>
        <BreadcrumbBack items={breadcrumbs} />
        <ListCardsSkeleton count={3} />
      </>
    );
  }

  const isPlanning = page.seasons.length === 0;
  const isMultiFarm = cycle.farms.length > 1;

  const heroStats: PageHeroStat[] = [
    {
      label: "Culturas",
      value: cycle.crops.map((c) => CROP_LABELS[c] ?? c).join(" + "),
    },
    // Multi-fazenda: as fazendas já aparecem na seção abaixo — evita chips no hero.
    ...(!isMultiFarm && farm?.name
      ? [{ label: "Fazenda", value: farm.name }]
      : []),
    ...stats,
  ];

  const openEdit = () => {
    setEditName(cycle.name);
    setEditOpen(true);
  };

  return (
    <>
      <BreadcrumbBack items={breadcrumbs} />

      <PageHero
        variant="inverted"
        icon={<Leaf className="size-6" />}
        eyebrow="Safra"
        title={cycle.name}
        titleAction={
          canEdit ? (
            <Button
              variant="secondary"
              size="icon-xs"
              onClick={openEdit}
              aria-label="Editar nome da safra"
            >
              <Pencil />
            </Button>
          ) : undefined
        }
        titleBadge={
          <span className="inline-flex flex-wrap items-center gap-1.5">
            {isPlanning ? (
              <Badge variant="neutral">Em planejamento</Badge>
            ) : (
              <Badge variant={cycle.status === "ACTIVE" ? "success" : "neutral"}>
                {labelStatus(CYCLE_STATUS_LABELS, cycle.status)}
              </Badge>
            )}
            {cycle.awaiting_purchase ? (
              <Badge variant="warning">Aguardando compra</Badge>
            ) : null}
          </span>
        }
        actions={
          <>
            <CycleExportButton
              cycleId={page.cycleId}
              producerId={page.producerId}
            />
            {draftSeasons.length > 0 ? (
              <Button
                className="gap-1.5 border-0 bg-primary-soft text-primary-strong shadow-sm hover:bg-primary-soft/85 hover:text-primary-strong"
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar safra</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 px-6 py-5">
            <label
              htmlFor="edit-cycle-name"
              className="mb-1.5 block text-xs font-medium text-foreground"
            >
              Nome
            </label>
            <Input
              id="edit-cycle-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Ex: Safra 2026/27"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={updateCycle.isPending || !editName.trim()}
              onClick={() => {
                updateCycle.mutate(
                  { name: editName.trim() },
                  {
                    onSuccess: () => {
                      toast.success("Nome da safra atualizado.");
                      setEditOpen(false);
                    },
                    onError: (err) =>
                      toast.error(
                        apiErrorMessage(
                          err,
                          "Não foi possível atualizar a safra.",
                        ),
                      ),
                  },
                );
              }}
            >
              {updateCycle.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                toast.error(publishBlockedMessage(err));
                reject(err);
              },
            }),
          );
        }}
      />
    </>
  );
}
