"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import {
  Building2,
  Leaf,
  Users,
  ArrowRight,
  Plus,
  Package,
  BarChart3,
  LayoutDashboard,
} from "lucide-react";
import { PageHeader } from "@/components/domain/page-header";
import { StatCard } from "@/components/domain/stat-card";
import { DashboardKpiSkeleton } from "@/components/domain/page-skeletons";
import { useFarms, useProducers, useSeasons } from "@/lib/api/hooks";

export default function DashboardPage() {
  const farms = useFarms();
  const producers = useProducers();
  const seasons = useSeasons();

  const producerCount = useMemo(
    () => (producers.data?.data ?? []).filter((p) => p.row_type === "producer").length,
    [producers.data],
  );

  const loading = farms.isLoading || producers.isLoading || seasons.isLoading;

  return (
    <>
      <PageHeader
        icon={<LayoutDashboard className="h-5 w-5" />}
        title="Dashboard"
        description="Visão geral dos seus produtores. Cadastre produtores, fazendas e talhões e monte a recomendação da safra."
      />

      {loading ? (
        <DashboardKpiSkeleton cards={3} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Produtores"
            value={producerCount}
            sub="cadastrados na sua carteira"
            icon={<Users className="h-4 w-4" />}
            accent="primary"
          />
          <StatCard
            label="Fazendas"
            value={farms.data?.pagination?.total ?? 0}
            sub="com talhões mapeados"
            icon={<Building2 className="h-4 w-4" />}
            accent="sky"
          />
          <StatCard
            label="Safras"
            value={seasons.data?.pagination?.total ?? 0}
            sub="em planejamento e andamento"
            icon={<Leaf className="h-4 w-4" />}
            accent="sun"
          />
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {/* Cadastrar produtor — destaque */}
        <Link
          href="/producers/new"
          className="group relative overflow-hidden rounded-xl border-2 border-primary/30 bg-linear-to-br from-primary/10 to-primary/5 px-5 py-5 shadow-sm transition-all hover:border-primary/60 hover:from-primary/15 hover:to-primary/10"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary">
              <Plus className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground">Cadastrar produtor</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Fluxo guiado: produtor, fazenda, talhão, lista de compra e safra.
              </p>
            </div>
          </div>
          <ArrowRight className="absolute right-5 top-1/2 h-5 w-5 -translate-y-1/2 shrink-0 text-primary/60 transition-all group-hover:translate-x-1 group-hover:text-primary" />
        </Link>

        <NavCard
          href="/producers"
          title="Produtores"
          description="Acompanhe a carteira, fazendas e o status de cada produtor."
          icon={<Users className="h-5 w-5" />}
        />
        <NavCard
          href="/catalog"
          title="Produtos"
          description="Catálogo global e os seus produtos personalizados."
          icon={<Package className="h-5 w-5" />}
        />
        <NavCard
          href="/reports"
          title="Relatórios"
          description="Comparativos e indicadores das suas safras."
          icon={<BarChart3 className="h-5 w-5" />}
        />
      </div>
    </>
  );
}

function NavCard({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-xl border bg-card px-5 py-5 shadow-sm transition-colors hover:bg-accent/50"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}
