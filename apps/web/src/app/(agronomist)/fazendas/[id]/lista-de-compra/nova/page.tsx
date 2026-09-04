"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQueries } from "@tanstack/react-query";
import { BreadcrumbBack, type BreadcrumbItem } from "@/components/domain/breadcrumb-back";
import { routes } from "@recomenda/config";
import { PurchaseListWizard } from "@/components/domain/purchase-list-wizard";
import { Button } from "@recomenda/ui/primitives/button";
import { getFarmPlots } from "@recomenda/api/farms";
import {
  queryKeys,
  useCycle,
  useCyclePurchaseList,
  useFarm,
  useFarmPlots,
  useProducer,
} from "@recomenda/api-hooks";

export default function FarmPurchaseListNewPage() {
  const params = useParams<{ id: string }>();
  const farmId = params.id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const producerId = searchParams.get("producer_id") ?? "";
  const cycleId = searchParams.get("cycle_id");
  const onboarding = searchParams.get("onboarding");

  const { data: farm } = useFarm(farmId);
  const { data: producer } = useProducer(producerId);
  const { data: cycle, isLoading: cycleLoading } = useCycle(cycleId ?? "");
  // Fallback: fazenda da URL (lista sem safra / legado).
  const { data: anchorPlots } = useFarmPlots(cycleId ? "" : farmId);

  // Uma safra tem apenas UMA lista de compra. Se já existe FINALIZADA, não deixa
  // criar outra — redireciona para a lista. Se for RASCUNHO, reabre o wizard
  // preenchido para continuar (o rascunho ocupa a vaga da safra).
  const {
    data: existingList,
    isLoading: listLoading,
    isError: listError,
  } = useCyclePurchaseList(cycleId ?? "");
  const isDraft = existingList?.status === "draft";
  const hasActiveList = Boolean(existingList) && !isDraft;
  const cycleHref = cycleId
    ? routes.fazendas.safraListaDeCompra(farmId, cycleId, {
        producer_id: producerId,
      })
    : null;
  useEffect(() => {
    if (cycleId && hasActiveList && cycleHref) {
      router.replace(cycleHref);
    }
  }, [cycleId, hasActiveList, cycleHref, router]);

  // Safra multi-fazenda: talhões cadastrais de TODAS as fazendas do ciclo.
  const cycleFarmIds = useMemo(() => {
    if (!cycleId) return [] as string[];
    const fromCycle = (cycle?.farms ?? []).map((f) => f.id);
    if (fromCycle.length > 0) return fromCycle;
    return farmId ? [farmId] : [];
  }, [cycleId, cycle?.farms, farmId]);

  const cyclePlotQueries = useQueries({
    queries: cycleFarmIds.map((id) => ({
      queryKey: queryKeys.farmPlots(id),
      queryFn: () => getFarmPlots(id),
      enabled: Boolean(cycleId && id),
    })),
  });

  const plotsLoading =
    Boolean(cycleId) &&
    (cycleLoading || cyclePlotQueries.some((q) => q.isLoading || q.isFetching));

  const cyclePlotsReady = cyclePlotQueries.map((q) => q.data ?? null);

  const plots = useMemo(() => {
    if (cycleId) {
      const nameByFarm = new Map(
        (cycle?.farms ?? []).map((f) => [f.id, f.name] as const),
      );
      if (farm?.name) nameByFarm.set(farmId, farm.name);
      return cycleFarmIds.flatMap((fId, index) => {
        const rows = cyclePlotsReady[index] ?? [];
        return rows.map((p) => ({
          id: p.id,
          name: p.name,
          area: Number(p.area_hectares) || 0,
          farmId: fId,
          farmName: nameByFarm.get(fId) ?? "Fazenda",
        }));
      });
    }
    return (anchorPlots ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      area: Number(p.area_hectares) || 0,
      farmId,
      farmName: farm?.name ?? "Fazenda",
    }));
  }, [
    cycleId,
    cycle?.farms,
    cycleFarmIds,
    cyclePlotsReady,
    anchorPlots,
    farmId,
    farm,
  ]);

  const farmCount = cycle?.farms?.length ?? 0;
  const farmLabel =
    cycleId && farmCount > 1 ? `${farmCount} fazendas` : farm?.name;

  const producerHref = producerId
    ? routes.produtores.detalhe(producerId)
    : routes.produtores.lista;
  const farmHref = routes.fazendas.detalhe(farmId, { producer_id: producerId });
  const cycleHrefNav =
    cycleId && cycle
      ? routes.fazendas.safra(farmId, cycleId, { producer_id: producerId })
      : null;

  // Multi-fazenda: o crumb anterior à lista é a safra (não uma fazenda só).
  const breadcrumbs: BreadcrumbItem[] = [
    { label: "Produtores", href: routes.produtores.lista },
    ...(producerId && producer
      ? [{ label: producer.name, href: producerHref }]
      : []),
    ...(cycleId && cycle && cycleHrefNav
      ? [{ label: cycle.name, href: cycleHrefNav }]
      : farm
        ? [{ label: farm.name, href: farmHref }]
        : []),
    { label: "Lista de compra" },
  ];

  if (!producerId) {
    return (
      <>
        <BreadcrumbBack items={breadcrumbs} />
        <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Informe o produtor na URL (parâmetro{" "}
            <code className="rounded bg-muted px-1">producer_id</code>).
          </p>
          <Button asChild className="mt-4" variant="outline">
            <Link href={farmHref}>Voltar à fazenda</Link>
          </Button>
        </div>
      </>
    );
  }

  if (plotsLoading) {
    return (
      <>
        <BreadcrumbBack items={breadcrumbs} />
        <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Carregando talhões das fazendas da safra…
          </p>
        </div>
      </>
    );
  }

  if (plots.length === 0) {
    return (
      <>
        <BreadcrumbBack items={breadcrumbs} />
        <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {cycleId
              ? "Cadastre pelo menos um talhão nas fazendas desta safra antes de montar a lista de compra."
              : "Cadastre pelo menos um talhão nesta fazenda antes de montar a lista de compra."}
          </p>
          <Button asChild className="mt-4" variant="outline">
            <Link href={farmHref}>Voltar à fazenda</Link>
          </Button>
        </div>
      </>
    );
  }

  if (cycleId && listError) {
    return (
      <>
        <BreadcrumbBack items={breadcrumbs} />
        <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Não foi possível verificar a lista desta safra. O rascunho, se existir, continua salvo.
          </p>
          <Button asChild className="mt-4" variant="outline">
            <Link href={cycleHrefNav ?? farmHref}>Voltar à safra</Link>
          </Button>
        </div>
      </>
    );
  }

  // Já existe lista FINALIZADA para esta safra (ou ainda verificando): não abre o
  // wizard. Rascunho não cai aqui — segue para o wizard preenchido abaixo.
  if (cycleId && (listLoading || hasActiveList)) {
    return (
      <>
        <BreadcrumbBack items={breadcrumbs} />
        <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {hasActiveList
              ? "Esta safra já tem uma lista de compra. Abrindo a lista existente…"
              : "Verificando a lista de compra da safra…"}
          </p>
          {hasActiveList && cycleHref ? (
            <Button asChild className="mt-4" variant="outline">
              <Link href={cycleHref}>Ir para a lista de compra</Link>
            </Button>
          ) : null}
        </div>
      </>
    );
  }

  return (
    <>
      <BreadcrumbBack items={breadcrumbs} />
      <PurchaseListWizard
        producerId={producerId}
        producerName={producer?.name ?? "Produtor"}
        plots={plots}
        farmName={farmLabel}
        cycleId={cycleId}
        draftList={isDraft ? existingList : null}
        successRedirectLabel={cycleId ? "Ir para a safra" : "Ir para o produtor"}
        onComplete={() => {
          if (onboarding === "recommendation") {
            router.push(
              routes.produtores.detalhe(producerId, {
                onboarding: "recommendation",
                farm_id: farmId,
                cycle_id: cycleId,
              }),
            );
            return;
          }
          if (cycleId) {
            router.push(
              routes.fazendas.safra(farmId, cycleId, {
                producer_id: producerId,
              }),
            );
            return;
          }
          router.push(producerHref);
        }}
        onCancel={() =>
          router.push(
            cycleId
              ? routes.fazendas.safra(farmId, cycleId, {
                  producer_id: producerId,
                })
              : producerHref,
          )
        }
      />
    </>
  );
}
