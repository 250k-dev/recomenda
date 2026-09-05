"use client";

import { useMemo, useState } from "react";
import { usePlanCatalog } from "@recomenda/api-hooks";
import { Logo } from "@/assets/logo";
import { links } from "./content";
import { CheckoutDialog } from "./checkout-dialog";
import { Check, Layers, Phone, Sprout } from "./icons";
import { LandingShell } from "./landing-shell";
import {
  type BillingMode,
  type ExtraPlan,
  type PlotPlan,
  plansIntro,
  priceLabel,
  showcaseFromCatalog,
} from "./plans-content";
import {
  Button,
  Container,
  Eyebrow,
  Section,
  cn,
} from "./primitives";
import { Reveal } from "./reveal";

function Contours() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute right-0 top-0 h-[36rem] w-[36rem] max-w-none translate-x-1/4 -translate-y-1/4 text-brand-700/[0.07]"
      viewBox="0 0 600 600"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <path
          key={i}
          d={`M ${40 + i * 12} 560 C ${160 + i * 10} ${360 - i * 18}, ${360 - i * 8} ${420 - i * 12}, ${560} ${180 - i * 14}`}
        />
      ))}
    </svg>
  );
}

function BillingToggle({
  mode,
  onChange,
}: {
  mode: BillingMode;
  onChange: (mode: BillingMode) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Forma de pagamento dos planos de 12 meses"
      className="inline-flex rounded-full bg-sand p-1 ring-1 ring-ink/5"
    >
      {(
        [
          { id: "installments", label: "12× mensal" },
          { id: "pix", label: "PIX à vista (−10%)" },
        ] as const
      ).map((option) => {
        const active = mode === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.id)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
              active
                ? "bg-brand-700 text-white shadow-soft"
                : "text-ink/70 hover:text-brand-800",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function FeatureList({
  items,
  tone = "brand",
}: {
  items: readonly string[];
  tone?: "brand" | "clay" | "light";
}) {
  return (
    <ul className="mt-6 space-y-3 border-t border-line pt-6">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5">
          <Check
            width={17}
            height={17}
            className={cn(
              "mt-0.5 shrink-0",
              tone === "light"
                ? "text-brand-200"
                : tone === "clay"
                  ? "text-clay-500"
                  : "text-brand-600",
            )}
          />
          <span
            className={cn(
              "text-[0.925rem] leading-snug",
              tone === "light" ? "text-brand-100/85" : "text-muted",
            )}
          >
            {item}
          </span>
        </li>
      ))}
    </ul>
  );
}

function PlotPlanCard({
  plan,
  mode,
  delay,
  onSelect,
}: {
  plan: PlotPlan;
  mode: BillingMode;
  delay: number;
  onSelect: () => void;
}) {
  const price = priceLabel(plan.monthlyBrl, plan.billing, mode);
  const clay = plan.highlighted;

  return (
    <Reveal delay={delay}>
      <article
        className={cn(
          "flex h-full flex-col rounded-3xl border bg-surface p-7 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:shadow-lift sm:p-8",
          clay
            ? "border-clay-500/35 shadow-soft"
            : "border-line",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <span
            className={cn(
              "grid size-12 place-items-center rounded-2xl ring-1",
              clay
                ? "bg-clay-50 text-clay-600 ring-clay-600/12"
                : "bg-brand-50 text-brand-700 ring-brand-700/12",
            )}
          >
            <Sprout width={24} height={24} />
          </span>
          {clay ? (
            <span className="rounded-full bg-clay-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-clay-700 ring-1 ring-clay-600/15">
              Entrada
            </span>
          ) : null}
        </div>

        <h3 className="mt-5 font-display text-2xl font-semibold tracking-tight text-ink">
          {plan.name}
        </h3>
        <p
          className={cn(
            "mt-1 text-sm font-medium",
            clay ? "text-clay-600" : "text-brand-600",
          )}
        >
          {plan.plotRange}
        </p>
        {plan.description ? (
          <p className="mt-2 text-sm leading-relaxed text-muted">{plan.description}</p>
        ) : null}

        <p className="mt-5 font-display text-3xl font-semibold tracking-tight text-ink">
          {price.amount}
        </p>
        <p className="mt-1 text-sm text-muted">{price.cadence}</p>
        {plan.billing === "monthly" && mode === "pix" ? (
          <p className="mt-2 text-xs text-muted">
            O desconto PIX vale nos planos de 12 meses. Este permanece mensal.
          </p>
        ) : null}

        <FeatureList items={plan.features} tone={clay ? "clay" : "brand"} />

        <div className="mt-auto pt-7">
          <Button
            type="button"
            variant={clay ? "clay" : "outline"}
            size="md"
            className="w-full"
            withArrow
            onClick={onSelect}
          >
            Quero este plano
          </Button>
        </div>
      </article>
    </Reveal>
  );
}

function ExtraPlanCard({
  plan,
  mode,
  delay,
  onSelect,
}: {
  plan: ExtraPlan;
  mode: BillingMode;
  delay: number;
  onSelect: () => void;
}) {
  const price = priceLabel(plan.monthlyBrl, plan.billing, mode);
  const featured = Boolean(plan.featured);

  if (featured) {
    return (
      <Reveal delay={delay}>
        <article className="grain relative flex h-full flex-col overflow-hidden rounded-3xl bg-brand-800 p-7 text-white shadow-lift sm:p-8">
          <div
            aria-hidden
            className="absolute -left-12 -top-12 size-56 rounded-full bg-brand-500/25 blur-[80px]"
          />
          <div
            aria-hidden
            className="absolute -bottom-16 -right-8 size-64 rounded-full bg-clay-500/20 blur-[80px]"
          />
          <Logo
            aria-hidden
            width={180}
            height={230}
            fill="#ffffff"
            className="pointer-events-none absolute -right-6 top-1/2 hidden -translate-y-1/2 opacity-[0.06] sm:block"
          />
          <div className="relative">
            <Eyebrow tone="light">{plan.eyebrow}</Eyebrow>
            <h3 className="mt-5 font-display text-2xl font-semibold tracking-tight">
              {plan.name}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-brand-100/85">
              {plan.description}
            </p>
            <p className="mt-5 font-display text-3xl font-semibold tracking-tight">
              {price.amount}
            </p>
            <p className="mt-1 text-sm text-brand-100/70">{price.cadence}</p>
            <ul className="mt-6 space-y-3 border-t border-white/15 pt-6">
              {plan.features.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <Check
                    width={17}
                    height={17}
                    className="mt-0.5 shrink-0 text-brand-200"
                  />
                  <span className="text-[0.925rem] leading-snug text-brand-100/85">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Button
                type="button"
                variant="clay"
                size="md"
                className="w-full"
                withArrow
                onClick={onSelect}
              >
                Quero {plan.name}
              </Button>
            </div>
          </div>
        </article>
      </Reveal>
    );
  }

  return (
    <Reveal delay={delay}>
      <article className="flex h-full flex-col rounded-3xl border border-line bg-surface p-7 sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-700/12">
            <Phone width={24} height={24} />
          </span>
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-brand-700 ring-1 ring-brand-700/12">
            {plan.eyebrow}
          </span>
        </div>
        <h3 className="mt-5 font-display text-2xl font-semibold tracking-tight text-ink">
          {plan.name}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {plan.description}
        </p>
        <p className="mt-5 font-display text-3xl font-semibold tracking-tight text-ink">
          {price.amount}
        </p>
        <p className="mt-1 text-sm text-muted">{price.cadence}</p>
        <FeatureList items={plan.features} />
        <div className="mt-auto pt-7">
          <Button
            type="button"
            variant="outline"
            size="md"
            className="w-full"
            withArrow
            onClick={onSelect}
          >
            Quero {plan.name}
          </Button>
        </div>
      </article>
    </Reveal>
  );
}

export function PlansView() {
  const [mode, setMode] = useState<BillingMode>("installments");
  const [target, setTarget] = useState<{
    slug: string;
    name: string;
    billing: "free" | "monthly" | "harvest";
    addOnLico?: boolean;
  } | null>(null);
  const catalog = usePlanCatalog();
  const showcase = useMemo(() => showcaseFromCatalog(catalog.data), [catalog.data]);

  return (
    <LandingShell>
      <section className="grain relative overflow-hidden bg-hero-mesh">
        <Contours />
        <Container className="relative max-w-3xl pb-16 pt-28 sm:pt-36 lg:pb-20">
          <Reveal>
            <Eyebrow tone="clay">{plansIntro.eyebrow}</Eyebrow>
          </Reveal>
          <Reveal delay={60}>
            <h1 className="mt-5 font-display text-[2.4rem] font-semibold leading-[1.08] tracking-tight text-ink text-balance sm:text-5xl">
              {plansIntro.title}
            </h1>
          </Reveal>
          <Reveal delay={120}>
            <p className="mt-6 text-lg leading-relaxed text-muted text-pretty">
              {plansIntro.description}
            </p>
          </Reveal>
          <Reveal delay={180}>
            <ul className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-medium text-muted">
              <li className="inline-flex items-center gap-2">
                <Layers width={18} height={18} className="text-brand-600" />
                Cota por talhões
              </li>
              <li className="inline-flex items-center gap-2">
                <Sprout width={18} height={18} className="text-brand-600" />
                12 meses · 2 safras
              </li>
              <li className="inline-flex items-center gap-2">
                <Phone width={18} height={18} className="text-brand-600" />
                Lico e Casa 250k com WhatsApp
              </li>
            </ul>
          </Reveal>
        </Container>
      </section>

      <Section className="bg-cream pt-4 sm:pt-8">
        <Container>
          <Reveal>
            <div className="flex flex-col items-center gap-4 text-center">
              <BillingToggle mode={mode} onChange={setMode} />
              <p className="max-w-xl text-sm text-muted">
                O PIX à vista aplica 10% sobre o ciclo de 12 meses das faixas
                de talhões, do Lico e da Casa 250k.
              </p>
            </div>
          </Reveal>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {showcase.plots.map((plan, i) => (
              <PlotPlanCard
                key={plan.id}
                plan={plan}
                mode={mode}
                delay={Math.min(i, 5) * 60}
                onSelect={() =>
                  setTarget({ slug: plan.id, name: plan.name, billing: plan.billing })
                }
              />
            ))}
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <ExtraPlanCard
              plan={showcase.plus}
              mode={mode}
              delay={80}
              onSelect={() =>
                setTarget({
                  slug: "plantio",
                  name: "Plantio + Lico",
                  billing: "monthly",
                  addOnLico: true,
                })
              }
            />
            <ExtraPlanCard
              plan={showcase.master}
              mode={mode}
              delay={140}
              onSelect={() =>
                setTarget({
                  slug: "casa-250k",
                  name: showcase.master.name,
                  billing: "harvest",
                })
              }
            />
          </div>
        </Container>
      </Section>

      <Section className="bg-cream pt-0">
        <Container>
          <Reveal>
            <div className="grain relative overflow-hidden rounded-[2.5rem] bg-brand-800 px-6 py-16 text-center shadow-lift sm:px-16 sm:py-20">
              <div
                aria-hidden
                className="absolute -left-16 -top-16 size-72 rounded-full bg-brand-500/25 blur-[90px]"
              />
              <div
                aria-hidden
                className="absolute -bottom-24 -right-10 size-80 rounded-full bg-clay-500/20 blur-[90px]"
              />
              <div className="relative mx-auto max-w-2xl">
                <Eyebrow tone="light">Comece agora</Eyebrow>
                <h2 className="mt-5 font-display text-3xl font-semibold leading-[1.08] tracking-tight text-white text-balance sm:text-[2.75rem]">
                  Dúvida na faixa? A gente ajuda a escolher.
                </h2>
                <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-brand-100/85 text-pretty">
                  Fale com o time 250k para fechar o plano e configurar os
                  primeiros modelos. Ou entre na plataforma se já tem acesso.
                </p>
                <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
                  <Button href={`mailto:${links.contactEmail}`} variant="clay" size="lg" withArrow>
                    Falar com a 250k
                  </Button>
                  <Button href={links.appUrl} variant="light" size="lg">
                    Acessar a plataforma
                  </Button>
                </div>
              </div>
            </div>
          </Reveal>
        </Container>
      </Section>
      <CheckoutDialog
        key={target ? `${target.slug}-${String(target.addOnLico)}` : "closed"}
        target={target}
        billingMode={mode}
        defaultAddOnLico={Boolean(target?.addOnLico)}
        onClose={() => setTarget(null)}
      />
    </LandingShell>
  );
}
