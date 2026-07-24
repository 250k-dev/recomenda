"use client";

import { routes } from "@recomenda/config";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { UserCog } from "lucide-react";
import { PageHeader } from "@/components/domain/page-header";
import { TableRowsSkeleton } from "@/components/domain/page-skeletons";
import { AdminListFilter } from "@/components/domain/admin-list-filter";
import { StatusBadge } from "@/components/domain/status-badge";
import { SegmentedTabs } from "@/components/domain/segmented-tabs";
import { DataTable } from "@recomenda/ui/patterns/data-table";
import { EmptyState } from "@recomenda/ui/patterns/empty-state";
import { Button } from "@recomenda/ui/primitives/button";
import { Label } from "@recomenda/ui/primitives/label";
import { Select } from "@recomenda/ui/forms/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@recomenda/ui/primitives/sheet";
import { apiErrorMessage } from "@recomenda/api/api-error";
import type { AdminTeamMember } from "@recomenda/api";
import {
  useAdminTeamMembers,
  usePlans,
  usePromoteAdminTeamMember,
} from "@recomenda/api-hooks";

type TabKey = "all" | "managers" | "operators" | "temporary";

function accessLabel(level: AdminTeamMember["access_level"]) {
  return level === "MANAGER" ? "Gestor" : "Operador";
}

function memberKey(m: AdminTeamMember) {
  return `${m.user_id}:${m.agronomist_id}`;
}

export default function AdminEquipePage() {
  const [tab, setTab] = useState<TabKey>("all");
  const [filter, setFilter] = useState("");
  const [promoteTarget, setPromoteTarget] = useState<AdminTeamMember | null>(null);
  const [planId, setPlanId] = useState("");

  const { data, isLoading } = useAdminTeamMembers();
  const { data: plans } = usePlans();
  const promoteMutation = usePromoteAdminTeamMember();

  const list = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const tabbed = useMemo(() => {
    switch (tab) {
      case "managers":
        return list.filter((m) => m.access_level === "MANAGER");
      case "operators":
        return list.filter((m) => m.access_level === "ASSISTANT");
      case "temporary":
        return list.filter((m) => m.is_temporary);
      default:
        return list;
    }
  }, [list, tab]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return tabbed;
    return tabbed.filter((m) => {
      const blob =
        `${m.name} ${m.email} ${m.agronomist_name} ${m.manager_name ?? ""} ${accessLabel(m.access_level)}`.toLowerCase();
      return blob.includes(q);
    });
  }, [tabbed, filter]);

  const counts = useMemo(
    () => ({
      all: list.length,
      managers: list.filter((m) => m.access_level === "MANAGER").length,
      operators: list.filter((m) => m.access_level === "ASSISTANT").length,
      temporary: list.filter((m) => m.is_temporary).length,
    }),
    [list],
  );

  const openPromote = (m: AdminTeamMember) => {
    setPromoteTarget(m);
    setPlanId(plans?.find((p) => p.is_active)?.id ?? plans?.[0]?.id ?? "");
  };

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

  const headers = [
    "Nome",
    "Papel",
    "Carteira",
    "Gestor",
    "Produtores",
    "Conta",
    "Ações",
  ];

  const rows = filtered.map((m) => [
    <div key={`n-${memberKey(m)}`} className="min-w-0">
      <p className="font-medium text-text-strong">{m.name || "—"}</p>
      <p className="truncate text-xs text-muted-foreground">{m.email}</p>
    </div>,
    <StatusBadge key={`lv-${memberKey(m)}`} tone={m.access_level === "MANAGER" ? "primary" : "neutral"}>
      {accessLabel(m.access_level)}
    </StatusBadge>,
    <Link
      key={`agr-${memberKey(m)}`}
      href={routes.admin.agronomos.detalhe(m.agronomist_id)}
      className="font-medium text-primary hover:underline"
    >
      {m.agronomist_name || "—"}
    </Link>,
    m.manager_name ?? "—",
    String(m.producer_count),
    <div key={`st-${memberKey(m)}`} className="flex flex-wrap gap-1">
      {m.is_active ? (
        <StatusBadge tone="success">Ativo</StatusBadge>
      ) : (
        <StatusBadge tone="neutral">Inativo</StatusBadge>
      )}
      {m.is_temporary ? <StatusBadge tone="warning">Temporária</StatusBadge> : null}
      {m.is_agronomist ? <StatusBadge tone="clay">Agrônomo</StatusBadge> : null}
    </div>,
    m.is_agronomist ? (
      <span key={`a-${memberKey(m)}`} className="text-xs text-muted-foreground">
        Já é agrônomo
      </span>
    ) : (
      <Button key={`a-${memberKey(m)}`} size="sm" variant="outline" onClick={() => openPromote(m)}>
        Promover
      </Button>
    ),
  ]);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        icon={<UserCog className="h-5 w-5" />}
        section="Admin"
        title="Equipe"
        description="Gestores e operadores em todas as carteiras. Contas temporárias podem ser promovidas a agrônomo."
      />

      <SegmentedTabs
        value={tab}
        onValueChange={setTab}
        items={[
          { value: "all", label: "Todos", badgeCount: counts.all },
          { value: "managers", label: "Gestores", badgeCount: counts.managers },
          { value: "operators", label: "Operadores", badgeCount: counts.operators },
          { value: "temporary", label: "Temporárias", badgeCount: counts.temporary },
        ]}
      />

      <AdminListFilter
        value={filter}
        onChange={setFilter}
        placeholder="Filtrar por nome, e-mail, carteira…"
      />

      {isLoading ? (
        <TableRowsSkeleton rows={8} columns={7} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhum membro encontrado"
          description="Convites de equipe aceitos aparecem aqui por carteira."
        />
      ) : (
        <DataTable headers={headers} rows={rows} />
      )}

      <Sheet open={Boolean(promoteTarget)} onOpenChange={(open) => !open && setPromoteTarget(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Promover a agrônomo</SheetTitle>
          </SheetHeader>
          {promoteTarget ? (
            <div className="mt-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-text-strong">{promoteTarget.name}</span> (
                {promoteTarget.email}) deixa de ser só conta de equipe e passa a ter carteira própria.
                Vínculos atuais em Minhas Gestões são mantidos.
              </p>
              <div className="space-y-2">
                <Label htmlFor="promote-plan">Plano</Label>
                <Select
                  id="promote-plan"
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
