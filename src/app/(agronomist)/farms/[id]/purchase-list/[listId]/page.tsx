"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { Pencil } from "lucide-react";
import { DetailToolbar } from "@/components/domain/detail-toolbar";
import { FarmPurchaseListTab } from "@/components/domain/farm-purchase-list-tab";
import { Button } from "@/components/ui/button";
import {
  useFarm,
  useProducer,
  useFarmPurchaseLists,
  useProducerPurchaseLists,
} from "@/lib/api/hooks";
import type { PurchaseListDetail } from "@/lib/api/client";

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

  const farmHref = producerId
    ? `/farms/${farmId}?producer_id=${encodeURIComponent(producerId)}`
    : `/farms/${farmId}`;
  const editHref = `${farmHref}${producerId ? "&" : "?"}tab=purchase`;

  return (
    <>
      <DetailToolbar
        items={[
          { label: "Produtores", href: "/producers" },
          ...(producerId && producer
            ? [{ label: producer.name, href: `/producers/${producerId}` }]
            : []),
          ...(farm ? [{ label: farm.name, href: farmHref }] : []),
          { label: list?.name ?? "Lista de compra" },
        ]}
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
