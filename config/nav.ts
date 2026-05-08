import type { UserRole } from "@/types/auth";

export const navByRole: Record<UserRole, Array<{ label: string; href: string }>> = {
  ADMIN: [
    { label: "Admin", href: "/admin" },
    { label: "Planos", href: "/admin/plans" },
    { label: "Agrônomos", href: "/admin/agronomists" },
    { label: "Produtores", href: "/admin/producers" },
    { label: "Catálogo Global", href: "/admin/global-catalog" },
    { label: "Configurações", href: "/admin/settings" },
  ],
  AGRONOMIST: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Fazendas", href: "/farms" },
    { label: "Produtores", href: "/producers" },
    { label: "Catálogo", href: "/catalog" },
    { label: "Calendários de Aplicação", href: "/timing-templates" },
    { label: "Receitas de Mistura", href: "/mix-templates" },
    { label: "Safras", href: "/seasons" },
    { label: "Relatórios", href: "/reports" },
    { label: "Plano", href: "/plan" },
    { label: "Configurações", href: "/settings" },
  ],
  PRODUCER: [],
};
