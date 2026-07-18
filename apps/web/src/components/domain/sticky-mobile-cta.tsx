import { ReactNode } from "react";
import { cn } from "@recomenda/utils";

/**
 * Barra fixa no rodapé (só mobile) com a ação primária da tela — padrão do
 * design "Refactor Recomendações". Renderiza também um espaçador para o
 * conteúdo não terminar escondido atrás da barra. Colocar no fim da página.
 */
export function StickyMobileCta({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <>
      <div aria-hidden className="h-20 sm:hidden" />
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden",
          "[&>*]:w-full",
          className,
        )}
      >
        {children}
      </div>
    </>
  );
}
