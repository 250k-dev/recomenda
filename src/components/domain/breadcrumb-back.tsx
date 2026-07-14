"use client";

import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Fragment } from "react";
import { cn } from "@/lib/utils";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function BreadcrumbBack({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null;

  // No mobile a trilha inteira não cabe: mostramos só "‹ nível anterior".
  const parent = items.length > 1 ? items[items.length - 2] : null;
  const backTarget = parent?.href ? parent : null;

  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
      {backTarget ? (
        <Link
          href={backTarget.href!}
          className="flex w-fit items-center gap-1.5 rounded-md py-0.5 pr-1.5 font-medium transition-colors hover:text-foreground sm:hidden"
        >
          <ArrowLeft className="size-4.5 shrink-0" aria-hidden />
          <span className="truncate">{backTarget.label}</span>
        </Link>
      ) : null}
      <div
        className={cn(
          "flex-wrap items-center gap-1",
          backTarget ? "hidden sm:flex" : "flex",
        )}
      >
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          const content =
            item.href && !isLast ? (
              <Link
                href={item.href}
                className="rounded-md px-1.5 py-0.5 transition-colors hover:bg-accent hover:text-foreground"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={
                  isLast
                    ? "px-1.5 py-0.5 font-medium text-foreground"
                    : "px-1.5 py-0.5"
                }
                aria-current={isLast ? "page" : undefined}
              >
                {item.label}
              </span>
            );

          return (
            <Fragment key={`${idx}-${item.label}`}>
              {content}
              {!isLast ? (
                <ChevronRight
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60"
                  aria-hidden
                />
              ) : null}
            </Fragment>
          );
        })}
      </div>
    </nav>
  );
}
