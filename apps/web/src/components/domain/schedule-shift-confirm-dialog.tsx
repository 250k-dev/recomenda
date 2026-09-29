"use client";

import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@recomenda/ui/primitives/alert-dialog";
import { fmtDate } from "@recomenda/domain/recommendations/format";

export type ScheduleShift = {
  /** Nome da etapa (e do talhão, no registro em massa). */
  title: string;
  predictedYmd: string;
  executedYmd: string;
  deltaDays: number;
};

function daysLabel(n: number): string {
  const abs = Math.abs(n);
  return abs === 1 ? "1 dia" : `${abs} dias`;
}

function directionLabel(n: number): string {
  return n > 0 ? "para frente" : "para trás";
}

const MAX_LISTED = 5;

/**
 * Aviso antes de registrar uma aplicação muito longe da data prevista.
 *
 * Não bloqueia: o registro desloca as etapas pendentes seguintes pela mesma
 * diferença, e um salto grande costuma ser previsão errada. O usuário confirma
 * ciente disso — o servidor grava a previsão e o arrasto na auditoria.
 */
export function ScheduleShiftConfirmDialog({
  shifts,
  loading = false,
  onCancel,
  onConfirm,
}: {
  /** Etapas com diferença grande; vazio = fechado. */
  shifts: ScheduleShift[];
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const open = shifts.length > 0;
  const single = shifts.length === 1 ? shifts[0] : null;
  const listed = shifts.slice(0, MAX_LISTED);
  const hidden = shifts.length - listed.length;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !loading) onCancel();
      }}
    >
      <AlertDialogContent
        className="max-w-lg sm:max-w-lg"
        // Usado dentro de cards/linhas clicáveis — o clique não pode vazar.
        onClick={(e) => e.stopPropagation()}
      >
        <AlertDialogHeader className="grid-rows-none">
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
            Data de aplicação muito distante da prevista
          </AlertDialogTitle>
        </AlertDialogHeader>

        <AlertDialogDescription asChild>
          <div className="flex flex-col gap-3 text-left text-sm text-muted-foreground">
            {single ? (
              <p>
                A etapa <strong className="text-foreground">{single.title}</strong>{" "}
                estava prevista para{" "}
                <strong className="text-foreground">{fmtDate(single.predictedYmd)}</strong>{" "}
                e está sendo registrada em{" "}
                <strong className="text-foreground">{fmtDate(single.executedYmd)}</strong>:
                uma diferença de{" "}
                <strong className="text-foreground">{daysLabel(single.deltaDays)}</strong>.
              </p>
            ) : (
              <>
                <p>
                  {shifts.length} etapas estão sendo registradas longe da data prevista:
                </p>
                <ul className="flex flex-col gap-1 rounded-lg border bg-surface-2 px-3 py-2">
                  {listed.map((s) => (
                    <li key={s.title} className="flex justify-between gap-3">
                      <span className="min-w-0 truncate text-foreground">{s.title}</span>
                      <span className="shrink-0 tabular-nums">
                        prevista {fmtDate(s.predictedYmd)} ·{" "}
                        <strong className="text-foreground">
                          {s.deltaDays > 0 ? "+" : "−"}
                          {daysLabel(s.deltaDays)}
                        </strong>
                      </span>
                    </li>
                  ))}
                  {hidden > 0 ? <li>e mais {hidden}…</li> : null}
                </ul>
              </>
            )}

            <p>
              Ao confirmar, <strong className="text-foreground">todas as etapas
              pendentes seguintes</strong> desta safra serão movidas
              {single
                ? ` ${daysLabel(single.deltaDays)} ${directionLabel(single.deltaDays)}`
                : " pela mesma diferença"}{" "}
              no cronograma.
            </p>

            <p>
              Uma diferença desse tamanho costuma indicar que a data prevista da
              etapa está errada, e não um atraso real de campo. Confira a data de
              plantio da safra e a data da etapa. Se estiverem erradas, volte,
              corrija e registre de novo.
            </p>

            <p className="text-xs">
              Se confirmar, o registro fica no histórico com a data prevista, a data
              aplicada e as etapas que foram movidas.
            </p>
          </div>
        </AlertDialogDescription>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Voltar e revisar</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {loading ? "Registrando…" : "Registrar mesmo assim"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
