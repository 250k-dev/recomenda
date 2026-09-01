"use client";

import { Briefcase, Check, ChevronDown, Home } from "lucide-react";
import { cn } from "@recomenda/utils";
import {
  useActiveScope,
  useExitContext,
  useMemberships,
  useSwitchContext,
} from "@recomenda/api-hooks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@recomenda/ui/primitives/dropdown-menu";

/**
 * Seletor de carteira. Fora de um escopo ativo: troca entre própria e gestões.
 * Dentro de um escopo ativo: deixa explícito que a sessão está naquela carteira
 * e oferece sair / trocar para outra gestão.
 */
export function ScopeSwitcher({ compact = false }: { compact?: boolean }) {
  const { data: memberships } = useMemberships();
  const activeScope = useActiveScope();
  const switchMutation = useSwitchContext();
  const exitMutation = useExitContext();

  const list = memberships?.memberships ?? [];
  const hasOwn = memberships?.has_own_carteira ?? false;

  const totalContexts = (hasOwn ? 1 : 0) + list.length;
  if (totalContexts <= 1) {
    return null;
  }

  const isPending = switchMutation.isPending || exitMutation.isPending;
  const currentLabel = activeScope
    ? activeScope.agronomist_name
    : hasOwn
      ? "Minha carteira"
      : "Trocar carteira";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Trocar carteira"
        disabled={isPending}
        className={cn(
          "flex items-center rounded-lg border border-border bg-card text-sm font-medium outline-none transition-shadow hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60",
          compact ? "size-11 justify-center" : "h-11 gap-2 px-3",
        )}
      >
        <Briefcase className="size-4 shrink-0 text-muted-foreground" />
        {compact ? (
          <span className="sr-only">{currentLabel}</span>
        ) : (
          <>
            <span className="max-w-40 truncate">{currentLabel}</span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          </>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="w-64 rounded-xl">
        {activeScope ? (
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Operando nesta carteira
          </DropdownMenuLabel>
        ) : (
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Carteira ativa
          </DropdownMenuLabel>
        )}

        {hasOwn && (
          <DropdownMenuItem
            onSelect={() => {
              if (activeScope) exitMutation.mutate();
            }}
            className="gap-2.5 rounded-lg px-2.5 py-2.5 text-sm"
          >
            <Home className="size-4" />
            <span className="flex-1">Minha carteira</span>
            {!activeScope && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        )}

        {hasOwn && list.length > 0 && <DropdownMenuSeparator />}

        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Minhas gestões
        </DropdownMenuLabel>

        {list.map((membership) => {
          const isActive = activeScope?.agronomist_id === membership.agronomist_id;
          return (
            <DropdownMenuItem
              key={membership.agronomist_id}
              onSelect={() => {
                if (!isActive) switchMutation.mutate(membership.agronomist_id);
              }}
              className="gap-2.5 rounded-lg px-2.5 py-2.5 text-sm"
            >
              <Briefcase className="size-4" />
              <span className="flex-1 truncate">
                {membership.agronomist_name}
                <span className="ml-1.5 text-xs text-muted-foreground">
                  {membership.access_level === "MANAGER" ? "Gestor" : "Consultor"}
                </span>
              </span>
              {isActive && <Check className="size-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
