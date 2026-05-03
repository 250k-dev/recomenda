import { PropsWithChildren } from "react";
import { cn } from "@/lib/utils/cn";

export function Card({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <section
      className={cn("rounded-lg border border-zinc-200 bg-white p-4 shadow-sm", className)}
    >
      {children}
    </section>
  );
}
