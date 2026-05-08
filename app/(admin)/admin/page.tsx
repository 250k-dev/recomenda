"use client";

import Link from "next/link";
import { useMemo } from "react";
import { PageHeader } from "@/components/domain/page-header";
import { DashboardKpiSkeleton } from "@/components/domain/page-skeletons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminAgronomists, useAdminProducers, useGlobalCatalog, usePlans } from "@/lib/api/hooks";

export default function AdminHomePage() {
  const { data: agronomists, isLoading: loadingA } = useAdminAgronomists("active");
  const { data: producers, isLoading: loadingProd } = useAdminProducers();
  const { data: plans, isLoading: loadingP } = usePlans();
  const { data: globalRes, isLoading: loadingG } = useGlobalCatalog();

  const counts = useMemo(() => {
    const aList = Array.isArray(agronomists) ? agronomists : [];
    const prodList = Array.isArray(producers) ? producers : [];
    const pList = plans ?? [];
    const gList = globalRes?.data ?? [];
    return {
      agronomists: aList.length,
      producers: prodList.filter((p) => p.row_type === "producer").length,
      plans: pList.length,
      global: gList.length,
    };
  }, [agronomists, producers, plans, globalRes]);

  const loading = loadingA || loadingProd || loadingP || loadingG;

  return (
    <>
      <PageHeader
        title="Painel Admin"
        description="Visão geral: agrônomos, produtores, planos e catálogo global."
      />
      {loading ? (
        <DashboardKpiSkeleton cards={4} />
      ) : (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/admin/agronomists" className="block transition-opacity hover:opacity-90">
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-medium">Agrônomos</CardTitle>
              <span className="text-2xl font-bold tabular-nums text-[var(--brand)]">
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
              <CardTitle className="text-base font-medium">Produtores</CardTitle>
              <span className="text-2xl font-bold tabular-nums text-[var(--brand)]">
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
              <CardTitle className="text-base font-medium">Planos</CardTitle>
              <span className="text-2xl font-bold tabular-nums text-[var(--brand)]">
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
              <CardTitle className="text-base font-medium">Catálogo global</CardTitle>
              <span className="text-2xl font-bold tabular-nums text-[var(--brand)]">
                {counts.global}
              </span>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Produtos de referência para todos os agrônomos.</p>
            </CardContent>
          </Card>
        </Link>
      </div>
      )}
    </>
  );
}
