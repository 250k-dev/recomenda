"use client";

import { ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@recomenda/utils";

/**
 * Cabeçalho de seção do design "Refactor Recomendações": título à esquerda,
 * busca + ações à direita. No mobile a busca desce para a própria linha
 * (largura total) — a ação primária deve migrar para a StickyMobileCta.
 */
export function SectionToolbar({
  title,
  titleAction,
  search,
  actions,
  className,
}: {
  title: ReactNode;
  /** Ação colada ao título (ex.: exportar), antes do espaçador. */
  titleAction?: ReactNode;
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
  };
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex flex-wrap items-center gap-3", className)}>
      <div className="flex min-w-0 flex-none items-center gap-2">
        <h2 className="min-w-0 font-display text-lg font-semibold text-text-strong">
          {title}
        </h2>
        {titleAction}
      </div>
      <div className="hidden min-w-4 flex-1 sm:block" />
      {search ? (
        <div className="relative order-last w-full sm:order-none sm:w-60 lg:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder}
            aria-label={search.placeholder}
            className="h-10 pl-9"
          />
        </div>
      ) : null}
      {actions ? (
        <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-0">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
