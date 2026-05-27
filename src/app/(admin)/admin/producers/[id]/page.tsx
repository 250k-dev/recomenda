"use client";

import { useParams } from "next/navigation";
import { ProducerDetailView } from "@/components/domain/producer-detail-view";

export default function AdminProducerDetailPage() {
  const params = useParams<{ id: string }>();
  const producerId = params.id;

  return <ProducerDetailView producerId={producerId} backHref="/admin/producers" showSeasonActions={false} showImpersonate={false} />;
}
