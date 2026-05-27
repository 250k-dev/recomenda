"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { PageHeader } from "@/components/domain/page-header";
import { UsersRound } from "lucide-react";
import { TableRowsSkeleton } from "@/components/domain/page-skeletons";
import { AdminListFilter } from "@/components/domain/admin-list-filter";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import type { AdminProducer } from "@/lib/api/client";
import { useAdminProducers, useDeleteAdminProducer, usePatchAdminProducer } from "@/lib/api/hooks";
import { ProducerAccountStatusBadge } from "@/components/domain/producer-account-status-badge";
import { SegmentedTabs } from "@/components/domain/segmented-tabs";
import { DeletePermanentIconButton } from "@/components/domain/delete-permanent-icon-button";
import { deactivateOutlineButtonClass } from "@/lib/action-button-styles";

function apiErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const body = error.response?.data as { message?: string } | undefined;
    if (body?.message && typeof body.message === "string") return body.message;
  }
  return fallback;
}

function rowKey(p: AdminProducer): string {
  return p.row_type === "producer" ? `p-${p.producer_id}` : `i-${p.invitation_id}`;
}

export default function AdminProducersPage() {
  const [tab, setTab] = useState<"active" | "archived">("active");
  const { data, isLoading } = useAdminProducers();
  const patchMutation = usePatchAdminProducer();
  const deleteMutation = useDeleteAdminProducer();
  const [filter, setFilter] = useState("");

  const list = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const activeList = useMemo(
    () => list.filter((p) => p.row_type === "invitation" || p.is_active),
    [list],
  );
  const archivedList = useMemo(
    () => list.filter((p) => p.row_type === "producer" && !p.is_active),
    [list],
  );

  const sourceList = tab === "active" ? activeList : archivedList;

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return sourceList;
    return sourceList.filter((p) => {
      const blob =
        `${p.name} ${p.email} ${p.producer_id ?? ""} ${p.invitation_id ?? ""} ${p.agronomist_name} ${p.agronomist_email} ${p.agronomist_id} ${p.account_status}`.toLowerCase();
      return blob.includes(q);
    });
  }, [sourceList, filter]);

  const archive = (p: AdminProducer) => {
    if (p.row_type !== "producer" || !p.producer_id) return;
    if (
      !globalThis.confirm(
        `Remover "${p.name}" da lista de ativos? A conta ficará inativa e não poderá acessar a plataforma.`,
      )
    ) {
      return;
    }
    patchMutation.mutate(
      { id: p.producer_id, is_active: false },
      {
        onSuccess: () => toast.success("Produtor removido da lista de ativos."),
        onError: (e) => toast.error(apiErrorMessage(e, "Não foi possível remover.")),
      },
    );
  };

  const restore = (p: AdminProducer) => {
    if (p.row_type !== "producer" || !p.producer_id) return;
    patchMutation.mutate(
      { id: p.producer_id, is_active: true },
      {
        onSuccess: () => toast.success("Produtor reativado."),
        onError: (e) => toast.error(apiErrorMessage(e, "Não foi possível reativar.")),
      },
    );
  };

  const removeHard = (p: AdminProducer) => {
    if (p.row_type !== "producer" || !p.producer_id) return;
    if (
      !globalThis.confirm(
        `Excluir permanentemente "${p.name}"? Esta ação não pode ser desfeita. Todos os dados vinculados a este produtor (safras, estoque, compras, acessos) serão removidos.`,
      )
    ) {
      return;
    }
    deleteMutation.mutate(p.producer_id, {
      onSuccess: () => toast.success("Produtor excluído."),
      onError: (e) => toast.error(apiErrorMessage(e, "Não foi possível excluir.")),
    });
  };

  const headers = ["Nome", "E-mail", "Agrônomo", "E-mail do agrônomo", "Status", "Ações"];

  const activeRows = filtered.map((p) => [
    p.row_type === "producer" && p.producer_id ? (
      <Link
        key={`nm-${rowKey(p)}`}
        href={`/admin/producers/${p.producer_id}`}
        className="font-medium text-primary hover:underline"
      >
        {p.name}
      </Link>
    ) : (
      <span key={`nm-${rowKey(p)}`}>{p.name}</span>
    ),
    p.email,
    p.agronomist_name,
    p.agronomist_email,
    <ProducerAccountStatusBadge key={`st-${rowKey(p)}`} status={p.account_status} />,
    <div key={`act-${rowKey(p)}`} className="flex flex-wrap justify-end gap-2">
      {p.row_type === "producer" && p.producer_id ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={deactivateOutlineButtonClass}
          disabled={patchMutation.isPending}
          onClick={() => archive(p)}
        >
          Remover
        </Button>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      )}
    </div>,
  ]);

  const archivedRows = filtered.map((p) => [
    p.row_type === "producer" && p.producer_id ? (
      <Link
        key={`nm-${rowKey(p)}`}
        href={`/admin/producers/${p.producer_id}`}
        className="font-medium text-primary hover:underline"
      >
        {p.name}
      </Link>
    ) : (
      <span key={`nm-${rowKey(p)}`}>{p.name}</span>
    ),
    p.email,
    p.agronomist_name,
    p.agronomist_email,
    <ProducerAccountStatusBadge key={`st-${rowKey(p)}`} status={p.account_status} />,
    <div key={`arc-${rowKey(p)}`} className="flex flex-wrap justify-end gap-2">
      {p.row_type === "producer" && p.producer_id ? (
        <>
          <Button type="button" variant="secondary" size="sm" disabled={patchMutation.isPending} onClick={() => restore(p)}>
            Restaurar
          </Button>
          <DeletePermanentIconButton
            disabled={deleteMutation.isPending}
            onClick={() => removeHard(p)}
          />
        </>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      )}
    </div>,
  ]);

  const rows = tab === "active" ? activeRows : archivedRows;

  return (
    <>
      <PageHeader
        icon={<UsersRound className="h-5 w-5" />}
        section="Usuários"
        title="Produtores"
        description="Produtores vinculados e convites pendentes. O status reflete conta ativa, inativa (removida da lista ativa) ou convite (enviado / expirado). Remover desativa o acesso; na aba Removidos você pode restaurar ou excluir definitivamente."
      />

      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <SegmentedTabs
          value={tab}
          onValueChange={(v) => {
            setTab(v);
            setFilter("");
          }}
          items={[
            { value: "active", label: "Ativos" },
            { value: "archived", label: "Removidos", badgeCount: archivedList.length },
          ]}
        />

        <div className="min-w-0 flex-1 sm:max-w-md lg:max-w-lg">
          <AdminListFilter value={filter} onChange={setFilter} placeholder="Filtrar por nome, e-mail, agrônomo ou ID..." />
        </div>
      </div>

      {isLoading ? (
        <TableRowsSkeleton rows={10} columns={6} />
      ) : (
        <DataTable headers={headers} rows={rows} />
      )}
    </>
  );
}
