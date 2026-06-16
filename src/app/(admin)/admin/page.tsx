"use client";

import Link from "next/link";
import { useMemo } from "react";
import { PageHeader } from "@/components/domain/page-header";
import { LayoutDashboard } from "lucide-react";
import { DashboardKpiSkeleton } from "@/components/domain/page-skeletons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useAdminAgronomists,
  useAdminDeactivatedCatalog,
  useAdminPlatformActiveCatalog,
  useAdminProducers,
  usePlans,
} from "@/lib/api/hooks";

export default function AdminHomePage() {
  const { data: agronomists, isLoading: loadingA } = useAdminAgronomists("active");
  const { data: producers, isLoading: loadingProd } = useAdminProducers();
  const { data: plans, isLoading: loadingP } = usePlans();
  const { data: platformActiveRes, isLoading: loadingCatActive } = useAdminPlatformActiveCatalog();
  const { data: platformDeactivatedRes, isLoading: loadingCatOff } = useAdminDeactivatedCatalog();

  const counts = useMemo(() => {
    const aList = Array.isArray(agronomists) ? agronomists : [];
    const prodList = Array.isArray(producers) ? producers : [];
    const pList = plans ?? [];
    const activeCatalog = platformActiveRes?.data ?? [];
    const deactivatedCatalog = platformDeactivatedRes?.data ?? [];
    return {
      agronomists: aList.length,
      producers: prodList.filter((p) => p.row_type === "producer").length,
      plans: pList.length,
      catalogProducts: activeCatalog.length + deactivatedCatalog.length,
    };
  }, [agronomists, producers, plans, platformActiveRes, platformDeactivatedRes]);

  const loading = loadingA || loadingProd || loadingP || loadingCatActive || loadingCatOff;

  return (
    <>
      <PageHeader
        icon={<LayoutDashboard className="h-5 w-5" />}
        section="Admin"
        title="Painel Admin"
        description="Visão geral: agrônomos, produtores, planos e produtos."
      />
      {loading ? (
        <DashboardKpiSkeleton cards={4} />
      ) : (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/admin/agronomists" className="block transition-opacity hover:opacity-90">
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Agrônomos</CardTitle>
              <span className="font-display text-3xl font-semibold tabular-nums text-text-strong">
                {counts.agronomists}
              </span>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Contas ativas, plano vinculado e gestão de acesso.
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/producers" className="block transition-opacity hover:opacity-90">
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Produtores</CardTitle>
              <span className="font-display text-3xl font-semibold tabular-nums text-text-strong">
                {counts.producers}
              </span>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Contas de produtor e convites pendentes na listagem detalhada.
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/plans" className="block transition-opacity hover:opacity-90">
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Planos</CardTitle>
              <span className="font-display text-3xl font-semibold tabular-nums text-text-strong">
                {counts.plans}
              </span>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Quotas, preços mensais e status ativo.</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/global-catalog" className="block transition-opacity hover:opacity-90">
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Produtos</CardTitle>
              <span className="font-display text-3xl font-semibold tabular-nums text-text-strong">
                {counts.catalogProducts}
              </span>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Total no catálogo da plataforma (oficiais, customizados e removidos).
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
      )}
    </>
  );
}
