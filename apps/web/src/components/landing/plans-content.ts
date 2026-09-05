import { links } from "./content";

export const PIX_DISCOUNT = 0.1;
export const HARVEST_MONTHS = 12;

export type BillingMode = "installments" | "pix";

export type PlotPlanBilling = "free" | "monthly" | "harvest";

export type PlotPlan = {
  id: string;
  name: string;
  plotRange: string;
  monthlyBrl: number;
  billing: PlotPlanBilling;
  description?: string;
  features: readonly string[];
  highlighted?: boolean;
};

export type ExtraPlan = {
  id: string;
  name: string;
  eyebrow: string;
  description: string;
  monthlyBrl: number;
  billing: PlotPlanBilling;
  features: readonly string[];
  featured?: boolean;
};

export const plansIntro = {
  eyebrow: "Uma solução 250k",
  title: "Planos por cota de talhões",
  description:
    "A cobrança segue o número de talhões cadastrados. O ciclo de safra cobre 12 meses — referente a duas safras (safra e safrinha). Nos planos pagos, o compartilhamento com a equipe é ilimitado.",
} as const;

export const plotPlans: readonly PlotPlan[] = [
  {
    id: "semente",
    name: "Semente",
    plotRange: "Até 3 talhões",
    monthlyBrl: 0,
    billing: "free",
    features: [
      "Até 3 talhões cadastrados",
      "Recomendação, lista de compras e estoque",
      "Para conhecer a plataforma",
    ],
  },
  {
    id: "plantio",
    name: "Plantio",
    plotRange: "Até 10 talhões",
    monthlyBrl: 9.99,
    billing: "monthly",
    highlighted: true,
    features: [
      "Até 10 talhões cadastrados",
      "Compartilhamento ilimitado",
      "Mensalidade sem o pacote de 12 meses",
    ],
  },
  {
    id: "lavoura",
    name: "Lavoura",
    plotRange: "11 a 20 talhões",
    monthlyBrl: 19.99,
    billing: "harvest",
    features: [
      "11 a 20 talhões cadastrados",
      "12 meses · duas safras",
      "Compartilhamento ilimitado",
    ],
  },
  {
    id: "fazenda",
    name: "Fazenda",
    plotRange: "21 a 50 talhões",
    monthlyBrl: 29.99,
    billing: "harvest",
    features: [
      "21 a 50 talhões cadastrados",
      "12 meses · duas safras",
      "Compartilhamento ilimitado",
    ],
  },
  {
    id: "carteira",
    name: "Carteira",
    plotRange: "51 a 100 talhões",
    monthlyBrl: 39.99,
    billing: "harvest",
    features: [
      "51 a 100 talhões cadastrados",
      "12 meses · duas safras",
      "Compartilhamento ilimitado",
    ],
  },
  {
    id: "campo",
    name: "Campo",
    plotRange: "Acima de 100 talhões",
    monthlyBrl: 49.99,
    billing: "harvest",
    features: [
      "Acima de 100 talhões cadastrados",
      "12 meses · duas safras",
      "Compartilhamento ilimitado",
    ],
  },
];

export const plusPlan: ExtraPlan = {
  id: "plus",
  name: "Lico",
  eyebrow: "Complemento",
  description:
    "Acesso ao Lico no WhatsApp, somado a qualquer plano de talhões. Não substitui a cota de talhões.",
  monthlyBrl: 29.99,
  billing: "harvest",
  features: [
    "WhatsApp para o produtor no campo",
    "Ciclo de 12 meses",
    "Combina com Semente, Plantio ou as faixas de 12 meses",
  ],
};

export const masterPlan: ExtraPlan = {
  id: "casa-250k",
  name: "Casa 250k",
  eyebrow: "Tudo incluso",
  description:
    "Talhões ilimitados e WhatsApp ilimitado, no mesmo ciclo de 12 meses.",
  monthlyBrl: 59.99,
  billing: "harvest",
  featured: true,
  features: [
    "Talhões ilimitados",
    "WhatsApp (Lico) ilimitado",
    "Compartilhamento ilimitado",
    "12 meses · duas safras",
  ],
};

export function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function harvestPixTotal(monthlyBrl: number): number {
  return HARVEST_MONTHS * monthlyBrl * (1 - PIX_DISCOUNT);
}

export function planMailto(planName: string): string {
  const subject = encodeURIComponent(`Quero o plano ${planName} da Recomenda`);
  return `mailto:${links.contactEmail}?subject=${subject}`;
}

export type CatalogPlanLite = {
  slug: string;
  name: string;
  price_brl_monthly: string;
  billing_kind: PlotPlanBilling;
  plot_range: string | null;
  description: string | null;
  features: string[];
};

function asFeatures(value: unknown, fallback: readonly string[]): string[] {
  if (!Array.isArray(value)) return [...fallback];
  const items = value.map((item) => String(item).trim()).filter(Boolean);
  return items.length ? items : [...fallback];
}

export function showcaseFromCatalog(catalog: readonly CatalogPlanLite[] | undefined): {
  plots: PlotPlan[];
  plus: ExtraPlan;
  master: ExtraPlan;
} {
  if (!catalog?.length) {
    return { plots: [...plotPlans], plus: plusPlan, master: masterPlan };
  }

  const plots = catalog
    .filter((plan) => plan.slug !== "lico" && plan.slug !== "casa-250k")
    .map((plan) => {
      const fallback = plotPlans.find((item) => item.id === plan.slug);
      return {
        id: plan.slug,
        name: plan.name,
        plotRange: plan.plot_range ?? fallback?.plotRange ?? "",
        monthlyBrl: Number(plan.price_brl_monthly),
        billing: plan.billing_kind,
        description: plan.description?.trim() || fallback?.description,
        highlighted: plan.slug === "plantio",
        features: asFeatures(plan.features, fallback?.features ?? [plan.plot_range ?? plan.name]),
      } satisfies PlotPlan;
    });

  const lico = catalog.find((plan) => plan.slug === "lico");
  const casa = catalog.find((plan) => plan.slug === "casa-250k");

  return {
    plots: plots.length ? plots : [...plotPlans],
    plus: lico
      ? {
          ...plusPlan,
          name: lico.name,
          monthlyBrl: Number(lico.price_brl_monthly),
          billing: lico.billing_kind,
          description: lico.description?.trim() || plusPlan.description,
          features: asFeatures(lico.features, plusPlan.features),
        }
      : plusPlan,
    master: casa
      ? {
          ...masterPlan,
          name: casa.name,
          monthlyBrl: Number(casa.price_brl_monthly),
          billing: casa.billing_kind,
          description: casa.description?.trim() || masterPlan.description,
          features: asFeatures(casa.features, masterPlan.features),
        }
      : masterPlan,
  };
}

export function priceLabel(
  monthlyBrl: number,
  billing: PlotPlanBilling,
  mode: BillingMode,
): { amount: string; cadence: string } {
  if (billing === "free" || monthlyBrl === 0) {
    return { amount: formatBrl(0), cadence: "para começar" };
  }
  if (billing === "monthly") {
    return { amount: formatBrl(monthlyBrl), cadence: "por mês" };
  }
  if (mode === "pix") {
    return {
      amount: formatBrl(harvestPixTotal(monthlyBrl)),
      cadence: "à vista no PIX (−10%)",
    };
  }
  return {
    amount: `${HARVEST_MONTHS}× ${formatBrl(monthlyBrl)}`,
    cadence: "em 12 meses",
  };
}
