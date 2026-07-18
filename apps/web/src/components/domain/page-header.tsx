import { ReactNode } from "react";
import { cn } from "@recomenda/utils";

interface PageHeaderProps {
  /** Ícone exibido à esquerda — se passado, ativa o layout estilo "plano de custo" */
  icon?: ReactNode;
  /** Classes do container do ícone (ex.: fundo terracota no mock de relatórios) */
  iconClassName?: string;
  /** Rótulo pequeno acima do título (ex: "Carteira", "Admin") */
  section?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function PageHeader({ icon, iconClassName, section, title, description, action, className }: PageHeaderProps) {
  if (icon) {
    return (
      <div className={cn("flex flex-wrap items-start justify-between gap-4 mb-6", className)}>
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[13px] bg-primary-soft text-primary-strong",
              iconClassName,
            )}
          >
            {icon}
          </span>
          <div className="min-w-0">
            {section && (
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary-strong">
                {section}
              </p>
            )}
            <h1 className="mt-0.5 font-display text-[28px] font-semibold tracking-[-0.02em] text-text-strong">
              {title}
            </h1>
            {description && (
              <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
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
        <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] text-text-strong md:text-3xl">
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
