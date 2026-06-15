import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Connected KPI band (mockup: grid-auto-flow column with hairline dividers).
 * Uses a `gap-px` + parent `bg-border` trick so dividers render cleanly in any
 * column count / wrap. One cell can be flagged `alert` (terracota highlight).
 */
export function KpiStrip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border shadow-sm lg:grid-flow-col lg:auto-cols-fr",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function KpiCell({
  label,
  value,
  sub,
  icon,
  alert = false,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  alert?: boolean;
}) {
  return (
    <div className={cn("px-5 py-4", alert ? "bg-clay-soft" : "bg-card")}>
      <div
        className={cn(
          "flex items-center gap-1.5 text-xs font-medium",
          alert ? "text-clay-strong" : "text-muted-foreground",
        )}
      >
        {icon ? (
          <span className={alert ? "text-clay-strong" : "text-primary-strong"}>
            {icon}
          </span>
        ) : null}
        <span>{label}</span>
      </div>
      <div
        className={cn(
          "mt-1 font-display text-[1.55rem] leading-none font-semibold tabular-nums tracking-[-0.02em]",
          alert ? "text-clay-strong" : "text-text-strong",
        )}
      >
        {value}
      </div>
      {sub ? (
        <div
          className={cn(
            "mt-1.5 text-xs",
            alert ? "text-clay-strong" : "text-muted-foreground",
          )}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
}
