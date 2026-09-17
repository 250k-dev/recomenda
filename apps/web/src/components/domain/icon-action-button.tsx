"use client";

import type { ComponentProps, ReactNode } from "react";
import { Button } from "@recomenda/ui/primitives/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@recomenda/ui/primitives/tooltip";
import { cn } from "@recomenda/utils";

/**
 * Ação do PageHero só com ícone, com o nome no tooltip.
 *
 * O rótulo continua dentro do botão: `sr-only` a partir de `sm` (leitor de
 * tela) e visível abaixo disso, onde o hero mostra as ações numa grade de
 * azulejos ícone + texto — no toque não há hover, e o ícone sozinho não se
 * explica.
 */
export function IconActionButton({
  label,
  icon,
  className,
  ...props
}: Omit<ComponentProps<typeof Button>, "children" | "size" | "asChild"> & {
  label: string;
  icon: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="sm" className={cn("gap-1.5", className)} {...props}>
          {icon}
          <span className="sm:sr-only">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent sideOffset={6}>{label}</TooltipContent>
    </Tooltip>
  );
}
