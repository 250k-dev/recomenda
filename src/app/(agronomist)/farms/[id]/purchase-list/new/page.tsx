"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { BreadcrumbBack } from "@/components/domain/breadcrumb-back";
import { PurchaseListWizard } from "@/components/domain/purchase-list-wizard";
import { Button } from "@/components/ui/button";
import {
  useCyclePurchaseList,
  useFarm,
  useFarmPlots,
  useProducer,
} from "@/lib/api/hooks";

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
  const { data: plotsData } = useFarmPlots(farmId);

  // Uma safra tem apenas UMA lista de compra. Se já existe FINALIZADA, não deixa
  // criar outra — redireciona para a lista. Se for RASCUNHO, reabre o wizard
  // preenchido para continuar (o rascunho ocupa a vaga da safra).
  const { data: existingList, isLoading: listLoading } = useCyclePurchaseList(
    cycleId ?? "",
  );
  const isDraft = existingList?.status === "draft";
  const hasActiveList = Boolean(existingList) && !isDraft;
  const cycleHref = cycleId
    ? `/farms/${farmId}/cycles/${cycleId}?producer_id=${encodeURIComponent(producerId)}&tab=purchase`
    : null;
  useEffect(() => {
    if (cycleId && hasActiveList && cycleHref) {
      router.replace(cycleHref);
    }
  }, [cycleId, hasActiveList, cycleHref, router]);

  const plots = useMemo(
    () =>
      (plotsData ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        area: Number(p.area_hectares) || 0,
        farmId,
        farmName: farm?.name ?? "Fazenda",
      })),
    [plotsData, farmId, farm?.name],
  );

  const producerHref = producerId ? `/producers/${producerId}` : "/producers";
  const farmHref = producerId
    ? `/farms/${farmId}?producer_id=${encodeURIComponent(producerId)}`
    : `/farms/${farmId}`;

  const breadcrumbs = [
    { label: "Produtores", href: "/producers" },
    ...(producerId && producer
      ? [{ label: producer.name, href: producerHref }]
      : []),
    ...(farm ? [{ label: farm.name, href: farmHref }] : []),
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

  if (plots.length === 0) {
    return (
      <>
        <BreadcrumbBack items={breadcrumbs} />
        <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Cadastre pelo menos um talhão nesta fazenda antes de montar a lista de compra.
          </p>
          <Button asChild className="mt-4" variant="outline">
            <Link href={farmHref}>Voltar à fazenda</Link>
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
        farmName={farm?.name}
        cycleId={cycleId}
        draftList={isDraft ? existingList : null}
        successRedirectLabel={cycleId ? "Ir para a safra" : "Ir para o produtor"}
        onComplete={() => {
          if (onboarding === "recommendation") {
            router.push(
              `/producers/${producerId}?onboarding=recommendation&farm_id=${encodeURIComponent(farmId)}${
                cycleId ? `&cycle_id=${encodeURIComponent(cycleId)}` : ""
              }`,
            );
            return;
          }
          if (cycleId) {
            router.push(
              `/farms/${farmId}/cycles/${cycleId}?producer_id=${encodeURIComponent(producerId)}`,
            );
            return;
          }
          router.push(producerHref);
        }}
        onCancel={() =>
          router.push(
            cycleId
              ? `/farms/${farmId}/cycles/${cycleId}?producer_id=${encodeURIComponent(producerId)}`
              : producerHref,
          )
        }
      />
    </>
  );
}
