"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recomenda/ui/primitives/dialog";
import { Button } from "@recomenda/ui/primitives/button";
import { Input } from "@recomenda/ui/primitives/input";
import { useSetMemberProducers, useShareableProducers } from "@recomenda/api-hooks";
import { apiErrorMessage } from "@recomenda/api/api-error";
import type { ShareableProducer } from "@recomenda/api/consultants";
import { cn } from "@recomenda/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  memberName: string | null;
  /** Produtores já compartilhados com o membro. */
  linkedProducers: ShareableProducer[];
};

export function ManageMemberLinksDialog({
  open,
  onOpenChange,
  userId,
  memberName,
  linkedProducers,
}: Props) {
  const { data: shareable, isLoading } = useShareableProducers(open);
  const setProducers = useSetMemberProducers(userId);
  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState<Set<string> | null>(null);

  const sharedIds = useMemo(
    () => new Set(linkedProducers.map((p) => p.id)),
    [linkedProducers],
  );

  // Ao abrir / quando o servidor muda e o rascunho ainda não existe, espelha.
  useEffect(() => {
    if (!open) {
      setDraft(null);
      setFilter("");
      return;
    }
    setDraft(null);
  }, [open, userId]);

  const allProducers = useMemo(() => {
    const map = new Map<string, ShareableProducer>();
    for (const p of shareable ?? []) map.set(p.id, p);
    for (const p of linkedProducers) {
      const prev = map.get(p.id);
      map.set(p.id, {
        id: p.id,
        name: p.name,
        farm_count: p.farm_count ?? prev?.farm_count ?? 0,
      });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [shareable, linkedProducers]);

  const selected = draft ?? sharedIds;
  const firstName = (memberName ?? "membro").trim().split(/\s+/)[0] || "membro";

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return allProducers;
    return allProducers.filter((p) => p.name.toLowerCase().includes(q));
  }, [allProducers, filter]);

  const toAdd = useMemo(
    () => [...selected].filter((id) => !sharedIds.has(id)),
    [selected, sharedIds],
  );
  const toRemove = useMemo(
    () => [...sharedIds].filter((id) => !selected.has(id)),
    [selected, sharedIds],
  );
  const dirty = toAdd.length > 0 || toRemove.length > 0;

  const toggle = (id: string) => {
    if (setProducers.isPending) return;
    setDraft((prev) => {
      const next = new Set(prev ?? sharedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setDraft(new Set(allProducers.map((p) => p.id)));
  };

  const clearAll = () => {
    setDraft(new Set());
  };

  const save = async () => {
    try {
      const res = await setProducers.mutateAsync({ add: toAdd, remove: toRemove });
      toast.success(
        [
          res.added > 0 ? `${res.added} liberado(s)` : "",
          res.removed > 0 ? `${res.removed} removido(s)` : "",
        ]
          .filter(Boolean)
          .join(" · ") || "Vínculos atualizados.",
      );
      onOpenChange(false);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Não foi possível salvar os vínculos."));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-6 py-5 text-left">
          <DialogTitle>Gerenciar vínculos</DialogTitle>
          <DialogDescription>
            Produtores compartilhados com {firstName} · {selected.size} de{" "}
            {allProducers.length} selecionados
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 border-b border-border px-6 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Buscar produtor…"
              className="h-9 pl-8"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={selectAll}>
              Selecionar todos
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
              Limpar
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando produtores…</p>
          ) : allProducers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum produtor disponível para compartilhar.
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum produtor na busca.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {filtered.map((p) => {
                const on = selected.has(p.id);
                const changed = on !== sharedIds.has(p.id);
                const farms = p.farm_count ?? 0;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={setProducers.isPending}
                      onClick={() => toggle(p.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition",
                        on
                          ? "border-primary/30 bg-primary-soft/40"
                          : "border-border bg-surface-2",
                        changed && "border-warning/50 bg-warning/10",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-[5px] border-2",
                          on
                            ? "border-primary bg-primary"
                            : "border-muted-foreground/40 bg-card",
                        )}
                      >
                        {on ? (
                          <Check className="size-3 text-primary-foreground" strokeWidth={3} />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-text-strong">
                          {p.name}
                        </span>
                        <span className="block text-xs text-muted-foreground tabular-nums">
                          {farms} faz.
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter className="border-t border-border px-6 py-4 sm:justify-between">
          <p className="text-xs text-muted-foreground tabular-nums">
            {selected.size} de {allProducers.length} selecionados
            {dirty
              ? ` · ${[
                  toAdd.length > 0 ? `${toAdd.length} a liberar` : "",
                  toRemove.length > 0 ? `${toRemove.length} a remover` : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}`
              : ""}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={setProducers.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={save}
              disabled={!dirty || setProducers.isPending}
            >
              {setProducers.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Salvando…
                </>
              ) : (
                "Salvar vínculos"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
