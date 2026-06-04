"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { BreadcrumbBack } from "@/components/domain/breadcrumb-back";
import { PurchaseListWizard } from "@/components/domain/purchase-list-wizard";
import { Button } from "@/components/ui/button";
import { useFarm, useFarmPlots, useProducer } from "@/lib/api/hooks";

export default function FarmPurchaseListNewPage() {
  const params = useParams<{ id: string }>();
  const farmId = params.id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const producerId = searchParams.get("producer_id") ?? "";

  const { data: farm } = useFarm(farmId);
  const { data: producer } = useProducer(producerId);
  const { data: plotsData } = useFarmPlots(farmId);

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

  return (
    <>
      <BreadcrumbBack items={breadcrumbs} />
      <PurchaseListWizard
        producerId={producerId}
        producerName={producer?.name ?? "Produtor"}
        plots={plots}
        farmName={farm?.name}
        successRedirectLabel="Ir para o produtor"
        onComplete={() => router.push(producerHref)}
        onCancel={() => router.push(producerHref)}
      />
    </>
  );
}
