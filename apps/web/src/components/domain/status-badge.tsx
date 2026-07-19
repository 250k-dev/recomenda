import { ReactNode } from "react";
import { Badge } from "@recomenda/ui/badge";
import { cn } from "@recomenda/utils";

export type StatusTone =
  | "primary"
  | "clay"
  | "success"
  | "warning"
  | "danger"
  | "neutral";

/**
 * Consistent status pill used across lists/detail/timeline. Wraps `Badge` with
 * the tonal variants and the mockup sizing (h-6, px-2.5, leading icon).
 */
export function StatusBadge({
  tone = "neutral",
  icon,
  children,
  className,
}: {
  tone?: StatusTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Badge
      variant={tone}
      className={cn("h-6 gap-1.5 px-2.5 text-xs font-semibold", className)}
    >
      {icon}
      {children}
    </Badge>
  );
}
