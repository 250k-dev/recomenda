"use client";

import { useSyncExternalStore } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { Sparkles } from "lucide-react";
import { useActiveScope, useMe } from "@recomenda/api-hooks";
import { scopeRoleLabel } from "@/lib/scope-label";

// Saudação pelo relógio local do usuário, só no cliente: no SSR o fuso é o do
// servidor, então lá cai no "Olá" neutro para não hidratar com valor errado.
const subscribeNoop = () => () => {};
const getGreeting = () => {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
};

/** Saudação do Dashboard, exibida na linha do header ao lado da busca e do menu. */
export function DashboardGreeting({ compact = false }: { compact?: boolean }) {
  const { data: me } = useMe();
  const activeScope = useActiveScope();
  const salute = useSyncExternalStore(subscribeNoop, getGreeting, () => "Olá");

  // Primeiro + segundo nome (ex.: "João Victor"); ignora partículas curtas sozinhas.
  const displayName = (() => {
    const parts = (me?.name ?? "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "";
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[1]}`;
  })();
  const dateLabel = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });
  const roleLabel = scopeRoleLabel(activeScope?.access_level).toUpperCase();

  return (
    <div className="min-w-0">
      {compact ? null : activeScope ? (
        <div className="mb-0.5 flex min-w-0 items-center gap-2">
          <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-primary px-2 text-[10px] font-bold uppercase tracking-[0.08em] text-primary-foreground">
            <Sparkles className="size-2.5" aria-hidden />
            {roleLabel}
          </span>
          <p className="truncate font-display text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Carteira de {activeScope.agronomist_name}
          </p>
        </div>
      ) : (
        <p className="truncate font-display text-[11px] font-bold uppercase tracking-[0.12em] text-primary-strong">
          {dateLabel}
        </p>
      )}
      <h1
        className={
          compact
            ? "truncate font-display text-base font-semibold tracking-[-0.02em] text-text-strong"
            : "truncate font-display text-xl font-semibold tracking-[-0.02em] text-text-strong md:text-2xl"
        }
      >
        {salute}
        {displayName ? `, ${displayName}` : ""}
      </h1>
    </div>
  );
}
