"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Info,
  Search,
  UserPlus,
  Users,
} from "lucide-react";
import { routes } from "@recomenda/config";
import { PageHero } from "@/components/domain/page-hero";
import { EmptyState } from "@recomenda/ui/patterns/empty-state";
import { Button } from "@recomenda/ui/primitives/button";
import { Input } from "@recomenda/ui/primitives/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@recomenda/ui/primitives/tooltip";
import { Select } from "@recomenda/ui/forms/select";
import { Skeleton } from "@recomenda/ui/primitives/skeleton";
import { useTeamOverview } from "@recomenda/api-hooks";
import type { TeamOverviewMember } from "@recomenda/api/consultants";
import { cn } from "@recomenda/utils";

const fmt = (n: number) => n.toLocaleString("pt-BR");
const fmtHa = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

function initials(name: string | null) {
  const parts = (name ?? "?").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function riskLabel(tags: string[], _lastAt: string | null): {
  text: string;
  tone: "critical" | "attention" | "ok";
} {
  if (tags.includes("no_links")) return { text: "sem vínculo", tone: "attention" };
  if (tags.includes("inactive")) return { text: "inativo", tone: "attention" };
  if (tags.includes("possible_duplicate"))
    return { text: "conta duplicada?", tone: "attention" };
  if (tags.length > 0) return { text: `${tags.length} sinais`, tone: "critical" };
  return { text: "sem sinais", tone: "ok" };
}

function RoleBadge({ level }: { level: string }) {
  const isManager = level === "MANAGER";
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        isManager
          ? "bg-primary-soft text-primary-strong"
          : "bg-muted text-muted-foreground",
      )}
    >
      {isManager ? "Gestor" : "Consultor"}
    </span>
  );
}

type Props = {
  canManage: boolean;
  onInvite: () => void;
  pendingInvitesSlot?: ReactNode;
};

export function TeamAuditHome({ canManage, onInvite, pendingInvitesSlot }: Props) {
  const { data, isLoading } = useTeamOverview(canManage);
  const [filter, setFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "MANAGER" | "CONSULTANT">("all");

  const members = data?.members ?? [];
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return members.filter((m) => {
      if (roleFilter !== "all" && m.access_level !== roleFilter) return false;
      if (!q) return true;
      const blob = `${m.name ?? ""} ${m.email ?? ""}`.toLowerCase();
      return blob.includes(q);
    });
  }, [members, filter, roleFilter]);

  if (!canManage) {
    return (
      <EmptyState
        title="Sem permissão para auditar a equipe."
        description="Apenas o agrônomo e gestores com TEAM_MANAGE veem este painel."
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-8">
      <PageHero
        className="mb-2"
        icon={<Users className="size-6" />}
        eyebrow="Organização"
        title="Equipe"
        titleBadge={
          !isLoading ? (
            <span className="text-xs font-medium text-muted-foreground">
              {data?.people_count ?? 0} pessoas · {data?.coverage.total_producers ?? 0}{" "}
              produtores
            </span>
          ) : undefined
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" className="gap-2">
              <Link href={routes.equipe.auditoria()}>
                Trilha de auditoria
                <ArrowUpRight className="size-4" />
              </Link>
            </Button>
            <Button onClick={onInvite} className="gap-2">
              <UserPlus className="size-4" />
              Convidar
            </Button>
          </div>
        }
        stats={[
          {
            label: "Pessoas",
            value: isLoading ? "…" : fmt(data?.people_count ?? 0),
            sub: isLoading
              ? undefined
              : `${data?.managers_count ?? 0} gestor · ${data?.consultants_count ?? 0} consult.`,
          },
          {
            label: "Ações · 30 dias",
            value: isLoading ? "…" : fmt(data?.actions_30d ?? 0),
            sub: isLoading
              ? undefined
              : `média ${data?.avg_actions_per_person ?? 0}/pessoa`,
          },
          {
            label: "Sinais de risco",
            value: isLoading ? "…" : fmt(data?.risk_signals_count ?? 0),
            sub: isLoading
              ? undefined
              : `${data?.critical_signals_count ?? 0} críticos`,
            tone:
              (data?.critical_signals_count ?? 0) > 0 ? ("danger" as const) : undefined,
          },
          {
            label: "Cobertura",
            value: isLoading
              ? "…"
              : `${data?.coverage.with_consultant ?? 0} / ${data?.coverage.total_producers ?? 0}`,
            sub: isLoading
              ? undefined
              : `${Math.max(
                  0,
                  (data?.coverage.total_producers ?? 0) -
                    (data?.coverage.with_consultant ?? 0),
                )} sem vínculo`,
          },
          {
            label: "Contas inativas",
            value: isLoading ? "…" : fmt(data?.inactive_accounts ?? 0),
            sub: "14+ dias",
          },
        ]}
      />

      {(data?.governance_alerts.length ?? 0) > 0 ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-danger" />
            <h2 className="font-display text-base font-semibold text-text-strong">
              Precisa da sua atenção
            </h2>
            <span className="text-sm text-muted-foreground">
              · governança de acesso
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {data!.governance_alerts.map((alert) => (
              <div
                key={`${alert.code}-${alert.user_ids.join(",")}`}
                className="rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <span
                  className={cn(
                    "mb-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                    alert.severity === "critical"
                      ? "bg-danger/15 text-danger-strong"
                      : "bg-warning/20 text-warning-strong",
                  )}
                >
                  {alert.severity === "critical" ? "Crítica" : "Atenção"}
                </span>
                <p className="text-sm font-semibold text-text-strong">{alert.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {alert.detail}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border bg-surface-2 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <h2 className="font-display text-base font-semibold text-text-strong">
            Pessoas com acesso
          </h2>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-[200px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Buscar pessoa…"
                className="h-9 pl-8"
              />
            </div>
            <Select
              value={roleFilter}
              onValueChange={(v) =>
                setRoleFilter(v as "all" | "MANAGER" | "CONSULTANT")
              }
              options={[
                { value: "all", label: "Todos os papéis" },
                { value: "MANAGER", label: "Gestores" },
                { value: "CONSULTANT", label: "Consultores" },
              ]}
              className="h-9 w-full sm:w-44"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="Nenhum membro encontrado."
              description="Ajuste a busca ou convide alguém para a equipe."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border bg-surface-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Pessoa</th>
                  <th className="px-4 py-3">Papel</th>
                  <th className="px-4 py-3">Vínculo</th>
                  <th className="px-4 py-3">Carteira</th>
                  <th className="px-4 py-3">Ações · 30d</th>
                  <th className="px-4 py-3">
                    <span className="inline-flex items-center gap-1">
                      Risco
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-label="O que significa cada status de risco"
                            className="inline-flex text-muted-foreground transition-colors hover:text-foreground"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Info className="size-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          sideOffset={6}
                          className="w-72 text-left text-xs leading-relaxed whitespace-normal"
                        >
                          <p className="mb-1.5 font-semibold">Status de risco</p>
                          <ul className="space-y-1">
                            <li>
                              <strong>sem sinais</strong> — sem alerta de
                              governança.
                            </li>
                            <li>
                              <strong>sem vínculo</strong> — consultor sem
                              produtores compartilhados.
                            </li>
                            <li>
                              <strong>inativo</strong> — sem atividade há 14
                              dias ou mais.
                            </li>
                            <li>
                              <strong>conta duplicada?</strong> — nomes muito
                              parecidos na mesma carteira.
                            </li>
                          </ul>
                        </TooltipContent>
                      </Tooltip>
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <MemberRow key={m.user_id} member={m} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {pendingInvitesSlot}
    </div>
  );
}

function MemberRow({ member }: { member: TeamOverviewMember }) {
  const risk = riskLabel(member.risk_tags, member.last_activity_at);
  const linkLabel =
    member.access_level === "MANAGER"
      ? "Administra a equipe"
      : member.manager_name
        ? `Via ${member.manager_name}`
        : "Direto com você";

  return (
    <tr className="border-b border-border last:border-0 hover:bg-accent/40">
      <td className="px-4 py-3">
        <Link
          href={routes.equipe.membro(member.user_id)}
          className="flex items-center gap-3 min-w-0"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary-strong">
            {initials(member.name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium text-text-strong">
              {member.name ?? "—"}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {member.email ?? "—"}
            </span>
          </span>
        </Link>
      </td>
      <td className="px-4 py-3">
        <RoleBadge level={member.access_level} />
      </td>
      <td className="px-4 py-3 text-muted-foreground">{linkLabel}</td>
      <td className="px-4 py-3">
        <span className="block font-medium tabular-nums">
          {fmt(member.producer_count)} produtores
        </span>
        <span className="block text-xs text-muted-foreground tabular-nums">
          {fmt(member.farm_count)} fazendas
          {member.hectares > 0 ? ` · ${fmtHa(member.hectares)} ha` : ""}
        </span>
      </td>
      <td className="px-4 py-3 font-medium tabular-nums">{fmt(member.actions_30d)}</td>
      <td className="px-4 py-3">
        <span
          className={cn(
            "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
            risk.tone === "critical" && "bg-danger/15 text-danger-strong",
            risk.tone === "attention" && "bg-warning/20 text-warning-strong",
            risk.tone === "ok" && "bg-primary-soft text-primary-strong",
          )}
        >
          {risk.text}
        </span>
      </td>
    </tr>
  );
}
