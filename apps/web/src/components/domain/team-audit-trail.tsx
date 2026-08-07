"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Download, Search } from "lucide-react";
import { routes } from "@recomenda/config";
import { BreadcrumbBack } from "@/components/domain/breadcrumb-back";
import { PageHero } from "@/components/domain/page-hero";
import { EmptyState } from "@recomenda/ui/patterns/empty-state";
import { Button } from "@recomenda/ui/primitives/button";
import { Input } from "@recomenda/ui/primitives/input";
import { Select } from "@recomenda/ui/forms/select";
import { Skeleton } from "@recomenda/ui/primitives/skeleton";
import { useConsultants, useWalletActivity } from "@recomenda/api-hooks";
import { useCan } from "@recomenda/api-hooks/use-can";
import type { WalletActivityQuery } from "@recomenda/api/consultants";
import { cn } from "@recomenda/utils";

const PAGE_SIZE = 25;

const CATEGORY_OPTIONS = [
  { value: "all", label: "Todas as categorias" },
  { value: "Compras", label: "Compras", entity: "purchase" },
  { value: "Programação", label: "Programação", entity: "cycle" },
  { value: "Estoque", label: "Estoque", entity: "stock" },
  { value: "Aplicação", label: "Aplicação", entity: "application" },
  { value: "Acesso", label: "Acesso", entity: "access" },
  { value: "Outros", label: "Outros", entity: "" },
] as const;

const PERIOD_OPTIONS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "all", label: "Todo o período" },
] as const;

function daysAgoIso(days: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function severityLabel(severity?: string) {
  if (severity === "critical") return "Crítica";
  if (severity === "attention") return "Atenção";
  return "Rotina";
}

function severityTone(severity?: string) {
  if (severity === "critical") return "bg-danger/15 text-danger-strong";
  if (severity === "attention") return "bg-warning/20 text-warning-strong";
  return "bg-muted text-muted-foreground";
}

function csvEscape(value: string) {
  if (/[",\n;]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function TeamAuditTrail() {
  const canManage = useCan("TEAM_MANAGE");
  const searchParams = useSearchParams();
  const actorFromUrl = searchParams.get("actor") ?? "";

  const [period, setPeriod] = useState<string>("30");
  const [actor, setActor] = useState(actorFromUrl);
  const [category, setCategory] = useState("all");
  const [q, setQ] = useState("");
  const [qApplied, setQApplied] = useState("");
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    setActor(actorFromUrl);
    setOffset(0);
  }, [actorFromUrl]);

  const { data: team } = useConsultants();

  const peopleOptions = useMemo(() => {
    const rows = [
      ...(team?.managers ?? []),
      ...(team?.assistants ?? []),
    ];
    return [
      { value: "all", label: "Todas as pessoas" },
      ...rows
        .map((m) => ({
          value: m.user_id,
          label: m.name ?? m.email ?? m.user_id,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
    ];
  }, [team]);

  const query: WalletActivityQuery = useMemo(() => {
    const entityOpt = CATEGORY_OPTIONS.find((c) => c.value === category);
    const entityType =
      entityOpt && "entity" in entityOpt && entityOpt.entity
        ? entityOpt.entity
        : undefined;
    return {
      from: period === "all" ? undefined : daysAgoIso(Number(period)),
      actor_user_id: actor && actor !== "all" ? actor : undefined,
      entity_type: entityType,
      q: qApplied || undefined,
      limit: PAGE_SIZE,
      offset,
    };
  }, [period, actor, category, qApplied, offset]);

  const { data, isLoading, isFetching } = useWalletActivity(query, canManage);

  const items = useMemo(() => {
    const rows = data?.items ?? [];
    if (category === "Outros") {
      return rows.filter((r) => (r.category ?? "Outros") === "Outros");
    }
    if (category !== "all") {
      return rows.filter((r) => (r.category ?? "Outros") === category);
    }
    return rows;
  }, [data?.items, category]);

  const total = data?.total ?? 0;
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const exportCsv = () => {
    const header = [
      "Quando",
      "Quem",
      "Papel",
      "O que",
      "Produtor",
      "Fazenda",
      "Categoria",
      "Severidade",
    ];
    const lines = [
      header.join(";"),
      ...items.map((r) =>
        [
          fmtDateTime(r.created_at),
          r.actor_name ?? "",
          r.actor_role ?? "",
          r.summary,
          r.producer_name ?? "",
          r.farm_name ?? "",
          r.category ?? "",
          severityLabel(r.severity),
        ]
          .map((c) => csvEscape(String(c)))
          .join(";"),
      ),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trilha-equipe-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!canManage) {
    return (
      <div className="mx-auto max-w-[1240px]">
        <BreadcrumbBack items={[{ label: "Equipe", href: routes.equipe.lista }]} />
        <EmptyState
          title="Sem permissão para a trilha."
          description="Apenas quem gerencia a equipe pode auditar as ações da carteira."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-6">
      <BreadcrumbBack items={[{ label: "Equipe", href: routes.equipe.lista }]} />

      <PageHero
        className="mb-2"
        icon={<Search className="size-6" />}
        eyebrow="Governança"
        title="Trilha de auditoria"
        titleBadge={
          <span className="text-xs text-muted-foreground">
            {isLoading ? "…" : `${total.toLocaleString("pt-BR")} eventos`}
          </span>
        }
        actions={
          <Button
            variant="outline"
            className="gap-2"
            onClick={exportCsv}
            disabled={items.length === 0}
          >
            <Download className="size-4" />
            Exportar CSV
          </Button>
        }
        stats={[
          {
            label: "Nesta página",
            value: isLoading ? "…" : items.length,
          },
          {
            label: "Página",
            value: isLoading ? "…" : `${page} / ${pageCount}`,
          },
        ]}
      />

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm md:flex-row md:flex-wrap md:items-end">
        <label className="flex min-w-[140px] flex-1 flex-col gap-1.5 text-xs font-medium text-muted-foreground">
          Período
          <Select
            value={period}
            onValueChange={(v) => {
              setPeriod(v);
              setOffset(0);
            }}
            options={[...PERIOD_OPTIONS]}
          />
        </label>
        <label className="flex min-w-[180px] flex-1 flex-col gap-1.5 text-xs font-medium text-muted-foreground">
          Pessoa
          <Select
            value={actor || "all"}
            onValueChange={(v) => {
              setActor(v === "all" ? "" : v);
              setOffset(0);
            }}
            options={peopleOptions}
          />
        </label>
        <label className="flex min-w-[160px] flex-1 flex-col gap-1.5 text-xs font-medium text-muted-foreground">
          Categoria
          <Select
            value={category}
            onValueChange={(v) => {
              setCategory(v);
              setOffset(0);
            }}
            options={CATEGORY_OPTIONS.map(({ value, label }) => ({ value, label }))}
          />
        </label>
        <label className="flex min-w-[200px] flex-[2] flex-col gap-1.5 text-xs font-medium text-muted-foreground">
          Busca
          <div className="flex gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Resumo, pessoa, fazenda…"
              className="h-10"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setQApplied(q.trim());
                  setOffset(0);
                }
              }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setQApplied(q.trim());
                setOffset(0);
              }}
            >
              Filtrar
            </Button>
          </div>
        </label>
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="Nenhum evento neste filtro."
              description="Ajuste período, pessoa ou categoria e tente de novo."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="border-b border-border bg-surface-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Quando</th>
                  <th className="px-4 py-3">Quem</th>
                  <th className="px-4 py-3">O que</th>
                  <th className="px-4 py-3">Produtor / Fazenda</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Severidade</th>
                </tr>
              </thead>
              <tbody className={cn(isFetching && "opacity-70")}>
                {items.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-border last:border-0 hover:bg-accent/40"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground tabular-nums">
                      {fmtDateTime(r.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      {r.actor_user_id ? (
                        <Link
                          href={routes.equipe.membro(r.actor_user_id)}
                          className="font-medium text-text-strong hover:underline"
                        >
                          {r.actor_name ?? "—"}
                        </Link>
                      ) : (
                        <span className="font-medium">{r.actor_name ?? "—"}</span>
                      )}
                      {r.actor_role ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {r.actor_role}
                        </span>
                      ) : null}
                    </td>
                    <td className="max-w-[280px] px-4 py-3 text-text-strong">
                      {r.summary}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {[r.producer_name, r.farm_name].filter(Boolean).join(" · ") ||
                        "—"}
                    </td>
                    <td className="px-4 py-3">{r.category ?? "Outros"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                          severityTone(r.severity),
                        )}
                      >
                        {severityLabel(r.severity)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > PAGE_SIZE ? (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} de {total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0 || isFetching}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={offset + PAGE_SIZE >= total || isFetching}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                Próxima
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
