import { ReactNode } from "react";
import { cn } from "@recomenda/utils";

type Accent = "primary" | "sun" | "clay" | "sky";

const accentClasses: Record<Accent, string> = {
  primary: "bg-primary/10 text-primary",
  sun: "bg-amber-100 text-amber-600",
  clay: "bg-orange-100 text-orange-600",
  sky: "bg-sky-100 text-sky-600",
};

export function StatCard({
  label,
  value,
  sub,
  icon,
  accent = "primary",
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  icon?: ReactNode;
  accent?: Accent;
}) {
  return (
    <div className="group flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-4 shadow-sm transition-all duration-200 hover:border-primary/30 hover:shadow-md">
      {icon ? (
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110",
            accentClasses[accent],
          )}
        >
          {icon}
        </span>
      ) : null}
      <div className="min-w-0">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
          {value}
        </p>
        {sub ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
        ) : null}
      </div>
    </div>
  );
}
