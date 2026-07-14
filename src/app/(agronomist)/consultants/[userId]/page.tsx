"use client";

import { useParams } from "next/navigation";
import { ConsultantDetailView } from "@/components/domain/consultant-detail-view";

export default function ConsultantDetailPage() {
  const params = useParams<{ userId: string }>();
  return <ConsultantDetailView userId={params.userId} />;
}
