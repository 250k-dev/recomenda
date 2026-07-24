"use client";

import { Briefcase } from "lucide-react";
import { useActiveScope, useExitContext } from "@recomenda/api-hooks";
import { Button } from "@recomenda/ui/primitives/button";

/**
 * Faixa fixa no topo quando o usuário está imerso na carteira de OUTRO agrônomo.
 * A plataforma inteira opera só nesse contexto; o botão é a saída explícita.
 */
export function ActiveScopeBanner() {
  const activeScope = useActiveScope();
  const exitMutation = useExitContext();

  if (!activeScope) {
    return null;
  }

  const levelLabel = activeScope.access_level === "MANAGER" ? "Gestor" : "Operador";

  return (
    <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-primary/25 bg-primary px-4 py-2.5 text-sm text-primary-foreground md:px-8">
      <span className="flex items-center gap-2 min-w-0">
        <Briefcase className="size-4 shrink-0 opacity-90" />
        <span className="truncate">
          <span className="font-semibold">Carteira de {activeScope.agronomist_name}</span>
          <span className="opacity-80"> · {levelLabel}</span>
        </span>
      </span>
      <Button
        variant="secondary"
        size="sm"
        className="h-8 shrink-0 border-0 bg-white/15 text-primary-foreground hover:bg-white/25"
        disabled={exitMutation.isPending}
        onClick={() => exitMutation.mutate()}
      >
        Sair desta carteira
      </Button>
    </div>
  );
}
