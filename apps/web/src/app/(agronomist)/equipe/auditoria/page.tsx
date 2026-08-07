"use client";

import { Suspense } from "react";
import { TeamAuditTrail } from "@/components/domain/team-audit-trail";
import { Skeleton } from "@recomenda/ui/primitives/skeleton";

function TrailFallback() {
  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-6">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function EquipeAuditoriaPage() {
  return (
    <Suspense fallback={<TrailFallback />}>
      <TeamAuditTrail />
    </Suspense>
  );
}
