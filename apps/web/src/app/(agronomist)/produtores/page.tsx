"use client";

import { routes } from "@recomenda/config";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "sonner";
import { useProducers, useSetProducerActive, useDeleteProducer, useRevokeInvitation } from "@/lib/api/hooks";
import { apiErrorMessage } from "@recomenda/api/api-error";
import { BreadcrumbBack } from "@/components/domain/breadcrumb-back";
import { PageHero } from "@/components/domain/page-hero";
import { ProducerAttentionBadge } from "@/components/domain/producer-attention-badge";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { SegmentedTabs } from "@/components/domain/segmented-tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { TableRowsSkeleton } from "@/components/domain/page-skeletons";
import type { AgronomistProducerListRow } from "@recomenda/api";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Plus,
  UsersRound,
  Search,
  ArrowDownUp,
  Archive,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { cn, deactivateOutlineButtonClass } from "@recomenda/utils";
import { useCan, usePrincipal } from "@/lib/auth/use-can";

type Tab = "active" | "archived";
type SortMode = "name" | "hectares-desc" | "hectares-asc";

const PRODUCERS_PAGE_SIZE = 5;

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
  const canCreateProducer = useCan("PRODUCER_CREATE");
  const canDeleteProducer = useCan("PRODUCER_DELETE");
  const canEditProducer = useCan("PRODUCER_EDIT");
  const { id: meId, role } = usePrincipal();
  const [tab, setTab] = useState<Tab>("active");
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<SortMode>("name");
  const [page, setPage] = useState(1);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  // Volta à página 1 quando muda o tab/filtro/ordenação. Ajuste durante o render
  // (padrão recomendado do React — https://react.dev/learn/you-might-not-need-an-effect)
  // em vez de setState dentro de um useEffect.
  const resetKey = `${tab}|${filter}|${sort}`;
  const [trackedResetKey, setTrackedResetKey] = useState(resetKey);
  if (resetKey !== trackedResetKey) {
    setTrackedResetKey(resetKey);
    setPage(1);
  }

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PRODUCERS_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const paginated = filtered.slice(
    (safePage - 1) * PRODUCERS_PAGE_SIZE,
    safePage * PRODUCERS_PAGE_SIZE,
  );

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
        <BreadcrumbBack items={[{ label: "Produtores" }]} />
        <PageHero
          className="mb-6"
          icon={<UsersRound className="size-6" />}
          eyebrow="Carteira"
          title="Produtores"
          actions={
            canCreateProducer ? (
              <Button asChild variant="clay">
                <Link href={routes.produtores.novo}>
                  <Plus className="h-4 w-4" />
                  Cadastrar produtor
                </Link>
              </Button>
            ) : undefined
          }
          stats={[
            { label: "Produtores", value: fmt(totalProducers) },
            { label: "Hectares totais", value: `${fmtHa(totalHectares)} ha` },
          ]}
        />
      </div>

      {/* Lista */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {/* Toolbar: abas + filtros */}
        <div className="flex flex-col gap-3 border-b border-border bg-surface-2 px-3 py-3 md:flex-row md:items-center">
          <SegmentedTabs
            value={tab}
            onValueChange={(v) => { setTab(v); setFilter(""); }}
            items={[
              { value: "active", label: "Ativos" },
              { value: "archived", label: "Removidos", badgeCount: archivedList.length },
            ]}
            className="shrink-0"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filtrar por nome, e-mail ou ID…"
                className="h-10 pl-9"
              />
            </div>
            <div className="flex h-10 w-full shrink-0 items-center gap-1.5 rounded-lg border border-input bg-card pl-2.5 pr-1 sm:w-auto">
              <ArrowDownUp className="size-4 shrink-0 text-muted-foreground" />
              <Select
                value={sort}
                onValueChange={(value) => setSort(value as SortMode)}
                size="sm"
                className="w-auto min-w-44 shrink-0 [&>button]:h-8 [&>button]:border-0 [&>button]:bg-transparent [&>button]:px-1 [&>button]:shadow-none [&>button_span]:whitespace-nowrap"
                options={[
                  { value: "name", label: "Ordenar: Nome" },
                  { value: "hectares-desc", label: "Ordenar: Hectares ↓" },
                  { value: "hectares-asc", label: "Ordenar: Hectares ↑" },
                ]}
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="p-3">
            <TableRowsSkeleton rows={5} columns={6} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            variant="inline"
            icon={UsersRound}
            title={tab === "active" ? "Nenhum produtor ou convite na lista ativa." : "Nenhum produtor removido."}
            description={tab === "active" ? "Cadastre o primeiro produtor para começar." : undefined}
            action={
              tab === "active" ? (
                <Link href={routes.produtores.novo}>
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
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2 text-left text-[0.72rem] font-bold uppercase tracking-[0.07em] text-muted-foreground">
                    <th className="px-4 py-3.5">Produtor</th>
                    <th className="px-2 py-3.5 text-center">Fazendas</th>
                    <th className="px-2 py-3.5 text-center">Talhões</th>
                    <th className="px-2 py-3.5 text-center">Safras ativas</th>
                    <th className="px-2 py-3.5">Atenção</th>
                    <th className="w-24 px-2 py-3.5" />
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((p) => {
                    // Gestor só arquiva/exclui o que criou; agrônomo faz tudo; consultor nada.
                    const owns =
                      role !== "STAFF" ||
                      (p.created_by_user_id != null && p.created_by_user_id === meId);
                    return (
                    <ProducerRow
                      key={rowKey(p)}
                      producer={p}
                      tab={tab}
                      actionPending={actionPending}
                      canArchive={canEditProducer && owns}
                      canHardDelete={canDeleteProducer && owns}
                      onOpen={() =>
                        p.producer_id ? router.push(routes.produtores.detalhe(p.producer_id)) : null
                      }
                      onArchive={() => p.producer_id && onArchive(p.producer_id, p.name)}
                      onReactivate={() => p.producer_id && onReactivate(p.producer_id)}
                      onDelete={() => p.producer_id && onDelete(p.producer_id, p.name)}
                      onRevokeInvitation={() => p.invitation_id && onRevokeInvitation(p.invitation_id, p.name)}
                    />
                    );
                  })}
                </tbody>
              </table>
            </div>
            <PaginationBar
              page={safePage}
              pageSize={PRODUCERS_PAGE_SIZE}
              total={filtered.length}
              onPageChange={setPage}
            />
          </>
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
  canArchive = true,
  canHardDelete = true,
  onOpen,
  onArchive,
  onReactivate,
  onDelete,
  onRevokeInvitation,
}: {
  producer: AgronomistProducerListRow;
  tab: Tab;
  actionPending: boolean;
  canArchive?: boolean;
  canHardDelete?: boolean;
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
      <td className="px-2 py-3 text-center tabular-nums text-text-strong">
        {producer.farms_count ?? "—"}
      </td>
      <td className="px-2 py-3 text-center tabular-nums text-text-strong">
        {producer.plots_count ?? "—"}
      </td>
      <td className="px-2 py-3 text-center tabular-nums text-text-strong">
        {producer.active_cycles_count ?? "—"}
      </td>
      <td className="px-2 py-3">
        {producer.row_type === "producer" ? (
          <ProducerAttentionBadge
            lateCount={producer.attention_late_count ?? 0}
            todayCount={producer.attention_today_count ?? 0}
          />
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-2 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          {canManage && tab === "active" && canArchive ? (
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
          {canManage && tab === "archived" && (canArchive || canHardDelete) ? (
            <>
              {canArchive ? (
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
              ) : null}
              {canHardDelete ? (
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
              ) : null}
            </>
          ) : null}
          {isInvitation && producer.invitation_id && canArchive ? (
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
        </div>
      </td>
    </tr>
  );
}

