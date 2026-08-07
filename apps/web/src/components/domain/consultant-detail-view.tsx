"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  Link2,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { routes } from "@recomenda/config";
import { BreadcrumbBack } from "@/components/domain/breadcrumb-back";
import { ManageMemberLinksDialog } from "@/components/domain/manage-member-links-dialog";
import { PageHero } from "@/components/domain/page-hero";
import { Button } from "@recomenda/ui/primitives/button";
import { ConfirmDialog } from "@recomenda/ui/patterns/confirm-dialog";
import { EmptyState } from "@recomenda/ui/patterns/empty-state";
import { Skeleton } from "@recomenda/ui/primitives/skeleton";
import {
  useConsultantActivity,
  useConsultantSummary,
  useConsultants,
  useRemoveConsultant,
} from "@recomenda/api-hooks";
import { apiErrorMessage } from "@recomenda/api/api-error";
import { useCan } from "@recomenda/api-hooks/use-can";
import { cn } from "@recomenda/utils";

const fmt = (n: number) => n.toLocaleString("pt-BR");
const fmtHa = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

function initials(name: string | null) {
  const parts = (name ?? "?").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function severityTone(severity?: string) {
  if (severity === "critical") return "bg-danger/15 text-danger-strong";
  if (severity === "attention") return "bg-warning/20 text-warning-strong";
  return "bg-muted text-muted-foreground";
}

/**
 * Detalhe do membro de equipe: vínculos, consultores subordinados e trilha.
 */
export function ConsultantDetailView({ userId }: { userId: string }) {
  const router = useRouter();
  const canManage = useCan("TEAM_MANAGE");
  const { data: summary, isLoading: summaryLoading, isError } =
    useConsultantSummary(userId);
  const { data: activity, isLoading: activityLoading } =
    useConsultantActivity(userId);
  const { data: team } = useConsultants();
  const removeMutation = useRemoveConsultant();

  const [confirmRemove, setConfirmRemove] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);

  const isManager = summary?.access_level === "MANAGER";
  const roleLabel = isManager ? "Gestor" : "Consultor";

  const linkedAssistants = useMemo(() => {
    if (!isManager || !team) return [];
    return (team.assistants ?? []).filter((a) => a.manager_user_id === userId);
  }, [isManager, team, userId]);

  const confirmRemoveMember = async () => {
    try {
      await removeMutation.mutateAsync(userId);
      toast.success(`${roleLabel} removido.`);
      router.push(routes.equipe.lista);
    } catch (e) {
      toast.error(
        apiErrorMessage(e, `Não foi possível remover o ${roleLabel.toLowerCase()}.`),
      );
    }
  };

  if (summaryLoading) {
    return (
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !summary) {
    return (
      <div className="mx-auto max-w-[1240px]">
        <BreadcrumbBack items={[{ label: "Equipe", href: routes.equipe.lista }]} />
        <p className="mt-6 text-sm text-muted-foreground">
          Membro não encontrado ou sem permissão para visualizar.
        </p>
      </div>
    );
  }

  const farmCount = summary.farm_count ?? 0;
  const hectares = summary.hectares ?? 0;
  const createdCount = summary.created_producers_count ?? 0;
  const firstName = (summary.name ?? roleLabel).trim().split(/\s+/)[0] || roleLabel;

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-6">
      <BreadcrumbBack
        items={[
          { label: "Equipe", href: routes.equipe.lista },
          { label: summary.name ?? roleLabel },
        ]}
      />

      <PageHero
        className="mb-2"
        icon={
          <span className="text-sm font-bold">{initials(summary.name)}</span>
        }
        eyebrow={roleLabel}
        title={summary.name ?? roleLabel}
        titleBadge={
          <div className="flex flex-wrap items-center gap-2">
            {!isManager ? (
              summary.manager_user_id && summary.manager_name ? (
                <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary-strong">
                  via {summary.manager_name}
                </span>
              ) : (
                <span className="rounded-full bg-clay-soft px-2.5 py-0.5 text-xs font-medium text-clay-strong">
                  direto com você
                </span>
              )
            ) : (
              <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary-strong">
                Administra a equipe
              </span>
            )}
            {summary.email ? (
              <span className="text-xs text-muted-foreground">{summary.email}</span>
            ) : null}
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" className="gap-2">
              <Link href={routes.equipe.auditoria({ actor: userId })}>
                Ver trilha
                <ArrowUpRight className="size-4" />
              </Link>
            </Button>
            {canManage ? (
              <Button
                variant="outline"
                className="gap-2 border-danger-border text-danger-strong hover:bg-danger-soft hover:text-danger-strong"
                onClick={() => setConfirmRemove(true)}
              >
                <Trash2 className="size-4" />
                Remover
              </Button>
            ) : null}
          </div>
        }
        stats={[
          { label: "Ações · 30 dias", value: fmt(summary.activity_count_30d) },
          {
            label: "Carteira",
            value: `${fmt(summary.producers.length)} prod.`,
            sub:
              farmCount > 0
                ? `${fmt(farmCount)} faz.${hectares > 0 ? ` · ${fmtHa(hectares)} ha` : ""}`
                : undefined,
          },
          {
            label: "Última atividade",
            value: summary.last_activity_at
              ? fmtDate(summary.last_activity_at)
              : "—",
          },
          ...(summary.created_at
            ? [{ label: "Desde", value: fmtDate(summary.created_at) }]
            : []),
          ...(isManager
            ? [{ label: "Consultores", value: fmt(summary.assistant_count ?? 0) }]
            : []),
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-2 px-4 py-3">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-primary" />
              <h2 className="font-display text-base font-semibold text-text-strong">
                Trilha recente
              </h2>
            </div>
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <Link href={routes.equipe.auditoria({ actor: userId })}>
                Ver completa
                <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          </div>
          <div className="p-4">
            {activityLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : !activity || activity.length === 0 ? (
              <EmptyState
                title="Nenhuma ação registrada ainda."
                description="Aplicações, ajustes e alterações de acesso aparecem aqui."
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {activity.slice(0, 12).map((row) => (
                  <li
                    key={row.id}
                    className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-text-strong">{row.summary}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {fmtDateTime(row.created_at)}
                        {row.producer_name || row.farm_name
                          ? ` · ${[row.producer_name, row.farm_name].filter(Boolean).join(" · ")}`
                          : ""}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                        severityTone(row.severity),
                      )}
                    >
                      {row.severity === "critical"
                        ? "Crítica"
                        : row.severity === "attention"
                          ? "Atenção"
                          : "Rotina"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <div className="flex flex-col gap-6">
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Link2 className="size-4 text-primary" />
                <h2 className="font-display text-base font-semibold text-text-strong">
                  Vínculos
                </h2>
              </div>
              {canManage ? (
                <Button size="sm" variant="outline" onClick={() => setLinksOpen(true)}>
                  Gerenciar
                </Button>
              ) : null}
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              {summary.producers.length} produtor
              {summary.producers.length === 1 ? "" : "es"}
              {createdCount > 0
                ? ` · ${createdCount} ${firstName} gerencia diretamente`
                : ""}
            </p>
            {summary.producers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum produtor compartilhado ainda.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {summary.producers.slice(0, 12).map((p) => (
                  <li key={p.id}>
                    <Link
                      href={routes.produtores.detalhe(p.id)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs font-medium text-text-strong hover:border-primary/40 hover:bg-primary-soft/50"
                    >
                      {p.name}
                      {typeof p.farm_count === "number" ? (
                        <span className="text-muted-foreground">
                          · {p.farm_count} faz.
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
                {summary.producers.length > 12 ? (
                  <li className="text-xs text-muted-foreground self-center">
                    +{summary.producers.length - 12} mais
                  </li>
                ) : null}
              </ul>
            )}
          </section>

          {isManager ? (
            <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <Users className="size-4 text-primary" />
                <h2 className="font-display text-base font-semibold text-text-strong">
                  Consultores deste gestor
                </h2>
              </div>
              {linkedAssistants.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum consultor vinculado a {firstName}.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {linkedAssistants.map((a) => (
                    <li key={a.user_id}>
                      <Link
                        href={routes.equipe.membro(a.user_id)}
                        className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2.5 transition hover:bg-hover"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-text-strong">
                            {a.name ?? "Consultor"}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {a.email ?? "—"}
                          </span>
                        </span>
                        <span className="text-xs font-semibold text-primary">abrir</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </div>
      </div>

      {canManage ? (
        <ManageMemberLinksDialog
          open={linksOpen}
          onOpenChange={setLinksOpen}
          userId={userId}
          memberName={summary.name}
          linkedProducers={summary.producers}
        />
      ) : null}

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={`Remover ${roleLabel.toLowerCase()}?`}
        description={
          summary.name
            ? `${summary.name} será removido definitivamente. O acesso acaba e o e-mail fica livre para um novo convite.`
            : undefined
        }
        tone="destructive"
        confirmLabel="Remover"
        loading={removeMutation.isPending}
        onConfirm={confirmRemoveMember}
      />
    </div>
  );
}
