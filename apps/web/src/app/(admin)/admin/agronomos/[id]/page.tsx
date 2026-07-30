"use client";

import { routes } from "@recomenda/config";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  Building2,
  MailPlus,
  Sprout,
  UserCog,
  UserRound,
  Users as UsersIcon,
} from "lucide-react";
import { BreadcrumbBack } from "@/components/domain/breadcrumb-back";
import { PageHeader } from "@/components/domain/page-header";
import { TableRowsSkeleton } from "@/components/domain/page-skeletons";
import { KpiStrip, KpiCell } from "@/components/domain/kpi-strip";
import { StatusBadge } from "@/components/domain/status-badge";
import { SectionTitle } from "@recomenda/ui/patterns/section-title";
import { EmptyState } from "@recomenda/ui/patterns/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@recomenda/ui/primitives/card";
import { DataTable } from "@recomenda/ui/patterns/data-table";
import { Button } from "@recomenda/ui/primitives/button";
import { Label } from "@recomenda/ui/primitives/label";
import { Select } from "@recomenda/ui/forms/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@recomenda/ui/primitives/sheet";
import { apiErrorMessage } from "@recomenda/api/api-error";
import type { AdminTeamMember } from "@recomenda/api";
import {
  useAdminAgronomistDetail,
  usePlans,
  usePromoteAdminTeamMember,
} from "@recomenda/api-hooks";

function accessLabel(level: AdminTeamMember["access_level"]) {
  return level === "MANAGER" ? "Gestor" : "Consultor";
}

export default function AdminAgronomistDetailPage() {
  const params = useParams<{ id: string }>();
  const agronomistId = params.id;
  const { data, isLoading, isError } = useAdminAgronomistDetail(agronomistId);
  const { data: plans } = usePlans();
  const promoteMutation = usePromoteAdminTeamMember();
  const [promoteTarget, setPromoteTarget] = useState<AdminTeamMember | null>(null);
  const [planId, setPlanId] = useState("");

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
  const team = data.team ?? [];

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

  const teamRows = team.map((m) => [
    <div key={`n-${m.user_id}`} className="min-w-0">
      <p className="font-medium text-text-strong">{m.name || "—"}</p>
      <p className="truncate text-xs text-muted-foreground">{m.email}</p>
    </div>,
    <StatusBadge key={`lv-${m.user_id}`} tone={m.access_level === "MANAGER" ? "primary" : "neutral"}>
      {accessLabel(m.access_level)}
    </StatusBadge>,
    m.manager_name ?? "—",
    String(m.producer_count),
    <div key={`st-${m.user_id}`} className="flex flex-wrap gap-1">
      {m.is_active ? (
        <StatusBadge tone="success">Ativo</StatusBadge>
      ) : (
        <StatusBadge tone="neutral">Inativo</StatusBadge>
      )}
      {m.is_temporary ? <StatusBadge tone="warning">Temporária</StatusBadge> : null}
      {m.is_agronomist ? <StatusBadge tone="clay">Agrônomo</StatusBadge> : null}
    </div>,
    m.is_agronomist ? (
      <span key={`a-${m.user_id}`} className="text-xs text-muted-foreground">
        Já é agrônomo
      </span>
    ) : (
      <Button
        key={`a-${m.user_id}`}
        size="sm"
        variant="outline"
        onClick={() => {
          setPromoteTarget(m);
          setPlanId(plans?.find((p) => p.is_active)?.id ?? plans?.[0]?.id ?? "");
        }}
      >
        Promover
      </Button>
    ),
  ]);

  const confirmPromote = () => {
    if (!promoteTarget || !planId) return;
    promoteMutation.mutate(
      { userId: promoteTarget.user_id, planId },
      {
        onSuccess: () => {
          toast.success(`${promoteTarget.name} promovido a agrônomo.`);
          setPromoteTarget(null);
        },
        onError: (e) => toast.error(apiErrorMessage(e, "Não foi possível promover.")),
      },
    );
  };

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
        <KpiCell
          icon={<UserCog className="h-4 w-4" />}
          label="Gestores"
          value={data.counts.managers ?? 0}
        />
        <KpiCell
          icon={<UsersIcon className="h-4 w-4" />}
          label="Consultores"
          value={data.counts.consultants ?? 0}
        />
      </KpiStrip>

      <Card>
        <CardHeader>
          <CardTitle>Dados do agrônomo</CardTitle>
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
          <div className="flex justify-between">
            <span className="text-muted-foreground">Contas temporárias na equipe</span>
            <span className="font-medium">{data.counts.temporary_members ?? 0}</span>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionTitle title="Equipe (gestores e consultores)" />
          <Link
            href={routes.admin.equipe}
            className="text-sm font-medium text-primary hover:underline"
          >
            Ver toda a equipe
          </Link>
        </div>
        {team.length === 0 ? (
          <EmptyState title="Nenhum membro de equipe" variant="inline" />
        ) : (
          <DataTable
            headers={["Nome", "Papel", "Gestor", "Produtores", "Conta", "Ações"]}
            rows={teamRows}
          />
        )}
      </div>

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

      <Sheet open={Boolean(promoteTarget)} onOpenChange={(open) => !open && setPromoteTarget(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Promover a agrônomo</SheetTitle>
          </SheetHeader>
          {promoteTarget ? (
            <div className="mt-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-text-strong">{promoteTarget.name}</span> (
                {promoteTarget.email}) passa a ter carteira própria. Os vínculos nesta e em outras
                gestões são mantidos.
              </p>
              <div className="space-y-2">
                <Label htmlFor="detail-promote-plan">Plano</Label>
                <Select
                  id="detail-promote-plan"
                  value={planId}
                  onValueChange={setPlanId}
                  filterLabel="Plano"
                  options={(plans ?? [])
                    .filter((p) => p.is_active)
                    .map((p) => ({ value: p.id, label: p.name }))}
                  placeholder="Selecione o plano"
                />
              </div>
              <Button
                className="w-full"
                disabled={!planId || promoteMutation.isPending}
                onClick={confirmPromote}
              >
                {promoteMutation.isPending ? "Promovendo…" : "Confirmar promoção"}
              </Button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
