import type { UserRole } from "@/types/auth";

export const navByRole: Record<UserRole, Array<{ label: string; href: string }>> = {
  ADMIN: [
    { label: "Admin", href: "/admin" },
    { label: "Planos", href: "/admin/plans" },
    { label: "Agrônomos", href: "/admin/agronomists" },
    { label: "Produtores", href: "/admin/producers" },
    { label: "Produtos", href: "/admin/global-catalog" },
    { label: "Configurações", href: "/admin/settings" },
  ],
  AGRONOMIST: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Fazendas", href: "/farms" },
    { label: "Produtores", href: "/producers" },
    { label: "Produtos", href: "/catalog" },
    { label: "Receitas de produtos", href: "/mix-templates" },
    { label: "Recomendação", href: "/timing-templates" },
    { label: "Safras", href: "/seasons" },
    { label: "Relatórios", href: "/reports" },
    { label: "Plano", href: "/plan" },
    { label: "Configurações", href: "/settings" },
  ],
  PRODUCER: [],
};
