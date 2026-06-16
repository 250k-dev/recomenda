import { cn } from "@/lib/utils";

type ProgressTone = "primary" | "success" | "warning" | "danger" | "clay";

const toneClass: Record<ProgressTone, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  clay: "bg-clay",
};

export function ProgressBar({
  value,
  tone = "primary",
  className,
  barClassName,
}: {
  /** 0–100 */
  value: number;
  tone?: ProgressTone;
  className?: string;
  barClassName?: string;
}) {
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-surface-2",
        className,
      )}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-300",
          toneClass[tone],
          barClassName,
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
