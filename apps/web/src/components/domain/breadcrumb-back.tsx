"use client";

import type { Route } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Fragment, useEffect } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useBreadcrumbSetter } from "@/components/layout/breadcrumbs-context";
import { cn } from "@/lib/utils";

export type BreadcrumbItem = {
  label: string;
  href?: Route;
};

/**
 * Desktop (≥sm): container segmentado (1b) — cápsula branca com a trilha
 * completa separada por "/" e a página atual numa pílula verde.
 */
function DesktopTrail({ items }: { items: BreadcrumbItem[] }) {
  return (
    <ol className="hidden w-fit max-w-full flex-wrap items-center gap-2.5 rounded-full border bg-search py-1.5 pr-2 pl-4.5 text-sm shadow-2xs sm:flex">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <Fragment key={`${idx}-${item.label}`}>
            <li className="flex items-center">
              {isLast ? (
                <span
                  aria-current="page"
                  className="rounded-full bg-primary px-3.5 py-1.5 font-semibold text-primary-foreground"
                >
                  {item.label}
                </span>
              ) : item.href ? (
                <Link
                  href={item.href}
                  className="font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="font-medium text-muted-foreground">
                  {item.label}
                </span>
              )}
            </li>
            {!isLast ? (
              <li aria-hidden className="text-border-strong select-none">
                /
              </li>
            ) : null}
          </Fragment>
        );
      })}
    </ol>
  );
}

/** Item da trilha (link ou texto) usado dentro do popover mobile. */
function HiddenLevel({ item }: { item: BreadcrumbItem }) {
  const inner = (
    <>
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full bg-border-strong"
      />
      <span className="truncate">{item.label}</span>
    </>
  );
  const base =
    "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground";
  return item.href ? (
    <Link
      href={item.href}
      className={cn(base, "transition-colors hover:bg-hover hover:text-foreground")}
    >
      {inner}
    </Link>
  ) : (
    <span className={base}>{inner}</span>
  );
}

/**
 * Mobile (<sm): recolhido (1e) — mostra origem "…" atual. O "…" abre um
 * popover com os níveis intermediários ocultos, sem sair da tela.
 */
function MobileTrail({ items }: { items: BreadcrumbItem[] }) {
  const first = items[0];
  const last = items[items.length - 1];
  const hidden = items.slice(1, -1);
  const single = items.length === 1;

  // Mesma cápsula do desktop (branca, borda, sombra); largura do conteúdo.
  const currentPill =
    "min-w-0 truncate rounded-full bg-primary px-3.5 py-1.5 font-semibold text-primary-foreground";

  return (
    <div className="inline-flex max-w-full items-center gap-2 rounded-full border bg-search py-1.5 pr-2 pl-4 text-sm shadow-2xs sm:hidden">
      {single ? (
        <span aria-current="page" className={currentPill}>
          {first.label}
        </span>
      ) : (
        <>
          {first.href ? (
            <Link
              href={first.href}
              className="shrink-0 font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {first.label}
            </Link>
          ) : (
            <span className="shrink-0 font-medium text-muted-foreground">
              {first.label}
            </span>
          )}

          {hidden.length > 0 ? (
            <>
              <ChevronRight
                className="size-3 shrink-0 text-border-strong"
                aria-hidden
              />
              <Popover>
                <PopoverTrigger
                  aria-label="Mostrar níveis ocultos"
                  className="shrink-0 rounded-md bg-hover px-2.5 py-1.5 font-semibold text-muted-foreground transition-colors data-[state=open]:bg-primary data-[state=open]:text-primary-foreground"
                >
                  …
                </PopoverTrigger>
                <PopoverContent align="start" sideOffset={8} className="w-52 p-1.5">
                  <ul className="flex flex-col">
                    {hidden.map((item, idx) => (
                      <li key={`${idx}-${item.label}`}>
                        <HiddenLevel item={item} />
                      </li>
                    ))}
                  </ul>
                </PopoverContent>
              </Popover>
            </>
          ) : null}

          <ChevronRight
            className="size-3 shrink-0 text-border-strong"
            aria-hidden
          />
          <span aria-current="page" className={currentPill}>
            {last.label}
          </span>
        </>
      )}
    </div>
  );
}

/** Trilha de navegação pura (sem margens) — usada inline e no header. */
export function BreadcrumbTrail({
  items,
  className,
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <DesktopTrail items={items} />
      <MobileTrail items={items} />
    </nav>
  );
}

/**
 * Breadcrumb da página. Dentro do BreadcrumbsProvider (área do agrônomo) a
 * trilha é publicada no header e nada é renderizado aqui; fora dele (área
 * admin) renderiza inline como antes.
 */
export function BreadcrumbBack({ items }: { items: BreadcrumbItem[] }) {
  const setHeaderItems = useBreadcrumbSetter();
  // Serializado para não re-publicar a cada render (páginas recriam o array).
  const serialized = JSON.stringify(items);

  useEffect(() => {
    if (!setHeaderItems) return;
    setHeaderItems(JSON.parse(serialized) as BreadcrumbItem[]);
    return () => setHeaderItems([]);
  }, [setHeaderItems, serialized]);

  if (setHeaderItems) return null;
  if (items.length === 0) return null;

  return <BreadcrumbTrail items={items} className="mb-4" />;
}
