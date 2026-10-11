"use client";

import { ConfirmDialog } from "@recomenda/ui/patterns/confirm-dialog";

/** Aviso antes de aplicar um modelo que tem etapas com período 0. */
export function ZeroPeriodApplyDialog({
  open,
  onOpenChange,
  stageNames,
  loading,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stageNames: string[];
  loading?: boolean;
  onConfirm: () => void;
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Etapas com período zerado"
      confirmLabel="Aplicar mesmo assim"
      cancelLabel="Cancelar"
      loading={loading}
      onConfirm={onConfirm}
      description={
        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>
            Sem o período, a data não é calculada a partir do plantio. Essas
            etapas ficam no dia do plantio:
          </p>
          <ul className="flex flex-col gap-1">
            {stageNames.map((name, index) => (
              <li key={`${index}-${name}`} className="font-medium text-foreground">
                {name}
              </li>
            ))}
          </ul>
        </div>
      }
    />
  );
}
