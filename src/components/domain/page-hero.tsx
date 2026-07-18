import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PageHeroStat = {
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

function PageHeroStatCell({
  stat,
  inverted,
}: {
  stat: PageHeroStat;
  inverted: boolean;
}) {
  const interactive = Boolean(stat.onClick);
  const className = cn(
    // Mobile: mini-card na grade 2 colunas; desktop: célula da faixa com divisores.
    "rounded-xl border px-3.5 py-3 text-left",
    "sm:rounded-none sm:border-0 sm:border-l sm:px-7 sm:py-0 sm:first:border-l-0 sm:first:pl-0",
    inverted
      ? "border-white/15 bg-white/10 sm:border-white/25 sm:bg-transparent"
      : "border-border bg-card sm:bg-transparent",
    stat.hideOnMobile && "hidden sm:block",
    interactive &&
      "cursor-pointer transition-colors sm:hover:bg-transparent " +
        (inverted ? "hover:bg-white/15" : "hover:bg-hover/60"),
  );

  const dangerClass = inverted ? "text-red-200" : "text-danger";
  const content = (
    <>
      <div
        className={cn(
          "text-xs font-medium",
          inverted ? "text-primary-foreground/70" : "text-muted-foreground",
        )}
      >
        {stat.label}
      </div>
      <div
        className={cn(
          "mt-1 font-display text-xl font-semibold tracking-[-0.01em] tabular-nums",
          stat.tone === "danger"
            ? dangerClass
            : inverted
              ? "text-primary-foreground"
              : "text-text-strong",
          interactive && "underline-offset-4 group-hover:underline",
        )}
      >
        {stat.value}
        {stat.sub != null ? (
          <span
            className={cn(
              "ml-1.5 align-baseline text-xs font-medium tracking-normal",
              stat.subClassName ??
                (inverted
                  ? "text-primary-foreground/70"
                  : "text-muted-foreground"),
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
      <button
        type="button"
        className={cn("group", className)}
        onClick={stat.onClick}
      >
        {content}
      </button>
    );
  }
  return <div className={className}>{content}</div>;
}

/**
 * Cabeçalho-herói das telas (design "Refactor Recomendações"): o bloco de
 * identidade que abre a página — ícone + eyebrow + título + meta + ações, com a
 * faixa de métricas embutida (divisores verticais). Serve tanto telas de lista
 * (Produtores, Equipe, Templates) quanto de detalhe (Produtor, Fazenda, Safra).
 * No mobile o cartão "dissolve": identidade direto no fundo da página, métricas
 * em grade de 2 colunas e ações em linha própria.
 *
 * `variant="inverted"` usa o verde primário como fundo (herói em destaque, ex.:
 * abertura de dashboard) — permanece cartão também no mobile.
 *
 * O cabeçalho quebra a linha das ações para baixo quando elas não cabem ao lado
 * do título (barras de ação densas, ex.: Lista de compra), em vez de espremer o
 * título. Difere do `PageHeader` (mais enxuto, só título/descrição) por trazer a
 * faixa de métricas e o tratamento de cartão/herói.
 */
export function PageHero({
  icon,
  eyebrow,
  title,
  titleBadge,
  meta,
  actions,
  stats,
  children,
  className,
  variant = "default",
}: {
  icon: ReactNode;
  eyebrow: string;
  title: ReactNode;
  titleBadge?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  stats?: PageHeroStat[];
  /** Conteúdo extra após as métricas (ex.: banner de alerta no mobile). */
  children?: ReactNode;
  className?: string;
  variant?: "default" | "inverted";
}) {
  const inverted = variant === "inverted";
  return (
    <section
      className={cn(
        "mb-6",
        inverted
          ? "rounded-xl bg-primary p-5 text-primary-foreground shadow-sm sm:p-6"
          : "sm:rounded-xl sm:border sm:border-border sm:bg-card sm:p-6 sm:shadow-sm",
        className,
      )}
    >
      {/* Título+ações na mesma linha quando cabem; senão as ações quebram para
          baixo (o título nunca é espremido — min-w garante isso). */}
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3 sm:items-center">
        <div className="flex min-w-[14rem] flex-1 items-start gap-3.5 sm:items-center sm:gap-4">
          <span
            className={cn(
              "flex size-12 shrink-0 items-center justify-center rounded-2xl sm:size-13",
              inverted
                ? "bg-white/15 text-white"
                : "bg-primary-soft text-primary-strong",
            )}
          >
            {icon}
          </span>
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                "text-[11px] font-bold uppercase tracking-[0.12em]",
                inverted ? "text-primary-foreground/80" : "text-primary-strong",
              )}
            >
              {eyebrow}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1
                className={cn(
                  "min-w-0 font-display text-xl font-semibold tracking-[-0.01em] sm:text-2xl",
                  inverted ? "text-primary-foreground" : "text-text-strong",
                )}
              >
                {title}
              </h1>
              {titleBadge}
            </div>
            {meta ? (
              <div
                className={cn(
                  "mt-1 text-sm",
                  inverted
                    ? "text-primary-foreground/75"
                    : "text-muted-foreground",
                )}
              >
                {meta}
              </div>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="flex-wrap justify-end hidden gap-2 shrink-0 sm:flex">
            {actions}
          </div>
        ) : null}
      </div>

      {stats && stats.length > 0 ? (
        <div
          className={cn(
            "mt-4 grid grid-cols-2 gap-2.5 sm:mt-5 sm:flex sm:flex-wrap sm:gap-0 sm:border-t sm:pt-4.5",
            inverted ? "sm:border-white/20" : "sm:border-border",
          )}
        >
          {stats.map((stat, idx) => (
            <PageHeroStatCell
              key={`${idx}-${stat.label}`}
              stat={stat}
              inverted={inverted}
            />
          ))}
        </div>
      ) : null}

      {/* Mesmas ações repetidas no mobile, em linha própria abaixo das métricas.
          2 por linha (basis ~50%): alvos de toque grandes sem espremer/sobrepor
          quando há muitos botões; um botão sozinho ou o ímpar final ocupa a linha. */}
      {actions ? (
        <div className="mt-3.5 flex flex-wrap gap-2 sm:hidden [&>*]:grow [&>*]:basis-[calc(50%-0.25rem)]">
          {actions}
        </div>
      ) : null}

      {children}
    </section>
  );
}
