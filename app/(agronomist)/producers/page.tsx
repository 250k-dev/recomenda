"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { useProducers, useSetProducerActive, useDeleteProducer, useRevokeInvitation } from "@/lib/api/hooks";
import { TableRowsSkeleton } from "@/components/domain/page-skeletons";
import type { AgronomistProducerListRow } from "@/lib/api/client";
import { ProducerAccountStatusBadge } from "@/components/domain/producer-account-status-badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Eye,
  Plus,
  UsersRound,
  Search,
  ArrowDownUp,
  Users as UsersIcon,
  Sprout,
  Archive,
  RotateCcw,
  Trash2,
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

function apiErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const payload = error.response?.data as { error?: { message?: string }; message?: string } | undefined;
    return payload?.error?.message ?? payload?.message ?? fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

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
      {/* Header estilo Plano de Custo */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <UsersRound className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Produtores
            </h1>
            <p className="max-w-2xl text-xs text-muted-foreground">
              Contas vinculadas a você e convites pendentes. O status indica conta ativa,
              inativa ou convite enviado/expirado.
            </p>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        <KpiBox
          label="Total de produtores"
          value={fmt(totalProducers)}
          accent="primary"
          icon={<UsersIcon className="h-4 w-4" />}
        />
        <KpiBox
          label="Hectares totais"
          value={`${fmtHa(totalHectares)} ha`}
          sub="soma da carteira"
          accent="sun"
          icon={<Sprout className="h-4 w-4" />}
        />
      </div>

      {/* Tabs */}
      <div className="flex w-fit rounded-full border bg-card p-0.5 text-xs font-medium shadow-sm">
        <button
          type="button"
          onClick={() => {
            setTab("active");
            setFilter("");
          }}
          className={
            tab === "active"
              ? "rounded-full bg-primary px-3 py-1 text-primary-foreground"
              : "rounded-full px-3 py-1 text-muted-foreground hover:text-foreground"
          }
        >
          Ativos
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("archived");
            setFilter("");
          }}
          className={
            tab === "archived"
              ? "rounded-full bg-primary px-3 py-1 text-primary-foreground"
              : "rounded-full px-3 py-1 text-muted-foreground hover:text-foreground"
          }
        >
          Removidos
          {archivedList.length > 0 ? (
            <span
              className={cn(
                "ml-1.5 rounded-full px-1.5 text-[10px]",
                tab === "archived" ? "bg-primary-foreground/20" : "bg-muted",
              )}
            >
              {archivedList.length}
            </span>
          ) : null}
        </button>
      </div>

      {/* Tabela polida (estilo Plano de Custo) */}
      {isLoading ? (
        <TableRowsSkeleton rows={8} columns={5} />
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UsersRound className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {tab === "active"
                  ? "Nenhum produtor ou convite na lista ativa."
                  : "Nenhum produtor removido."}
              </p>
              {tab === "active" ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Cadastre o primeiro produtor para começar.
                </p>
              ) : null}
            </div>
            {tab === "active" ? (
              <Link href="/producers/new">
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Adicionar produtor
                </Button>
              </Link>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-3">
            <div className="relative min-w-0 flex-1 sm:max-w-md">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filtrar por nome, e-mail ou ID…"
                className="h-9 pl-8"
              />
            </div>
            <div className="flex items-center gap-1.5 rounded-md border bg-card pl-2 pr-1 text-xs">
              <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortMode)}
                className="h-8 border-0 bg-transparent pr-2 text-xs outline-none"
              >
                <option value="name">Ordenar: Nome</option>
                <option value="hectares-desc">Ordenar: Hectares ↓</option>
                <option value="hectares-asc">Ordenar: Hectares ↑</option>
              </select>
            </div>
            {tab === "active" && (
              <Link href="/producers/new" className="ml-auto shrink-0">
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Adicionar produtor
                </Button>
              </Link>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2.5">Produtor</th>
                <th className="px-2 py-2.5">E-mail</th>
                <th className="px-2 py-2.5 text-right">Hectares</th>
                <th className="w-12 px-2 py-2.5" />
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
        </div>
      )}

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
  return (
    <tr className="border-b last:border-b-0 transition-colors hover:bg-accent/40">
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
              isInvitation
                ? "bg-muted text-muted-foreground"
                : "bg-primary/10 text-primary",
            )}
          >
            {initial}
          </div>
          <span className="text-sm font-medium text-foreground">{producer.name}</span>
        </div>
      </td>
      <td className="px-2 py-2.5 text-muted-foreground">{producer.email}</td>
      <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">
        {producer.total_hectares != null ? `${fmtHa(producer.total_hectares)} ha` : "—"}
      </td>
      <td className="px-2 py-2.5 text-right">
        <div className="flex items-center justify-end gap-1">
          {producer.producer_id ? (
            <Button
              variant="ghost"
              size="icon"
              title="Ver detalhes"
              onClick={onOpen}
              className="text-muted-foreground hover:text-primary"
            >
              <Eye className="h-4 w-4" />
            </Button>
          ) : null}
          {canManage && tab === "active" ? (
            <Button
              variant="ghost"
              size="icon"
              title="Remover produtor"
              onClick={onArchive}
              disabled={actionPending}
              className="text-muted-foreground hover:text-destructive"
            >
              <Archive className="h-4 w-4" />
            </Button>
          ) : null}
          {canManage && tab === "archived" ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                title="Reativar produtor"
                onClick={onReactivate}
                disabled={actionPending}
                className="text-muted-foreground hover:text-primary"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                title="Excluir definitivamente"
                onClick={onDelete}
                disabled={actionPending}
                className={cn(deactivateOutlineButtonClass, "h-8 w-8")}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          ) : null}
          {isInvitation && producer.invitation_id ? (
            <Button
              variant="ghost"
              size="icon"
              title="Cancelar convite"
              onClick={onRevokeInvitation}
              disabled={actionPending}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : !canManage && !producer.producer_id ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function KpiBox({
  label,
  value,
  sub,
  accent,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: "primary" | "sky" | "sun" | "clay";
  icon: React.ReactNode;
}) {
  const accentClasses = {
    primary: "bg-primary/10 text-primary",
    sky: "bg-sky-soft text-sky",
    sun: "bg-sun-soft text-sun",
    clay: "bg-clay-soft text-clay",
  } as const;
  return (
    <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-md",
            accentClasses[accent],
          )}
        >
          {icon}
        </span>
        {label}
      </div>
      <p className="mt-1.5 text-2xl font-semibold leading-tight tabular-nums tracking-tight text-foreground">
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
