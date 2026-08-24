import type { ComponentProps, ReactNode } from "react";
import { Logo } from "@/assets/logo";
import { ArrowRight } from "./icons";

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/* -------------------------------------------------------------------------- */
/* Layout                                                                     */
/* -------------------------------------------------------------------------- */

export function Container({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-5 sm:px-8", className)}>
      {children}
    </div>
  );
}

export function Section({
  id,
  className,
  children,
  ...rest
}: ComponentProps<"section">) {
  return (
    <section id={id} className={cn("py-20 sm:py-28", className)} {...rest}>
      {children}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Text                                                                        */
/* -------------------------------------------------------------------------- */

export function Eyebrow({
  children,
  tone = "brand",
  className,
}: {
  children: ReactNode;
  tone?: "brand" | "clay" | "light";
  className?: string;
}) {
  const tones = {
    brand: "text-brand-700 bg-brand-50 ring-brand-700/12",
    clay: "text-clay-600 bg-clay-50 ring-clay-600/15",
    light: "text-brand-100 bg-white/10 ring-white/15",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] ring-1",
        tones[tone],
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          tone === "clay"
            ? "bg-clay-500"
            : tone === "light"
              ? "bg-brand-200"
              : "bg-brand-500",
        )}
      />
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  eyebrowTone,
  title,
  description,
  align = "center",
  dark = false,
  className,
}: {
  eyebrow?: ReactNode;
  eyebrowTone?: "brand" | "clay" | "light";
  title: ReactNode;
  description?: ReactNode;
  align?: "center" | "left";
  dark?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" ? "items-center text-center" : "items-start text-left",
        className,
      )}
    >
      {eyebrow ? (
        <Eyebrow tone={eyebrowTone ?? (dark ? "light" : "brand")}>{eyebrow}</Eyebrow>
      ) : null}
      <h2
        className={cn(
          "font-display text-3xl font-semibold leading-[1.1] tracking-tight text-balance sm:text-4xl md:text-[2.75rem]",
          dark ? "text-white" : "text-ink",
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "max-w-2xl text-base leading-relaxed text-pretty sm:text-lg",
            dark ? "text-brand-100/85" : "text-muted",
            align === "center" ? "mx-auto" : "",
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Button                                                                      */
/* -------------------------------------------------------------------------- */

type Variant =
  | "primary"
  | "clay"
  | "outline"
  | "ghost"
  | "light"
  | "outlineLight";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-brand-700 text-white shadow-soft hover:bg-brand-800 active:bg-brand-900",
  clay: "bg-clay-500 text-white shadow-soft hover:bg-clay-600 active:bg-clay-700",
  outline:
    "border border-brand-700/20 bg-transparent text-brand-800 hover:border-brand-700/40 hover:bg-brand-50",
  ghost: "text-ink hover:bg-ink/[0.06]",
  light: "bg-white text-brand-800 shadow-soft hover:bg-brand-50",
  outlineLight:
    "border border-white/25 text-white hover:border-white/50 hover:bg-white/10",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-[0.95rem]",
  lg: "h-13 px-7 text-base",
};

type ButtonProps = {
  variant?: Variant;
  size?: Size;
  href?: string;
  withArrow?: boolean;
  className?: string;
  children: ReactNode;
} & Omit<ComponentProps<"a">, "href" | "className">;

export function Button({
  variant = "primary",
  size = "md",
  href,
  withArrow = false,
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = cn(
    "group inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold transition-[background-color,border-color,transform,box-shadow] duration-200 active:scale-[0.98]",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );

  const inner = (
    <>
      {children}
      {withArrow ? (
        <ArrowRight className="size-[1.05em] transition-transform duration-200 group-hover:translate-x-0.5" />
      ) : null}
    </>
  );

  if (href) {
    return (
      <a href={href} className={classes} {...rest}>
        {inner}
      </a>
    );
  }
  return (
    <button className={classes} {...(rest as ComponentProps<"button">)}>
      {inner}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Brand wordmark                                                              */
/* -------------------------------------------------------------------------- */

export function Wordmark({
  tone = "dark",
  className,
}: {
  tone?: "dark" | "light";
  className?: string;
}) {
  const isLight = tone === "light";
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "grid size-9 place-items-center rounded-xl shadow-sm ring-1",
          isLight
            ? "bg-white/10 ring-white/15"
            : "bg-brand-700 ring-brand-900/10",
        )}
      >
        <Logo width={17} height={22} fill="#ffffff" />
      </span>
      <span
        className={cn(
          "font-display text-[1.35rem] font-semibold leading-none tracking-tight",
          isLight ? "text-white" : "text-ink",
        )}
      >
        Recomenda
      </span>
    </span>
  );
}

export function Pill({
  children,
  tone = "brand",
  className,
}: {
  children: ReactNode;
  tone?: "brand" | "clay" | "neutral" | "light";
  className?: string;
}) {
  const tones = {
    brand: "bg-brand-50 text-brand-700 ring-brand-700/12",
    clay: "bg-clay-50 text-clay-600 ring-clay-600/15",
    neutral: "bg-sand text-ink/70 ring-ink/5",
    light: "bg-white/10 text-white ring-white/15",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ring-1",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
