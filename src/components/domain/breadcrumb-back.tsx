"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Fragment } from "react";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function BreadcrumbBack({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-4 flex flex-wrap items-center gap-1 text-sm text-muted-foreground"
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
    </nav>
  );
}
