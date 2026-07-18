import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

/** Product + dose chip used in season timeline / etapa recipes. */
export function RecipeChip({
  name,
  dose,
  className,
}: {
  name: string;
  dose?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs text-foreground",
        className,
      )}
    >
      <FlaskConical className="size-3.5 text-primary-strong" aria-hidden />
      <b className="font-semibold text-text-strong">{name}</b>
      {dose ? <span className="text-muted-foreground">· {dose}</span> : null}
    </span>
  );
}
