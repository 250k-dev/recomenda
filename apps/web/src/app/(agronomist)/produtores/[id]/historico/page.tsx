"use client";

import { useParams, useSearchParams } from "next/navigation";
import { ProducerHistoryView } from "@/components/domain/producer-history-view";

export default function ProducerHistoryPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const cycleId = searchParams.get("cycle_id");
  const tab = searchParams.get("tab") === "estoque" ? "estoque" : "safra";

  return (
    <ProducerHistoryView
      producerId={params.id}
      tab={tab}
      cycleId={cycleId}
    />
  );
}
