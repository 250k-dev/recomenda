"use client";

import { routes } from "@/config/routes";

import { useParams } from "next/navigation";
import { ProducerDetailView } from "@/components/domain/producer-detail-view";

export default function ProducerDetailPage() {
  const params = useParams<{ id: string }>();
  const producerId = params.id;

  return <ProducerDetailView producerId={producerId} backHref={routes.produtores.lista} showSeasonActions />;
}
