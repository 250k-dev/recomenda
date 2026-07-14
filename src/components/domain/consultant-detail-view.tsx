"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  Check,
  Leaf,
  Loader2,
  Search,
  Trash2,
  Tractor,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { BreadcrumbBack } from "@/components/domain/breadcrumb-back";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useConsultantActivity,
  useConsultantFarmActions,
  useConsultantSummary,
  useFarms,
  useRemoveConsultant,
} from "@/lib/api/hooks";
import { apiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

function sameSet(a: Set<string>, b: Set<string>) {
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}

/**
 * Dashboard do consultor em tela cheia: fazendas (seleção + Salvar),
 * produtores alcançáveis e feed de ações.
 */
export function ConsultantDetailView({ userId }: { userId: string }) {
  const router = useRouter();
  const { data: summary, isLoading: summaryLoading, isError } = useConsultantSummary(userId);
  const { data: activity, isLoading: activityLoading } = useConsultantActivity(userId);
  const { data: farmsData } = useFarms();
  const { grant, revoke } = useConsultantFarmActions(userId);
  const removeMutation = useRemoveConsultant();

  const [confirmRemove, setConfirmRemove] = useState(false);
  const [farmFilter, setFarmFilter] = useState("");
  /** null = espelha o servidor; Set = edição local ainda não salva. */
  const [draftOverride, setDraftOverride] = useState<Set<string> | null>(null);
  const [saving, setSaving] = useState(false);

  const allFarms = useMemo(() => farmsData?.data ?? [], [farmsData?.data]);

  const savedKey = (summary?.farms ?? []).map((f) => f.id).sort().join(",");
  const savedIds = useMemo(
    () => new Set(savedKey ? savedKey.split(",") : []),
    [savedKey],
  );
  const draftIds = draftOverride ?? savedIds;
  const dirty = draftOverride != null && !sameSet(draftOverride, savedIds);

  const filteredFarms = useMemo(() => {
    const q = farmFilter.trim().toLowerCase();
    if (!q) return allFarms;
    return allFarms.filter((f) => f.name.toLowerCase().includes(q));
  }, [allFarms, farmFilter]);

  const toGrant = useMemo(
    () => [...draftIds].filter((id) => !savedIds.has(id)),
    [draftIds, savedIds],
  );
  const toRevoke = useMemo(
    () => [...savedIds].filter((id) => !draftIds.has(id)),
    [draftIds, savedIds],
  );
  const changeCount = toGrant.length + toRevoke.length;

  const toggleFarm = (farmId: string) => {
    const next = new Set(draftIds);
    if (next.has(farmId)) next.delete(farmId);
    else next.add(farmId);
    setDraftOverride(sameSet(next, savedIds) ? null : next);
  };

  const discardChanges = () => setDraftOverride(null);

  const saveFarms = async () => {
    if (changeCount === 0) return;
    setSaving(true);
    try {
      await Promise.all([
        ...toGrant.map((id) => grant.mutateAsync(id)),
        ...toRevoke.map((id) => revoke.mutateAsync(id)),
      ]);
      setDraftOverride(null);
      toast.success(
        changeCount === 1
          ? "Acesso à fazenda atualizado."
          : `${changeCount} fazendas atualizadas.`,
      );
    } catch (e) {
      toast.error(apiErrorMessage(e, "Não foi possível salvar as fazendas."));
    } finally {
      setSaving(false);
    }
  };

  const onRemove = async () => {
    try {
      await removeMutation.mutateAsync(userId);
      toast.success("Consultor removido.");
      router.push("/consultants");
    } catch (e) {
      toast.error(apiErrorMessage(e, "Não foi possível remover o consultor."));
    }
  };

  if (isError) {
    return (
      <div className="flex flex-col gap-4">
        <BreadcrumbBack
          items={[
            { label: "Consultores", href: "/consultants" },
            { label: "Consultor" },
          ]}
        />
        <p className="rounded-xl border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger-strong">
          Consultor não encontrado ou sem permissão.
        </p>
      </div>
    );
  }

  const name = summary?.name ?? "Consultor";

  return (
    <div className="flex flex-col gap-6">
      <BreadcrumbBack
        items={[
          { label: "Consultores", href: "/consultants" },
          { label: name },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {summaryLoading ? (
                <Skeleton className="h-7 w-40" />
              ) : (
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  {name}
                </h1>
              )}
              {summary && !summary.is_active ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Inativo
                </span>
              ) : null}
            </div>
            {summaryLoading ? (
              <Skeleton className="mt-1 h-4 w-56" />
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                {summary?.email ?? "—"}
                {summary
                  ? ` · consultor desde ${new Date(summary.created_at).toLocaleDateString("pt-BR")}`
                  : null}
              </p>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          className="gap-2 text-danger-strong hover:bg-danger-soft hover:text-danger-strong"
          onClick={() => setConfirmRemove(true)}
        >
          <Trash2 className="size-4" />
          Remover consultor
        </Button>
      </div>

      {summaryLoading || !summary ? (
        <Skeleton className="h-20 w-full rounded-xl" />
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border bg-card px-4 py-3 text-center shadow-sm">
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {summary.farms.length}
            </p>
            <p className="text-xs text-muted-foreground">
              {summary.farms.length === 1 ? "fazenda" : "fazendas"}
            </p>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3 text-center shadow-sm">
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {summary.producers.length}
            </p>
            <p className="text-xs text-muted-foreground">
              {summary.producers.length === 1 ? "produtor" : "produtores"}
            </p>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3 text-center shadow-sm">
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {summary.activity_count_30d}
            </p>
            <p className="text-xs text-muted-foreground">ações · 30 dias</p>
          </div>
        </div>
      )}

      {/* Fazendas: largura total, grade compacta, salvar em lote */}
      <section className="rounded-xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Tractor className="h-4 w-4 text-primary-strong" />
              Fazendas compartilhadas
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {draftIds.size} de {allFarms.length} selecionada
              {draftIds.size === 1 ? "" : "s"}
              {dirty
                ? ` · ${changeCount} alteração${changeCount === 1 ? "" : "ões"} pendente${changeCount === 1 ? "" : "s"}`
                : ""}
            </p>
          </div>
          {allFarms.length > 6 ? (
            <div className="relative w-full sm:w-56">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={farmFilter}
                onChange={(e) => setFarmFilter(e.target.value)}
                placeholder="Buscar fazenda…"
                className="h-8 pl-8 text-sm"
              />
            </div>
          ) : null}
        </div>

        <div className="p-4">
          {allFarms.length === 0 ? (
            <p className="text-sm text-muted-foreground">Você ainda não tem fazendas.</p>
          ) : filteredFarms.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma fazenda com esse nome.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {filteredFarms.map((f) => {
                const on = draftIds.has(f.id);
                const wasShared = savedIds.has(f.id);
                const pendingAdd = on && !wasShared;
                const pendingRemove = !on && wasShared;
                return (
                  <li key={f.id}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors",
                        on
                          ? "border-primary/40 bg-primary/5"
                          : "border-border bg-background hover:bg-muted/40",
                        pendingAdd && "ring-1 ring-primary/30",
                        pendingRemove && "opacity-60",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="size-4 shrink-0 accent-primary"
                        checked={on}
                        onChange={() => toggleFarm(f.id)}
                        disabled={saving}
                      />
                      <span className="min-w-0 flex-1 truncate font-medium text-text-strong">
                        {f.name}
                      </span>
                      {pendingAdd ? (
                        <span className="shrink-0 text-[10px] font-medium text-primary-strong">
                          + novo
                        </span>
                      ) : null}
                      {pendingRemove ? (
                        <span className="shrink-0 text-[10px] font-medium text-danger-strong">
                          remover
                        </span>
                      ) : null}
                      {on && wasShared && !pendingAdd ? (
                        <Link
                          href={`/farms/${f.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0 text-xs font-medium text-primary-strong hover:underline"
                        >
                          abrir
                        </Link>
                      ) : null}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {dirty ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {toGrant.length > 0
                ? `+${toGrant.length} acesso${toGrant.length === 1 ? "" : "s"}`
                : null}
              {toGrant.length > 0 && toRevoke.length > 0 ? " · " : null}
              {toRevoke.length > 0
                ? `−${toRevoke.length} acesso${toRevoke.length === 1 ? "" : "s"}`
                : null}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={discardChanges}
                disabled={saving}
              >
                Descartar
              </Button>
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                onClick={saveFarms}
                disabled={saving || changeCount === 0}
              >
                {saving ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Check className="size-3.5" />
                )}
                {saving ? "Salvando…" : "Salvar alterações"}
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Leaf className="h-4 w-4 text-primary-strong" />
            Produtores que ele atende
          </h2>
          {!summary || summary.producers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum produtor alcançável pelas fazendas compartilhadas.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {summary.producers.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/producers/${p.id}`}
                    className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
                  >
                    {p.name}
                    <span className="text-xs text-primary-strong">abrir</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Activity className="h-4 w-4 text-primary-strong" />
            Últimas ações
          </h2>
          {activityLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
            </div>
          ) : !activity || activity.length === 0 ? (
            <p className="rounded-lg border border-dashed bg-background px-3 py-6 text-center text-sm text-muted-foreground">
              Nenhuma ação registrada ainda. As ações do consultor nas fazendas
              compartilhadas (listas, recomendações, safras, estoque) aparecem aqui.
            </p>
          ) : (
            <ul className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto">
              {activity.map((row) => (
                <li
                  key={row.id}
                  className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                >
                  <p className="leading-snug text-foreground">{row.summary}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {row.farm_name ? (
                      row.farm_id ? (
                        <Link
                          href={`/farms/${row.farm_id}`}
                          className="font-medium text-primary-strong hover:underline"
                        >
                          {row.farm_name}
                        </Link>
                      ) : (
                        <span className="font-medium">{row.farm_name}</span>
                      )
                    ) : null}
                    {row.farm_name ? <span>·</span> : null}
                    <span>{fmtDate(row.created_at)}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Remover consultor?"
        description={`${name} perderá o acesso e o login será desativado.`}
        tone="destructive"
        confirmLabel="Remover"
        loading={removeMutation.isPending}
        onConfirm={onRemove}
      />
    </div>
  );
}
