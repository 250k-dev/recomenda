import { api } from "./http/axios";

export type CatalogPlan = {
  id: string;
  name: string;
  slug: string;
  plot_quota: number | null;
  timing_template_quota: number;
  price_brl_monthly: string;
  billing_kind: "free" | "monthly" | "harvest";
  includes_whatsapp: boolean;
  plot_range: string | null;
  description: string | null;
  features: string[];
  sort_order: number;
  is_active: boolean;
};

export async function getPlanCatalog() {
  const { data } = await api.get<{ data: CatalogPlan[] }>("/plans/catalog");
  return data.data;
}

export type CheckoutResponse =
  | { kind: "free" }
  | { kind: "hosted"; checkoutUrl: string };

export async function createBillingCheckout(payload: {
  name: string;
  email: string;
  taxId: string;
  planSlug: string;
  billingMode: "pix" | "installments" | "monthly";
  addOnLico: boolean;
}) {
  const { data } = await api.post<CheckoutResponse>("/billing/checkout", payload);
  return data;
}
