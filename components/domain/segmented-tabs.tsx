"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SegmentedTabItem<T extends string = string> = {
  value: T;
  label: ReactNode;
  badgeCount?: number;
};

export type SegmentedTabsProps<T extends string> = {
  value: T;
  onValueChange: (value: T) => void;
  items: SegmentedTabItem<T>[];
  className?: string;
};

export function SegmentedTabs<T extends string>({
  value,
  onValueChange,
  items,
  className,
}: SegmentedTabsProps<T>) {
  return (
    <div
      className={cn(
        "flex w-fit gap-1 rounded-lg border border-zinc-200 bg-zinc-100 p-1",
        className,
      )}
    >
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onValueChange(item.value)}
          className={cn(
            "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
            value === item.value
              ? "bg-white text-zinc-900 shadow-sm"
              : "text-zinc-500 hover:text-zinc-800",
          )}
        >
          {item.label}
          {item.badgeCount != null && item.badgeCount > 0 ? (
            <span className="ml-2 rounded-full bg-zinc-300 px-1.5 py-0.5 text-xs text-zinc-700">
              {item.badgeCount}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
