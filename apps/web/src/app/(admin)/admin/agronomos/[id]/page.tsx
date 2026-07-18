"use client";

import { routes } from "@recomenda/config";

import Link from "next/link";
import { useParams } from "next/navigation";

import { Building2, MailPlus, Sprout, UserRound, Users as UsersIcon } from "lucide-react";
import { BreadcrumbBack } from "@/components/domain/breadcrumb-back";
import { PageHeader } from "@/components/domain/page-header";
import { TableRowsSkeleton } from "@/components/domain/page-skeletons";
import { KpiStrip, KpiCell } from "@/components/domain/kpi-strip";
import { StatusBadge } from "@/components/domain/status-badge";
import { SectionTitle } from "@/components/ui/section-title";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { useAdminAgronomistDetail, usePlans } from "@/lib/api/hooks";

export default function AdminAgronomistDetailPage() {
  const params = useParams<{ id: string }>();
  const agronomistId = params.id;
  const { data, isLoading, isError } = useAdminAgronomistDetail(agronomistId);
  const { data: plans } = usePlans();

  if (isLoading) {
    return (
      <>
        <BreadcrumbBack
          items={[{ label: "Agrônomos", href: routes.admin.agronomos.lista }, { label: "Carregando…" }]}
        />
        <PageHeader title="Agrônomo" description="Carregando…" />
        <div className="mt-6 space-y-6">
          <TableRowsSkeleton rows={4} columns={4} />
          <TableRowsSkeleton rows={6} columns={4} />
        </div>
      </>
    );
  }

  if (isError || !data) {
    return (
      <>
        <BreadcrumbBack
          items={[{ label: "Agrônomos", href: routes.admin.agronomos.lista }, { label: "Não encontrado" }]}
        />
        <p className="text-sm text-destructive">Agrônomo não encontrado.</p>
      </>
    );
  }

  const planName = plans?.find((p) => p.id === data.plan_id)?.name ?? data.plan_id;

  const farmRows = data.farms.map((f) => [
    f.name,
    f.location ?? "—",
    String(f.plot_count),
    new Date(f.created_at).toLocaleDateString("pt-BR"),
  ]);

  const producerRows = data.producers.map((p) => [
    <Link
      key={p.producer_id}
      href={routes.admin.produtores.detalhe(p.producer_id)}
      className="font-medium text-primary hover:underline"
    >
      {p.name || "—"}
    </Link>,
    p.email,
    p.is_active ? (
      <StatusBadge key={`st-${p.producer_id}`} tone="success">Ativo</StatusBadge>
    ) : (
      <StatusBadge key={`st-${p.producer_id}`} tone="neutral">Inativo</StatusBadge>
    ),
  ]);

  return (
    <div className="space-y-8 animate-fade-in">
      <BreadcrumbBack
        items={[{ label: "Agrônomos", href: routes.admin.agronomos.lista }, { label: data.name }]}
      />

      <PageHeader
        icon={<UserRound className="h-5 w-5" />}
        section="Agrônomo"
        title={data.name}
        description={data.email}
        action={
          data.is_active ? (
            <StatusBadge tone="success">Conta ativa</StatusBadge>
          ) : (
            <StatusBadge tone="neutral">Conta inativa</StatusBadge>
          )
        }
      />

      <KpiStrip>
        <KpiCell
          icon={<Building2 className="h-4 w-4" />}
          label="Fazendas"
          value={data.counts.farms}
        />
        <KpiCell
          icon={<UsersIcon className="h-4 w-4" />}
          label="Produtores"
          value={data.counts.producers}
        />
        <KpiCell
          icon={<Sprout className="h-4 w-4" />}
          label="Safras"
          value={data.counts.seasons}
        />
        <KpiCell
          icon={<MailPlus className="h-4 w-4" />}
          label="Convites pendentes"
          value={data.counts.pending_invitations}
        />
      </KpiStrip>

      <Card>
        <CardHeader>
          <CardTitle>Dados do consultor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">ID</span>
            <span className="font-mono text-xs text-right break-all">{data.user_id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Plano</span>
            <span className="font-medium">{planName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Início do plano</span>
            <span className="font-medium">
              {new Date(data.plan_started_at).toLocaleString("pt-BR")}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Talhões ativos</span>
            <span className="font-medium">{data.active_plots_count}</span>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <SectionTitle title="Fazendas cadastradas" />
        {data.farms.length === 0 ? (
          <EmptyState title="Nenhuma fazenda" variant="inline" />
        ) : (
          <DataTable headers={["Nome", "Localização", "Talhões", "Criada em"]} rows={farmRows} />
        )}
      </div>

      <div className="space-y-4">
        <SectionTitle title="Produtores vinculados" />
        {data.producers.length === 0 ? (
          <EmptyState title="Nenhum produtor vinculado" variant="inline" />
        ) : (
          <DataTable headers={["Nome", "E-mail", "Conta"]} rows={producerRows} />
        )}
      </div>
    </div>
  );
}
