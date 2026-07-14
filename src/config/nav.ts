import type { UserRole } from "@/types/auth";

export const navByRole: Record<UserRole, Array<{ label: string; href: string }>> = {
  ADMIN: [
    { label: "Dashboard", href: "/admin" },
    { label: "Planos", href: "/admin/plans" },
    { label: "Agrônomos", href: "/admin/agronomists" },
    { label: "Produtores", href: "/admin/producers" },
    { label: "Produtos", href: "/admin/global-catalog" },
  ],
  AGRONOMIST: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Produtores", href: "/producers" },
    { label: "Produtos", href: "/catalog" },
    { label: "Relatórios", href: "/reports" },
  ],
  // Consultor usa a mesma navegação do agrônomo (escopo aplicado no backend).
  // Sem "Relatórios": o comparativo agrega TODAS as fazendas do agrônomo e
  // vazaria dados fora do escopo compartilhado (o endpoint também bloqueia).
  CONSULTANT: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Produtores", href: "/producers" },
    { label: "Produtos", href: "/catalog" },
  ],
  PRODUCER: [],
};
