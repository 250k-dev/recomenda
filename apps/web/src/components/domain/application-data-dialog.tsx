"use client";

import { useState } from "react";
import { Button } from "@recomenda/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recomenda/ui/primitives/dialog";
import {
  ApplicationDataFields,
  type ApplicationDataDraft,
} from "@/components/domain/application-data-fields";

/**
 * Modal "Dados da aplicação" (receita): o mesmo formulário na etapa da safra e
 * na etapa do modelo. O rascunho é local até "Salvar".
 *
 * `replicate`: na etapa da safra, oferece levar os dados para a mesma etapa
 * pendente nos outros talhões (mesmo pulverizador, mesma calda).
 */
export function ApplicationDataDialog({
  open,
  onOpenChange,
  stageName,
  value,
  onSave,
  areaHa,
  stageSuggestion,
  saving = false,
  readOnly = false,
  replicate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stageName: string;
  value: ApplicationDataDraft;
  onSave: (draft: ApplicationDataDraft, opts: { replicate: boolean }) => void;
  /** Área da etapa; sem ela (modelo) não há calda nem tanques. */
  areaHa?: number | null;
  stageSuggestion?: string | null;
  saving?: boolean;
  readOnly?: boolean;
  replicate?: { plots: string[]; loading: boolean };
}) {
  const [draft, setDraft] = useState<ApplicationDataDraft>(value);
  const [replicateOn, setReplicateOn] = useState(false);
  // Reabre com o valor atual (ajuste em render ao detectar a abertura).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDraft(value);
      setReplicateOn(false);
    }
  }

  const plots = replicate?.plots ?? [];
  const shownPlots = plots.slice(0, 4).join(", ") + (plots.length > 4 ? ` e mais ${plots.length - 4}` : "");

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Dados da aplicação</DialogTitle>
          <DialogDescription>{stageName}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[65vh] overflow-y-auto px-6 py-4">
          <ApplicationDataFields
            value={draft}
            onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
            areaHa={areaHa}
            stageSuggestion={stageSuggestion}
            readOnly={readOnly}
          />
          {replicate && !readOnly ? (
            <label
              className={
                "mt-4 flex items-start gap-2.5 rounded-lg border border-border bg-surface-2 p-3 text-sm" +
                (plots.length === 0 ? " opacity-60" : " cursor-pointer")
              }
            >
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-primary"
                checked={replicateOn}
                disabled={plots.length === 0}
                onChange={(e) => setReplicateOn(e.target.checked)}
              />
              <span>
                <span className="font-semibold text-text-strong">
                  Aplicar também a esta etapa nos outros talhões
                </span>
                <span className="mt-0.5 block text-[13px] text-muted-foreground">
                  {replicate.loading
                    ? "Buscando talhões…"
                    : plots.length === 0
                      ? "Nenhum outro talhão da safra tem esta etapa pendente."
                      : `${plots.length} ${plots.length === 1 ? "talhão" : "talhões"}: ${shownPlots}. Etapas já registradas não mudam.`}
                </span>
              </span>
            </label>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" disabled={saving} onClick={() => onOpenChange(false)}>
            {readOnly ? "Fechar" : "Cancelar"}
          </Button>
          {readOnly ? null : (
            <Button
              type="button"
              disabled={saving}
              onClick={() => onSave(draft, { replicate: replicateOn && plots.length > 0 })}
            >
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
