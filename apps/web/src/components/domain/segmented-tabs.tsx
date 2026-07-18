"use client";

import type { ReactNode } from "react";
import { cn } from "@recomenda/utils";

export type SegmentedTabItem<T extends string = string> = {
  value: T;
  label: ReactNode;
  badgeCount?: number;
  /** Classe aplicada quando o item está ativo (cor própria por filtro). */
  activeClassName?: string;
};

export type SegmentedTabsProps<T extends string> = {
  value: T;
  onValueChange: (value: T) => void;
  items: SegmentedTabItem<T>[];
  variant?: "default" | "pill";
  className?: string;
};

export function SegmentedTabs<T extends string>({
  value,
  onValueChange,
  items,
  variant = "default",
  className,
}: SegmentedTabsProps<T>) {
  const isPill = variant === "pill";
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-surface-2 p-1",
        className,
      )}
    >
      {items.map((item) => {
        const isActive = value === item.value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onValueChange(item.value)}
            className={cn(
              "group relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all duration-200 outline-none",
              "focus-visible:ring-[3px] focus-visible:ring-ring/40",
              "rounded-lg px-4 py-2 text-sm",
              isActive
                ? item.activeClassName
                  ? `${item.activeClassName} shadow-sm`
                  : isPill
                    ? "bg-surface text-text-strong shadow-sm"
                    : "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-text-strong",
            )}
          >
            <span>{item.label}</span>
            {item.badgeCount != null && item.badgeCount > 0 ? (
              <span
                className={cn(
                  "min-w-5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums transition-colors",
                  isActive
                    ? "bg-white/25 text-current"
                    : "bg-muted-foreground/15 text-muted-foreground group-hover:bg-muted-foreground/25",
                )}
              >
                {item.badgeCount}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
