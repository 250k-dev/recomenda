"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { Pencil } from "lucide-react";
import { DetailToolbar } from "@/components/domain/detail-toolbar";
import type { BreadcrumbItem } from "@/components/domain/breadcrumb-back";
import { FarmPurchaseListTab } from "@/components/domain/farm-purchase-list-tab";
import { Button } from "@/components/ui/button";
import {
  useFarm,
  useProducer,
  useFarmPurchaseLists,
  useProducerPurchaseLists,
} from "@recomenda/api-hooks";
import { routes } from "@recomenda/config";
import type { PurchaseListDetail } from "@recomenda/api";

export default function PurchaseListViewPage() {
  const params = useParams<{ id: string; listId: string }>();
  const farmId = params.id;
  const listId = params.listId;
  const searchParams = useSearchParams();
  const producerId = searchParams.get("producer_id");

  const { data: farm } = useFarm(farmId);
  const { data: producer } = useProducer(producerId ?? "");
  const { data: farmLists, isLoading: loadingFarm } = useFarmPurchaseLists(farmId);
  const { data: producerLists, isLoading: loadingProducer } =
    useProducerPurchaseLists(producerId ?? "");

  const list = useMemo<PurchaseListDetail | null>(() => {
    const map = new Map<string, PurchaseListDetail>();
    for (const l of [...(farmLists ?? []), ...(producerLists ?? [])]) {
      map.set(l.id, l);
    }
    return map.get(listId) ?? null;
  }, [farmLists, producerLists, listId]);

  const farmHref = routes.fazendas.detalhe(farmId, { producer_id: producerId });
  // A edição da lista acontece dentro da safra da fazenda — a fazenda lista as
  // safras e cada uma abre a própria lista de compra.
  const editHref = farmHref;

  const breadcrumbs: BreadcrumbItem[] = [
    { label: "Produtores", href: routes.produtores.lista },
    ...(producerId && producer
      ? [{ label: producer.name, href: routes.produtores.detalhe(producerId) }]
      : []),
    ...(farm ? [{ label: farm.name, href: farmHref }] : []),
    { label: list?.name ?? "Lista de compra" },
  ];

  return (
    <>
      <DetailToolbar
        items={breadcrumbs}
        actions={
          <Button asChild variant="clay">
            <Link href={editHref}>
              <Pencil className="size-4" /> Editar lista
            </Link>
          </Button>
        }
      />

      <FarmPurchaseListTab
        farmId={farmId}
        list={list}
        purchaseLists={list ? [list] : []}
        selectedListId={listId}
        onSelectList={() => {}}
        isLoading={loadingFarm || loadingProducer}
        producerId={producerId}
        newPurchaseListHref={editHref}
        fallbackSeasonIds={[]}
        readOnly
      />
    </>
  );
}
