"use client";

import type { MembershipDto } from "@recomenda/api/auth-types";
import { useMe } from "./auth";

/** Escopo ativo (carteira de outro agrônomo) ou `null` se estiver na própria. */
export function useActiveScope(): MembershipDto | null {
  const { data: me } = useMe();
  return me?.active_scope ?? null;
}

/**
 * Segmento de queryKey por carteira. Evita misturar cache da conta própria com
 * a carteira hospedeira após switch (mesmo com reload, cobre navegação soft).
 */
export function useWalletScopeKey(): string {
  const activeScope = useActiveScope();
  return activeScope?.agronomist_id ?? "own";
}
