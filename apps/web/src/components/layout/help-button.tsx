"use client";

import { useState } from "react";
import { CircleQuestionMark } from "lucide-react";
import { Button } from "@recomenda/ui/primitives/button";
import { HelpDialog } from "@/components/domain/help/help-dialog";
import type { HelpShell } from "@/components/domain/help/types";

/** Botão "?" ao lado do sino: abre a central de ajuda da tela atual. */
export function HelpButton({
  shell = "agronomist",
  triggerClassName,
}: {
  shell?: HelpShell;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size="icon-lg"
        variant="outline"
        aria-label="Ajuda"
        data-tour="help"
        onClick={() => setOpen(true)}
        className={triggerClassName}
      >
        <CircleQuestionMark />
      </Button>
      <HelpDialog open={open} onOpenChange={setOpen} shell={shell} />
    </>
  );
}
