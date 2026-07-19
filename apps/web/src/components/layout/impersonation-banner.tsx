"use client";

import { useExitImpersonation } from "@recomenda/api-hooks";
import { useImpersonationStore } from "@recomenda/api-hooks/impersonation-store";
import { Button } from "@recomenda/ui/button";

export function ImpersonationBanner() {
  const { isImpersonating, producerName } = useImpersonationStore();
  const exitImpersonationMutation = useExitImpersonation();

  if (!isImpersonating) {
    return null;
  }

  return (
    <div className="sticky top-0 z-20 flex items-center justify-between border-b border-amber-200/80 bg-amber-50 px-4 py-2.5 text-sm text-amber-950 md:px-8">
      <span>
        Atuando como <strong>{producerName}</strong>
      </span>
      <Button
        variant="secondary"
        size="sm"
        className="h-8"
        onClick={() => exitImpersonationMutation.mutate()}
      >
        Sair da personificação
      </Button>
    </div>
  );
}
