import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Right-rail summary card: uppercase muted header on `--rail-bg` + body. */
export function RailCard({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card shadow-sm",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border bg-rail px-4.5 py-3.5">
        <h4 className="text-[0.78rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
          {title}
        </h4>
        {action}
      </div>
      <div className={cn("p-4.5", bodyClassName)}>{children}</div>
    </div>
  );
}

/** Dashed key/value row used inside rails ("Produtores · 22"). */
export function RailRow({
  label,
  value,
  last = false,
}: {
  label: ReactNode;
  value: ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between py-2.5",
        !last && "border-b border-dashed border-border",
      )}
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-[0.95rem] font-semibold text-text-strong tabular-nums">
        {value}
      </span>
    </div>
  );
}
