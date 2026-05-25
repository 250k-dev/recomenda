import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  /** Ícone exibido à esquerda — se passado, ativa o layout estilo "plano de custo" */
  icon?: ReactNode;
  /** Rótulo pequeno acima do título (ex: "Carteira", "Admin") */
  section?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function PageHeader({ icon, section, title, description, action, className }: PageHeaderProps) {
  if (icon) {
    return (
      <div className={cn("flex flex-wrap items-start justify-between gap-4 mb-6", className)}>
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {icon}
          </span>
          <div className="min-w-0">
            {section && (
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section}
              </p>
            )}
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            {description && (
              <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
