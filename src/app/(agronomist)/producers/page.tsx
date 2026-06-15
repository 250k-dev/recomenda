"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "sonner";
import { useProducers, useSetProducerActive, useDeleteProducer, useRevokeInvitation } from "@/lib/api/hooks";
import { apiErrorMessage } from "@/lib/api-error";
import { BreadcrumbBack } from "@/components/domain/breadcrumb-back";
import { PageHeader } from "@/components/domain/page-header";
import { KpiStrip, KpiCell } from "@/components/domain/kpi-strip";
import { ProducerAccountStatusBadge } from "@/components/domain/producer-account-status-badge";
import { SegmentedTabs } from "@/components/domain/segmented-tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { TableRowsSkeleton } from "@/components/domain/page-skeletons";
import type { AgronomistProducerListRow } from "@/lib/api/client";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Plus,
  UsersRound,
  Search,
  ArrowDownUp,
  Users as UsersIcon,
  Sprout,
  Archive,
  RotateCcw,
  Trash2,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { deactivateOutlineButtonClass } from "@/lib/action-button-styles";

type Tab = "active" | "archived";
type SortMode = "name" | "hectares-desc" | "hectares-asc";

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const fmtHa = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

function rowKey(p: AgronomistProducerListRow): string {
  return p.row_type === "producer" ? `p-${p.producer_id}` : `i-${p.invitation_id}`;
}

type PendingAction =
  | { kind: "archive"; id: string; name: string }
  | { kind: "delete"; id: string; name: string }
  | { kind: "revoke-invitation"; id: string; name: string };


export default function ProducersPage() {
  const router = useRouter();
  const { data, isLoading } = useProducers();
  const setActive = useSetProducerActive();
  const deleteMutation = useDeleteProducer();
  const revokeInvitationMutation = useRevokeInvitation();
  const [tab, setTab] = useState<Tab>("active");
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<SortMode>("name");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const onArchive = (id: string, name: string) =>
    setPendingAction({ kind: "archive", id, name });
  const onReactivate = (id: string) =>
    setActive.mutate(
      { id, is_active: true },
      {
        onSuccess: () => toast.success("Produtor reativado."),
        onError: (err) => toast.error(apiErrorMessage(err, "Não foi possível reativar.")),
      },
    );
  const onDelete = (id: string, name: string) =>
    setPendingAction({ kind: "delete", id, name });
  const onRevokeInvitation = (id: string, name: string) =>
    setPendingAction({ kind: "revoke-invitation", id, name });

  const confirmAction = () => {
    if (!pendingAction) return;
    if (pendingAction.kind === "archive") {
      setActive.mutate(
        { id: pendingAction.id, is_active: false },
        {
          onSuccess: () => {
            toast.success("Produtor movido para Removidos.");
            setPendingAction(null);
          },
          onError: (err) => toast.error(apiErrorMessage(err, "Não foi possível remover.")),
        },
      );
    } else if (pendingAction.kind === "revoke-invitation") {
      revokeInvitationMutation.mutate(pendingAction.id, {
        onSuccess: () => {
          toast.success("Convite cancelado.");
          setPendingAction(null);
        },
        onError: (err) => toast.error(apiErrorMessage(err, "Não foi possível cancelar o convite.")),
      });
    } else {
      deleteMutation.mutate(pendingAction.id, {
        onSuccess: () => {
          toast.success("Produtor excluído permanentemente.");
          setPendingAction(null);
        },
        onError: (err) => toast.error(apiErrorMessage(err, "Não foi possível excluir.")),
      });
    }
  };

  const actionPending = setActive.isPending || deleteMutation.isPending || revokeInvitationMutation.isPending;

  const list = useMemo(() => data?.data ?? [], [data]);

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
    const base = q
      ? sourceList.filter((p) => {
          const blob =
            `${p.name} ${p.email} ${p.producer_id ?? ""} ${p.invitation_id ?? ""} ${p.account_status}`.toLowerCase();
          return blob.includes(q);
        })
      : sourceList;
    return [...base].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "pt-BR");
      const aha = a.total_hectares ?? 0;
      const bha = b.total_hectares ?? 0;
      return sort === "hectares-desc" ? bha - aha : aha - bha;
    });
  }, [sourceList, filter, sort]);

  // KPIs derivados das listas (visão geral, independente do tab).
  const producersOnly = list.filter((p) => p.row_type === "producer");
  const totalProducers = producersOnly.length;
  const totalHectares = producersOnly.reduce(
    (s, p) => s + (p.total_hectares ?? 0),
    0,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BreadcrumbBack
          items={[{ label: "Início", href: "/dashboard" }, { label: "Produtores" }]}
        />
        <PageHeader
          icon={<UsersRound className="h-5 w-5" />}
          section="Carteira"
          title="Produtores"
          description={`${fmt(totalProducers)} produtor${totalProducers === 1 ? "" : "es"} cadastrado${totalProducers === 1 ? "" : "s"}. Acompanhe fazendas, safras e o status de cada um.`}
          action={
            <Button asChild variant="clay">
              <Link href="/producers/new">
                <Plus className="h-4 w-4" />
                Cadastrar produtor
              </Link>
            </Button>
          }
        />
      </div>

      {/* KPI strip */}
      <KpiStrip>
        <KpiCell
          label="Produtores"
          value={fmt(totalProducers)}
          sub="na carteira"
          icon={<UsersIcon className="size-4" />}
        />
        <KpiCell
          label="Hectares totais"
          value={`${fmtHa(totalHectares)} ha`}
          sub="soma da carteira"
          icon={<Sprout className="size-4" />}
        />
      </KpiStrip>

      {/* Lista */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {/* Toolbar: abas + filtros na mesma linha */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-2 px-3 py-3">
          <SegmentedTabs
            value={tab}
            onValueChange={(v) => { setTab(v); setFilter(""); }}
            items={[
              { value: "active", label: "Ativos" },
              { value: "archived", label: "Removidos", badgeCount: archivedList.length },
            ]}
          />
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrar por nome, e-mail ou ID…"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1.5 rounded-md border bg-card pl-2.5 pr-1">
            <ArrowDownUp className="h-4 w-4 text-muted-foreground" />
            <Select
              value={sort}
              onValueChange={(value) => setSort(value as SortMode)}
              size="sm"
              className="h-10 min-w-[12rem] border-0 bg-transparent pr-2 text-sm shadow-none"
              options={[
                { value: "name", label: "Ordenar: Nome" },
                { value: "hectares-desc", label: "Ordenar: Hectares ↓" },
                { value: "hectares-asc", label: "Ordenar: Hectares ↑" },
              ]}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-3">
            <TableRowsSkeleton rows={8} columns={5} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            variant="inline"
            icon={UsersRound}
            title={tab === "active" ? "Nenhum produtor ou convite na lista ativa." : "Nenhum produtor removido."}
            description={tab === "active" ? "Cadastre o primeiro produtor para começar." : undefined}
            action={
              tab === "active" ? (
                <Link href="/producers/new">
                  <Button size="sm" className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    Adicionar produtor
                  </Button>
                </Link>
              ) : undefined
            }
            className="px-4 py-10"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-left text-[0.72rem] font-bold uppercase tracking-[0.07em] text-muted-foreground">
                  <th className="px-4 py-3.5">Produtor</th>
                  <th className="px-2 py-3.5">Status</th>
                  <th className="px-2 py-3.5 text-right">Hectares</th>
                  <th className="w-12 px-2 py-3.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <ProducerRow
                    key={rowKey(p)}
                    producer={p}
                    tab={tab}
                    actionPending={actionPending}
                    onOpen={() =>
                      p.producer_id ? router.push(`/producers/${p.producer_id}`) : null
                    }
                    onArchive={() => p.producer_id && onArchive(p.producer_id, p.name)}
                    onReactivate={() => p.producer_id && onReactivate(p.producer_id)}
                    onDelete={() => p.producer_id && onDelete(p.producer_id, p.name)}
                    onRevokeInvitation={() => p.invitation_id && onRevokeInvitation(p.invitation_id, p.name)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingAction !== null}
        onOpenChange={(o) => !o && setPendingAction(null)}
        title={
          pendingAction?.kind === "delete"
            ? `Excluir ${pendingAction.name} permanentemente?`
            : pendingAction?.kind === "archive"
              ? `Remover ${pendingAction.name}?`
              : pendingAction?.kind === "revoke-invitation"
                ? `Cancelar convite para ${pendingAction.name}?`
                : ""
        }
        description={
          pendingAction?.kind === "delete"
            ? "Esta ação apaga o produtor e todos os dados vinculados (safras, recomendações, estoque, compras, acessos). Não pode ser desfeita."
            : pendingAction?.kind === "revoke-invitation"
              ? "O convite será cancelado e o link enviado deixará de funcionar."
              : "O produtor sai da lista de ativos e vai para Removidos. Você pode reativá-lo a qualquer momento."
        }
        confirmLabel={
          pendingAction?.kind === "delete"
            ? "Excluir definitivamente"
            : pendingAction?.kind === "revoke-invitation"
              ? "Cancelar convite"
              : "Remover"
        }
        tone="destructive"
        loading={actionPending}
        onConfirm={confirmAction}
      />
    </div>
  );
}

function ProducerRow({
  producer,
  tab,
  actionPending,
  onOpen,
  onArchive,
  onReactivate,
  onDelete,
  onRevokeInvitation,
}: {
  producer: AgronomistProducerListRow;
  tab: Tab;
  actionPending: boolean;
  onOpen: () => void;
  onArchive: () => void;
  onReactivate: () => void;
  onDelete: () => void;
  onRevokeInvitation: () => void;
}) {
  const initial = (producer.name?.trim().charAt(0) || "?").toUpperCase();
  const isInvitation = producer.row_type === "invitation";
  const canManage = producer.row_type === "producer" && Boolean(producer.producer_id);
  const canOpen = Boolean(producer.producer_id);
  const stop = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation();
    fn();
  };
  return (
    <tr
      className={cn(
        "border-b border-border transition-colors last:border-b-0 hover:bg-hover",
        canOpen && "cursor-pointer",
      )}
      onClick={canOpen ? onOpen : undefined}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold",
              isInvitation
                ? "bg-surface-2 text-muted-foreground"
                : "bg-primary-soft text-primary-strong",
            )}
          >
            {initial}
          </div>
          <div className="min-w-0">
            <div className="truncate font-semibold text-text-strong">
              {producer.name}
            </div>
            {producer.email ? (
              <div className="truncate text-xs text-muted-foreground">
                {producer.email}
              </div>
            ) : null}
          </div>
        </div>
      </td>
      <td className="px-2 py-3">
        <ProducerAccountStatusBadge status={producer.account_status} />
      </td>
      <td className="px-2 py-3 text-right tabular-nums text-muted-foreground">
        {producer.total_hectares != null ? `${fmtHa(producer.total_hectares)} ha` : "—"}
      </td>
      <td className="px-2 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          {canManage && tab === "active" ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={stop(onArchive)}
              disabled={actionPending}
              className="gap-1.5 text-muted-foreground hover:text-destructive"
            >
              <Archive className="h-4 w-4" />
              <span className="hidden sm:inline">Remover</span>
            </Button>
          ) : null}
          {canManage && tab === "archived" ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={stop(onReactivate)}
                disabled={actionPending}
                className="gap-1.5 text-muted-foreground hover:text-primary"
              >
                <RotateCcw className="h-4 w-4" />
                <span className="hidden sm:inline">Reativar</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={stop(onDelete)}
                disabled={actionPending}
                className={cn(deactivateOutlineButtonClass, "gap-1.5")}
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">Excluir</span>
              </Button>
            </>
          ) : null}
          {isInvitation && producer.invitation_id ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={stop(onRevokeInvitation)}
              disabled={actionPending}
              className="gap-1.5 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Cancelar convite</span>
            </Button>
          ) : null}
          {canOpen ? (
            <ChevronRight className="ml-1 h-5 w-5 shrink-0 text-muted-foreground" />
          ) : !canManage && !isInvitation ? (
            <span className="text-sm text-muted-foreground">—</span>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

