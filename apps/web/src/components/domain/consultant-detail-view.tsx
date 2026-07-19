"use client";

import { routes } from "@recomenda/config";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  Check,
  Info,
  Loader2,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { BreadcrumbBack } from "@/components/domain/breadcrumb-back";
import { PageHero } from "@/components/domain/page-hero";
import { Button } from "@recomenda/ui/button";
import { ConfirmDialog } from "@recomenda/ui/confirm-dialog";
import { Input } from "@recomenda/ui/input";
import { Skeleton } from "@recomenda/ui/skeleton";
import {
  useConsultantActivity,
  useConsultantSummary,
  useConsultants,
  useMemberProducerActions,
  useShareableProducers,
  useRemoveConsultant,
} from "@recomenda/api-hooks";
import { apiErrorMessage } from "@recomenda/api/api-error";
import { useCan } from "@recomenda/api-hooks/use-can";
import { cn } from "@recomenda/utils";

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

/**
 * Detalhe do membro de equipe: checklist de produtores compartilhados,
 * stats e feed de ações.
 */
export function ConsultantDetailView({ userId }: { userId: string }) {
  const router = useRouter();
  const canManage = useCan("TEAM_MANAGE");
  const { data: summary, isLoading: summaryLoading, isError } = useConsultantSummary(userId);
  const { data: activity, isLoading: activityLoading } = useConsultantActivity(userId);
  const { data: shareable } = useShareableProducers(canManage);
  const { data: team } = useConsultants();
  const { grant, revoke } = useMemberProducerActions(userId);
  const removeMutation = useRemoveConsultant();

  const [confirmRemove, setConfirmRemove] = useState(false);
  const [producerFilter, setProducerFilter] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const isManager = summary?.access_level === "MANAGER";
  const roleLabel = isManager ? "Gestor" : "Consultor";

  const sharedIds = useMemo(
    () => new Set((summary?.producers ?? []).map((p) => p.id)),
    [summary?.producers],
  );

  const allProducers = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const p of shareable ?? []) map.set(p.id, p);
    for (const p of summary?.producers ?? []) map.set(p.id, p);
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [shareable, summary?.producers]);

  const filteredProducers = useMemo(() => {
    const q = producerFilter.trim().toLowerCase();
    if (!q) return allProducers;
    return allProducers.filter((p) => p.name.toLowerCase().includes(q));
  }, [allProducers, producerFilter]);

  const linkedAssistants = useMemo(() => {
    if (!isManager || !team) return [];
    return (team.assistants ?? []).filter((a) => a.manager_user_id === userId);
  }, [isManager, team, userId]);

  const toggleProducer = async (producerId: string) => {
    if (!canManage || togglingId) return;
    const on = sharedIds.has(producerId);
    setTogglingId(producerId);
    try {
      if (on) await revoke.mutateAsync(producerId);
      else await grant.mutateAsync(producerId);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Não foi possível atualizar o compartilhamento."));
    } finally {
      setTogglingId(null);
    }
  };

  const confirmRemoveMember = async () => {
    try {
      await removeMutation.mutateAsync(userId);
      toast.success(`${roleLabel} removido.`);
      router.push(routes.equipe.lista);
    } catch (e) {
      toast.error(apiErrorMessage(e, `Não foi possível remover o ${roleLabel.toLowerCase()}.`));
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

  const initial = (summary.name ?? "?").trim().charAt(0).toUpperCase();
  const selectedCount = sharedIds.size;
  const totalCount = allProducers.length;

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-6">
      <BreadcrumbBack
        items={[
          { label: "Equipe", href: routes.equipe.lista },
          { label: summary.name ?? roleLabel },
        ]}
      />

      <PageHero
        className="mb-6"
        icon={<span className="text-xl font-semibold">{initial}</span>}
        eyebrow={roleLabel}
        title={summary.name ?? roleLabel}
        titleBadge={
          !isManager ? (
            summary.manager_user_id && summary.manager_name ? (
              <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary-strong">
                via {summary.manager_name}
              </span>
            ) : (
              <span className="rounded-full bg-clay-soft px-2.5 py-0.5 text-xs font-medium text-clay-strong">
                direto com você
              </span>
            )
          ) : null
        }
        actions={
          canManage ? (
            <Button
              variant="outline"
              className="gap-2 border-danger-border text-danger-strong hover:bg-danger-soft hover:text-danger-strong"
              onClick={() => setConfirmRemove(true)}
            >
              <Trash2 className="size-4" />
              Remover {roleLabel.toLowerCase()}
            </Button>
          ) : undefined
        }
        stats={[
          { label: "E-mail", value: summary.email ?? "—" },
          ...(summary.created_at
            ? [{ label: "Desde", value: fmtDate(summary.created_at) }]
            : []),
          ...(isManager
            ? [{ label: "Consultores", value: summary.assistant_count ?? 0 }]
            : []),
          { label: "Produtores", value: summary.producers.length },
          { label: "Ações · 30 dias", value: summary.activity_count_30d },
          {
            label: "Última ação",
            value: summary.last_activity_at ? fmtDate(summary.last_activity_at) : "—",
          },
        ]}
      />

      {!isManager ? (
        <div className="flex gap-3 rounded-2xl border border-[#D9E6DD] bg-[#F2F7F3] px-5 py-4">
          <Info className="mt-0.5 size-5 shrink-0 text-[#1E6B4A]" />
          <p className="text-sm text-[#2B2723]">
            Consultores têm acesso somente-leitura: veem os produtores e fazendas
            compartilhados e podem apenas registrar aplicações das recomendações (e trocar
            produto/dose na etapa).
          </p>
        </div>
      ) : null}

      {isManager && linkedAssistants.length > 0 ? (
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Users className="size-5 text-[#1E6B4A]" />
            <div>
              <h2 className="text-base font-extrabold text-[#2B2723]">
                Consultores deste gestor
              </h2>
              <p className="text-xs text-[#8A857D]">
                Criados e gerenciados por {(summary.name ?? "").split(" ")[0] || "este gestor"}.
              </p>
            </div>
          </div>
          <ul className="flex flex-col gap-2">
            {linkedAssistants.map((a) => (
              <li key={a.user_id}>
                <Link
                  href={routes.equipe.membro(a.user_id)}
                  className="flex items-center justify-between rounded-xl bg-[#F7F5F1] px-4 py-3 transition hover:bg-[#EFEBE4]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#2B2723]">
                      {a.name ?? "Consultor"}
                    </p>
                    <p className="truncate text-xs text-[#8A857D]">{a.email ?? "—"}</p>
                  </div>
                  <span className="text-sm font-bold text-[#1E6B4A]">abrir</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {canManage ? (
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-[#2B2723]">
                Produtores compartilhados
              </h2>
              <p className="text-xs text-[#8A857D]">
                {selectedCount} de {totalCount} selecionados
              </p>
            </div>
            <div className="relative w-full max-w-[260px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#A39D93]" />
              <Input
                value={producerFilter}
                onChange={(e) => setProducerFilter(e.target.value)}
                placeholder="Buscar produtor…"
                className="rounded-xl border-[#E3DFD8] pl-9"
              />
            </div>
          </div>
          {allProducers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum produtor disponível para compartilhar.
            </p>
          ) : (
            <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProducers.map((p) => {
                const on = sharedIds.has(p.id);
                const busy = togglingId === p.id;
                return (
                  <li key={p.id}>
                    <div
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition",
                        on
                          ? "border-[#BFD7C8] bg-[#F2F7F3]"
                          : "border-transparent bg-[#F7F5F1]",
                      )}
                    >
                      <button
                        type="button"
                        disabled={busy || grant.isPending || revoke.isPending}
                        onClick={() => toggleProducer(p.id)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left hover:opacity-90"
                      >
                        <span
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border-2",
                            on ? "border-[#1E6B4A] bg-[#1E6B4A]" : "border-[#C9C4BB] bg-white",
                          )}
                        >
                          {busy ? (
                            <Loader2 className="size-3 animate-spin text-white" />
                          ) : on ? (
                            <Check className="size-3 text-white" strokeWidth={3} />
                          ) : null}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#2B2723]">
                          {p.name}
                        </span>
                      </button>
                      {on ? (
                        <Link
                          href={routes.produtores.detalhe(p.id)}
                          className="shrink-0 text-xs font-bold text-[#1E6B4A] hover:underline"
                        >
                          abrir
                        </Link>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-base font-extrabold text-[#2B2723]">
            Produtores que {isManager ? "ele gerencia" : "ele atende"}
          </h2>
          {summary.producers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum produtor compartilhado ainda.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {summary.producers.map((p) => (
                <li key={p.id}>
                  <Link
                    href={routes.produtores.detalhe(p.id)}
                    className="flex items-center justify-between rounded-xl bg-[#F7F5F1] px-4 py-3 transition hover:bg-[#EFEBE4]"
                  >
                    <span className="text-sm font-medium text-[#2B2723]">{p.name}</span>
                    <span className="text-sm font-bold text-[#1E6B4A]">abrir</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="size-4 text-[#1E6B4A]" />
            <h2 className="text-base font-extrabold text-[#2B2723]">Últimas ações</h2>
          </div>
          {activityLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : !activity || activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma ação registrada ainda. Os registros de aplicação aparecem aqui.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {activity.slice(0, 20).map((row) => (
                <li key={row.id} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#1E6B4A]" />
                  <div className="min-w-0">
                    <p className="text-sm text-[#2B2723]">{row.summary}</p>
                    <p className="text-xs text-[#8A857D]">{fmtDateTime(row.created_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={`Remover ${roleLabel.toLowerCase()}?`}
        description={
          summary.name
            ? `${summary.name} perderá o acesso e o login será desativado.`
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
