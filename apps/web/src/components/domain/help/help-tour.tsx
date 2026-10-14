"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  EVENTS,
  Joyride,
  type EventHandler,
  type Step,
  type TooltipRenderProps,
} from "react-joyride";
import { XIcon } from "lucide-react";
import { Button } from "@recomenda/ui/primitives/button";
import { cn } from "@recomenda/utils";
import { useHelpTourStore } from "@/stores/help-tour";
import type { HelpTourStep } from "./types";

/**
 * Primeiro elemento **visível** com `data-tour="<name>"`.
 *
 * O header renderiza as ações duas vezes (compacta no celular, completa no
 * desktop) e esconde uma por CSS — um `querySelector` simples pegaria a
 * escondida e o destaque cairia num retângulo vazio.
 */
export function visibleTourTarget(name: string): HTMLElement | null {
  const els = document.querySelectorAll<HTMLElement>(
    `[data-tour="${CSS.escape(name)}"]`,
  );
  for (const el of els) {
    if (el.getClientRects().length > 0) return el;
  }
  return null;
}

/**
 * Converte os passos da ajuda em passos do Joyride, já sem os que não têm
 * alvo visível agora (ex.: seletor de carteira para quem só tem uma).
 */
export function buildTourSteps(steps: HelpTourStep[]): Step[] {
  return steps.flatMap<Step>((step) => {
    const { target, title, content, placement } = step;
    if (target == null) {
      return [{ target: "body", placement: "center", title, content }];
    }
    if (!visibleTourTarget(target)) return [];
    return [
      {
        // Função, não o elemento: resolve de novo a cada passo, caso o React
        // tenha trocado o nó entre o início do tour e a chegada neste passo.
        target: () => visibleTourTarget(target),
        placement: placement ?? "bottom",
        title,
        content,
      },
    ];
  });
}

/** Balão do tour com os primitivos do app em vez do visual padrão da lib. */
function TourTooltip({
  index,
  size,
  isLastStep,
  step,
  backProps,
  closeProps,
  primaryProps,
  skipProps,
  tooltipProps,
}: TooltipRenderProps) {
  return (
    <div
      {...tooltipProps}
      aria-labelledby="help-tour-title"
      className="relative w-[min(22rem,calc(100vw-2rem))] rounded-xl bg-popover p-4 text-popover-foreground ring-1 ring-foreground/10"
    >
      <Button
        {...closeProps}
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute top-2 right-2"
      >
        <XIcon />
        <span className="sr-only">Fechar tour</span>
      </Button>

      {size > 1 ? (
        <div className="mb-3 flex items-center gap-1 pr-10" aria-hidden>
          {Array.from({ length: size }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                i <= index ? "bg-primary" : "bg-border",
              )}
            />
          ))}
        </div>
      ) : null}

      {step.title ? (
        <h2
          id="help-tour-title"
          className="pr-10 font-display text-base font-semibold text-text-strong"
        >
          {step.title}
        </h2>
      ) : null}
      <div className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {step.content}
      </div>

      <div className="mt-4 flex items-center gap-2">
        {size > 1 ? (
          <span className="text-xs font-medium tabular-nums text-muted-foreground">
            {index + 1} de {size}
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-1.5">
          {!isLastStep ? (
            <Button {...skipProps} type="button" variant="ghost" size="sm">
              Pular
            </Button>
          ) : null}
          {index > 0 ? (
            <Button {...backProps} type="button" variant="outline" size="sm">
              Voltar
            </Button>
          ) : null}
          <Button {...primaryProps} type="button" size="sm">
            {isLastStep ? "Concluir" : "Próximo"}
          </Button>
        </div>
      </div>
    </div>
  );
}

const LOCALE = {
  back: "Voltar",
  close: "Fechar tour",
  last: "Concluir",
  next: "Próximo",
  skip: "Pular tour",
};

/**
 * Desenha o tour iniciado pela ajuda. Uma instância por casca (agrônomo e
 * admin); o tour para sozinho ao trocar de rota, ao concluir ou com Esc.
 */
export function HelpTour() {
  const { steps, run, runId, stop } = useHelpTourStore();
  const pathname = usePathname();

  useEffect(() => {
    stop();
  }, [pathname, stop]);

  // O Esc padrão da lib só fecha o passo atual e segue para o próximo; aqui
  // ele encerra o tour inteiro, como o X.
  useEffect(() => {
    if (!run) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") stop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run, stop]);

  const onEvent: EventHandler = (data) => {
    if (data.type === EVENTS.TOUR_END) stop();
  };

  if (!run) return null;

  return (
    <Joyride
      key={runId}
      run
      continuous
      steps={steps}
      onEvent={onEvent}
      tooltipComponent={TourTooltip}
      locale={LOCALE}
      floatingOptions={{ shiftOptions: { padding: 16 } }}
      options={{
        skipBeacon: true,
        buttons: ["back", "close", "primary", "skip"],
        closeButtonAction: "skip",
        dismissKeyAction: false,
        // Clique fora não encerra: no celular é fácil tocar no fundo sem querer.
        overlayClickAction: false,
        overlayColor: "rgba(20, 24, 18, 0.5)",
        arrowColor: "var(--popover)",
        spotlightRadius: 12,
        spotlightPadding: 6,
        // Header fixo no celular cobriria o alvo depois do scroll.
        scrollOffset: 96,
        zIndex: 60,
      }}
      styles={{
        floater: { filter: "drop-shadow(0 8px 24px rgb(0 0 0 / 0.16))" },
      }}
    />
  );
}
