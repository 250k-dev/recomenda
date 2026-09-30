"use client";

import { useParams, useSearchParams } from "next/navigation";
import { BreadcrumbBack, type BreadcrumbItem } from "@/components/domain/breadcrumb-back";
import { EmptyState } from "@recomenda/ui/patterns/empty-state";
import { ProducerStockSection } from "@/components/domain/producer-stock-section";
import {
  useCycle,
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
  // O estoque é do produtor; o caminho mostra de onde a tela foi aberta.
  const from = searchParams.get("from");
  const cycleId = searchParams.get("cycle_id") ?? "";

  const { data: farm } = useFarm(farmId);
  const { data: producer } = useProducer(producerId ?? "");
  const { data: cycle } = useCycle(from === "lista" ? cycleId : "");
  const resolvedProducerId = useResolvedFarmProducerId(farmId, producerId);

  const farmHref = routes.fazendas.detalhe(farmId, {
    producer_id: producerId,
  });

  const producerCrumb: BreadcrumbItem[] =
    producerId && producer
      ? [{ label: producer.name, href: routes.produtores.detalhe(producerId) }]
      : [];
  const listHref =
    from === "lista" && cycleId
      ? routes.fazendas.safraListaDeCompra(farmId, cycleId, { producer_id: producerId })
      : null;

  const middle: BreadcrumbItem[] =
    from === "produtor"
      ? []
      : listHref
        ? [
            {
              label: cycle?.name ?? "Safra",
              href: routes.fazendas.safra(farmId, cycleId, { producer_id: producerId }),
            },
            { label: "Lista de compra", href: listHref },
          ]
        : farm
          ? [{ label: farm.name, href: farmHref }]
          : [];

  const breadcrumbs: BreadcrumbItem[] = [
    { label: "Produtores", href: routes.produtores.lista },
    ...producerCrumb,
    ...middle,
    { label: "Estoque" },
  ];

  return (
    <>
      <BreadcrumbBack items={breadcrumbs} />

      {resolvedProducerId ? (
        <ProducerStockSection
          producerId={resolvedProducerId}
          producerName={producer?.name}
        />
      ) : (
        <EmptyState
          title="Produtor não vinculado"
          description="Associe um produtor a esta fazenda para gerenciar o estoque."
        />
      )}
    </>
  );
}
