"use client";

import { routes } from "@recomenda/config";

import Link from "next/link";
import { useMemo } from "react";
import { PageHeader } from "@/components/domain/page-header";
import { LayoutDashboard } from "lucide-react";
import { DashboardKpiSkeleton } from "@/components/domain/page-skeletons";
import { Card, CardContent, CardHeader, CardTitle } from "@recomenda/ui/primitives/card";
import {
  useAdminAgronomists,
  useAdminDeactivatedCatalog,
  useAdminPlatformActiveCatalog,
  useAdminProducers,
  useAdminTeamMembers,
  useMe,
  usePlans,
} from "@recomenda/api-hooks";

export default function AdminHomePage() {
  const { data: me } = useMe();
  const isOrgAdmin = me?.role === "ORG_ADMIN";

  const { data: agronomists, isLoading: loadingA } = useAdminAgronomists("active");
  const { data: producers, isLoading: loadingProd } = useAdminProducers();
  const { data: team, isLoading: loadingTeam } = useAdminTeamMembers();
  const { data: plans, isLoading: loadingP } = usePlans({ enabled: !isOrgAdmin });
  const { data: platformActiveRes, isLoading: loadingCatActive } =
    useAdminPlatformActiveCatalog();
  const { data: platformDeactivatedRes, isLoading: loadingCatOff } =
    useAdminDeactivatedCatalog();

  const counts = useMemo(() => {
    const aList = Array.isArray(agronomists) ? agronomists : [];
    const prodList = Array.isArray(producers) ? producers : [];
    const teamList = Array.isArray(team) ? team : [];
    const pList = plans ?? [];
    const activeCatalog = platformActiveRes?.data ?? [];
    const deactivatedCatalog = platformDeactivatedRes?.data ?? [];
    const uniqueTeamUsers = new Set(teamList.map((m) => m.user_id));
    return {
      agronomists: aList.length,
      producers: prodList.filter((p) => p.row_type === "producer").length,
      team: uniqueTeamUsers.size,
      temporary: teamList.filter((m) => m.is_temporary).length,
      plans: pList.length,
      catalogProducts: activeCatalog.length + deactivatedCatalog.length,
    };
  }, [agronomists, producers, team, plans, platformActiveRes, platformDeactivatedRes]);

  const loading =
    loadingA ||
    loadingProd ||
    loadingTeam ||
    loadingCatActive ||
    loadingCatOff ||
    (!isOrgAdmin && loadingP);

  return (
    <>
      <PageHeader
        icon={<LayoutDashboard className="h-5 w-5" />}
        section="Admin"
        title="Painel Admin"
        description={
          isOrgAdmin
            ? "Visão da equipe: agrônomos, membros, produtores e produtos."
            : "Visão geral: agrônomos, equipe, produtores, planos e produtos."
        }
      />
      {loading ? (
        <DashboardKpiSkeleton cards={4} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Link href={routes.admin.agronomos.lista} className="block transition-opacity hover:opacity-90">
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">Agrônomos</CardTitle>
                <span className="font-display text-3xl font-semibold tabular-nums text-text-strong">
                  {counts.agronomists}
                </span>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {isOrgAdmin
                    ? "Agrônomos vinculados a esta equipe."
                    : "Contas ativas, plano vinculado e gestão de acesso."}
                </p>
              </CardContent>
            </Card>
          </Link>
          <Link href={routes.admin.equipe} className="block transition-opacity hover:opacity-90">
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">Equipe</CardTitle>
                <span className="font-display text-3xl font-semibold tabular-nums text-text-strong">
                  {counts.team}
                </span>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {isOrgAdmin
                    ? "Gestores e consultores das carteiras desta equipe"
                    : "Gestores e consultores nas carteiras"}
                  {counts.temporary > 0
                    ? ` · ${counts.temporary} conta${counts.temporary === 1 ? "" : "s"} temporária${counts.temporary === 1 ? "" : "s"}`
                    : ""}
                  .
                </p>
              </CardContent>
            </Card>
          </Link>
          <Link href={routes.admin.produtores.lista} className="block transition-opacity hover:opacity-90">
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
          {!isOrgAdmin ? (
            <Link href={routes.admin.planos} className="block transition-opacity hover:opacity-90">
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
          ) : null}
          <Link href={routes.admin.catalogoGlobal} className="block transition-opacity hover:opacity-90">
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">Produtos</CardTitle>
                <span className="font-display text-3xl font-semibold tabular-nums text-text-strong">
                  {counts.catalogProducts}
                </span>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {isOrgAdmin
                    ? "Catálogo global da plataforma e produtos criados nas carteiras desta equipe."
                    : "Total no catálogo da plataforma (oficiais, customizados e removidos)."}
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}
    </>
  );
}
