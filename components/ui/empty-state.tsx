import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  variant?: "card" | "inline";
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  variant = "card",
}: EmptyStateProps) {
  const isInline = variant === "inline";
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-center",
        isInline
          ? "py-8"
          : "rounded-xl border border-dashed border-border bg-card/40 px-6 py-12 animate-fade-in",
        className,
      )}
    >
      {Icon ? (
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      ) : null}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description ? (
          <p className="mx-auto max-w-md text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}
