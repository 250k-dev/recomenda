"use client";

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/domain/page-header";
import { usePlanQuota } from "@/lib/api/hooks";

export default function PlanPage() {
  const { data } = usePlanQuota();
  return (
    <>
      <PageHeader title="Plano e quota" description="Uso atual da quota de talhões ativos." />
      <Card>
        <p className="text-sm text-zinc-700">
          Quota ativa: <strong>{data?.current ?? 0}</strong> / <strong>{data?.limit ?? 0}</strong>
        </p>
      </Card>
    </>
  );
}
