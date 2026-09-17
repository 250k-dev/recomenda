"use client";

import * as React from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../primitives/alert-dialog";
import { buttonVariants } from "../primitives/button";
import { cn } from "@recomenda/utils";

type Tone = "default" | "destructive";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Tone;
  loading?: boolean;
  className?: string;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "default",
  loading = false,
  className,
  onConfirm,
}: ConfirmDialogProps) {
  const handleConfirm = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    await onConfirm();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className={cn("max-w-lg overflow-hidden sm:max-w-lg", className)}
      >
        <AlertDialogHeader className="grid-rows-none">
          <AlertDialogTitle>{title}</AlertDialogTitle>
        </AlertDialogHeader>
        {description ? (
          <AlertDialogDescription asChild>
            <div className="max-h-[min(50vh,20rem)] overflow-y-auto overscroll-contain pr-1 text-left text-pretty">
              {description}
            </div>
          </AlertDialogDescription>
        ) : null}
        <AlertDialogFooter className="relative z-10">
          <AlertDialogCancel disabled={loading}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            onClick={handleConfirm}
            className={cn(
              tone === "destructive" &&
                buttonVariants({ variant: "destructive" }),
            )}
          >
            {loading ? "Aguarde…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
