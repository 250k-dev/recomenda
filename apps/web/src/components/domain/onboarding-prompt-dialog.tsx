"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@recomenda/ui/alert-dialog";

interface OnboardingPromptDialogProps {
  open: boolean;
  /** Disparado ao fechar via "Agora não", Escape ou clique fora. */
  onOpenChange: (open: boolean) => void;
  icon: LucideIcon;
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
}

export function OnboardingPromptDialog({
  open,
  onOpenChange,
  icon: Icon,
  eyebrow,
  title,
  description,
  confirmLabel,
  cancelLabel = "Agora não",
  onConfirm,
}: OnboardingPromptDialogProps) {
  const handleConfirm = (e: React.MouseEvent<HTMLButtonElement>) => {
  
    e.preventDefault();
    onConfirm();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="sm:max-w-md"
        {...(description ? {} : { "aria-describedby": undefined })}
      >
        <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="size-6" />
          </span>
          {eyebrow ? (
            <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.12em] text-primary-strong">
              {eyebrow}
            </p>
          ) : null}
          <AlertDialogTitle className="mt-1 font-display text-xl font-semibold tracking-[-0.01em] text-text-strong">
            {title}
          </AlertDialogTitle>
          {description ? (
            <AlertDialogDescription className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {description}
            </AlertDialogDescription>
          ) : null}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
