"use client";

import { ConfirmDialog } from "@recomenda/ui/patterns/confirm-dialog";
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
import { buttonVariants } from "@recomenda/ui/primitives/button";
import { cn } from "@recomenda/utils";

export type PlotDeleteTarget = {
  id: string;
  name: string;
  cycleNames: string[];
};

export function PlotDeleteDialog({
  target,
  loading,
  onOpenChange,
  onDelete,
  onUnlinkAndDelete,
}: {
  target: PlotDeleteTarget | null;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (id: string) => void | Promise<void>;
  onUnlinkAndDelete: (id: string) => void | Promise<void>;
}) {
  const inCycle = Boolean(target && target.cycleNames.length > 0);
  const open = target !== null;

  if (!inCycle) {
    return (
      <ConfirmDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Excluir talhão"
        description={
          target
            ? `Excluir o talhão "${target.name}"? Esta ação não pode ser desfeita.`
            : undefined
        }
        confirmLabel="Excluir"
        tone="destructive"
        loading={loading}
        onConfirm={async () => {
          if (!target) return;
          await onDelete(target.id);
        }}
      />
    );
  }

  const names = [...new Set(target.cycleNames)];
  const list =
    names.length === 1
      ? `a safra “${names[0]}”`
      : `as safras ${names.map((n) => `“${n}”`).join(", ")}`;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg overflow-hidden sm:max-w-lg">
        <AlertDialogHeader className="grid-rows-none">
          <AlertDialogTitle>Talhão em safra</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription asChild>
          <div className="text-left text-pretty text-sm text-muted-foreground">
            <p>
              O talhão “{target.name}” está em {list}. A programação vai para
              Removidas e o cadastro some da fazenda.
            </p>
          </div>
        </AlertDialogDescription>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <AlertDialogAction
            disabled={loading}
            className={cn(buttonVariants({ variant: "destructive" }), "w-full")}
            onClick={async (e) => {
              e.preventDefault();
              await onUnlinkAndDelete(target.id);
            }}
          >
            {loading ? "Aguarde…" : "Remover da safra e excluir"}
          </AlertDialogAction>
          <AlertDialogCancel disabled={loading} className="w-full">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            className={cn(buttonVariants({ variant: "outline" }), "w-full")}
            onClick={(e) => {
              e.preventDefault();
              onOpenChange(false);
            }}
          >
            Entendi
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
