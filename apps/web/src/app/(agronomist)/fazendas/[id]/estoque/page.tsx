"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BreadcrumbBack, type BreadcrumbItem } from "@/components/domain/breadcrumb-back";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ProducerStockSection } from "@/components/domain/producer-stock-section";
import {
  useFarm,
  useProducer,
  useResolvedFarmProducerId,
} from "@recomenda/api-hooks";
import { routes } from "@recomenda/config";

/** Estoque do produtor no contexto da fazenda (era `?tab=stock` na fazenda). */
export default function FarmStockPage() {
  const params = useParams<{ id: string }>();
  const farmId = params.id;
  const searchParams = useSearchParams();
  const producerId = searchParams.get("producer_id");

  const { data: farm } = useFarm(farmId);
  const { data: producer } = useProducer(producerId ?? "");
  const resolvedProducerId = useResolvedFarmProducerId(farmId, producerId);

  const farmHref = routes.fazendas.detalhe(farmId, {
    producer_id: producerId,
  });

  const breadcrumbs: BreadcrumbItem[] = [
    { label: "Produtores", href: routes.produtores.lista },
    ...(producerId && producer
      ? [{ label: producer.name, href: routes.produtores.detalhe(producerId) }]
      : []),
    ...(farm ? [{ label: farm.name, href: farmHref }] : []),
    { label: "Estoque" },
  ];

  return (
    <>
      <BreadcrumbBack items={breadcrumbs} />

      <div className="mb-4">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
        >
          <Link href={farmHref}>
            <ArrowLeft className="size-4" />
            Voltar às safras
          </Link>
        </Button>
      </div>

      {resolvedProducerId ? (
        <ProducerStockSection producerId={resolvedProducerId} />
      ) : (
        <EmptyState
          title="Produtor não vinculado"
          description="Associe um produtor a esta fazenda para gerenciar o estoque."
        />
      )}
    </>
  );
}
