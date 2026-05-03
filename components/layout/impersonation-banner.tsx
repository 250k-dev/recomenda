"use client";

import { useExitImpersonation } from "@/lib/api/hooks";
import { useImpersonationStore } from "@/stores/impersonation";
import { Button } from "@/components/ui/button";

export function ImpersonationBanner() {
  const { isImpersonating, producerName } = useImpersonationStore();
  const exitImpersonationMutation = useExitImpersonation();

  if (!isImpersonating) {
    return null;
  }

  return (
    <div className="sticky top-0 z-20 flex items-center justify-between border-b border-yellow-300 bg-yellow-100 px-6 py-3 text-sm text-yellow-900">
      <span>
        Atuando como <strong>{producerName}</strong>
      </span>
      <Button
        variant="secondary"
        className="h-8"
        onClick={() => exitImpersonationMutation.mutate()}
      >
        Sair da personificação
      </Button>
    </div>
  );
}
