import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type HeroStat = {
  label: string;
  value: ReactNode;
  /** Complemento pequeno ao lado do valor (ex.: "58%", "produtos"). */
  sub?: ReactNode;
  subClassName?: string;
  tone?: "default" | "danger";
  onClick?: () => void;
  /** Esconde a célula no mobile (ex.: quando o dado vira banner de alerta). */
  hideOnMobile?: boolean;
};

function HeroStatCell({ stat }: { stat: HeroStat }) {
  const interactive = Boolean(stat.onClick);
  const className = cn(
    // Mobile: mini-card na grade 2 colunas; desktop: célula da faixa com divisores.
    "rounded-xl border border-border bg-card px-3.5 py-3 text-left",
    "sm:rounded-none sm:border-0 sm:border-l sm:border-border sm:bg-transparent sm:px-7 sm:py-0 sm:first:border-l-0 sm:first:pl-0",
    stat.hideOnMobile && "hidden sm:block",
    interactive && "cursor-pointer transition-colors hover:bg-hover/60 sm:hover:bg-transparent",
  );

  const content = (
    <>
      <div className="text-xs font-medium text-muted-foreground">{stat.label}</div>
      <div
        className={cn(
          "mt-1 font-display text-xl font-semibold tracking-[-0.01em] tabular-nums",
          stat.tone === "danger" ? "text-danger" : "text-text-strong",
          interactive && "underline-offset-4 group-hover:underline",
        )}
      >
        {stat.value}
        {stat.sub != null ? (
          <span
            className={cn(
              "ml-1.5 align-baseline text-xs font-medium tracking-normal",
              stat.subClassName ?? "text-muted-foreground",
            )}
          >
            {stat.sub}
          </span>
        ) : null}
      </div>
    </>
  );

  if (interactive) {
    return (
      <button type="button" className={cn("group", className)} onClick={stat.onClick}>
        {content}
      </button>
    );
  }
  return <div className={className}>{content}</div>;
}

/**
 * Cartão de identidade das telas de detalhe (design "Refactor Recomendações"):
 * ícone + eyebrow + título + meta + ações, com a faixa de métricas embutida
 * (divisores verticais). No mobile o cartão "dissolve": identidade direto no
 * fundo da página, métricas em grade de 2 colunas e ações em linha própria.
 */
export function EntityHero({
  icon,
  eyebrow,
  title,
  titleBadge,
  meta,
  actions,
  stats,
  children,
  className,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: ReactNode;
  titleBadge?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  stats?: HeroStat[];
  /** Conteúdo extra após as métricas (ex.: banner de alerta no mobile). */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "mb-6 sm:rounded-xl sm:border sm:border-border sm:bg-card sm:p-6 sm:shadow-sm",
        className,
      )}
    >
      <div className="flex items-start gap-3.5 sm:items-center sm:gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary-strong sm:size-13">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary-strong">
            {eyebrow}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h1 className="min-w-0 font-display text-xl font-semibold tracking-[-0.01em] text-text-strong sm:text-2xl">
              {title}
            </h1>
            {titleBadge}
          </div>
          {meta ? (
            <div className="mt-1 text-sm text-muted-foreground">{meta}</div>
          ) : null}
        </div>
        {actions ? (
          <div className="hidden shrink-0 flex-wrap justify-end gap-2 sm:flex">
            {actions}
          </div>
        ) : null}
      </div>

      {stats && stats.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:mt-5 sm:flex sm:flex-wrap sm:gap-0 sm:border-t sm:border-border sm:pt-4.5">
          {stats.map((stat, idx) => (
            <HeroStatCell key={`${idx}-${stat.label}`} stat={stat} />
          ))}
        </div>
      ) : null}

      {/* Mesmas ações repetidas no mobile, em linha própria abaixo das métricas. */}
      {actions ? (
        <div className="mt-3.5 flex flex-wrap gap-2 sm:hidden [&>*]:min-w-0 [&>*]:flex-1">
          {actions}
        </div>
      ) : null}

      {children}
    </section>
  );
}
