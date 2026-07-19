"use client";

import { useMe } from "@/lib/api/hooks";
import { can, type Permission } from "@/lib/auth/permissions";
import type { AccessLevel, UserRole } from "@recomenda/api/auth-types";

/** Principal atual (role + access_level) para gates de UI. */
export function usePrincipal() {
  const { data: me } = useMe();
  return {
    role: (me?.role ?? null) as UserRole | null,
    access_level: (me?.access_level ?? null) as AccessLevel | null,
    id: (me?.id ?? null) as string | null,
    me,
  };
}

/** Espelho visual de `can()` — esconder botões; o servidor é a autoridade. */
export function useCan(permission: Permission): boolean {
  const principal = usePrincipal();
  return can(principal, permission);
}
