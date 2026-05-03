import type { UserRole } from "@/types/auth";

export const navByRole: Record<UserRole, Array<{ label: string; href: string }>> = {
  ADMIN: [
    { label: "Admin", href: "/admin" },
    { label: "Planos", href: "/admin/plans" },
    { label: "Agrônomos", href: "/admin/agronomists" },
    { label: "Catálogo Global", href: "/admin/global-catalog" },
  ],
  AGRONOMIST: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Fazendas", href: "/farms" },
    { label: "Produtores", href: "/producers" },
    { label: "Catálogo", href: "/catalog" },
    { label: "Templates Timing", href: "/timing-templates" },
    { label: "Templates Mix", href: "/mix-templates" },
    { label: "Safras", href: "/seasons" },
    { label: "Relatórios", href: "/reports" },
    { label: "Plano", href: "/plan" },
    { label: "Configurações", href: "/settings" },
  ],
  PRODUCER: [],
};
