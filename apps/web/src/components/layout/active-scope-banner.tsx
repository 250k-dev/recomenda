"use client";

import { Briefcase } from "lucide-react";
import {
  useActiveScope,
  useExitContext,
  useMemberships,
} from "@recomenda/api-hooks";
import { Button } from "@recomenda/ui/primitives/button";
import { scopeOfLabel } from "@/lib/scope-label";

/**
 * Faixa fixa no topo quando o usuário está imerso numa carteira e pode sair
 * (tem carteira própria ou outras gestões). STAFF com uma única gestão não vê
 * a faixa — o contexto aparece só no greeting ("Gestor de …").
 */
export function ActiveScopeBanner() {
  const activeScope = useActiveScope();
  const { data: memberships } = useMemberships();
  const exitMutation = useExitContext();

  const canExitScope =
    (memberships?.has_own_carteira ?? false) ||
    (memberships?.memberships.length ?? 0) > 1;

  if (!activeScope || !canExitScope) {
    return null;
  }

  return (
    <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-primary/25 bg-primary px-4 py-2.5 text-sm text-primary-foreground md:px-8">
      <span className="flex items-center gap-2 min-w-0">
        <Briefcase className="size-4 shrink-0 opacity-90" />
        <span className="truncate font-semibold">
          {scopeOfLabel(activeScope.agronomist_name, activeScope.access_level)}
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
