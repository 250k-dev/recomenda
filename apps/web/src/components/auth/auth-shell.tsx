import type { ReactNode } from "react";
import { Logo } from "@recomenda/ui/assets/logo";
import { Logo250K } from "@recomenda/ui/assets/logo-250K";
import { cn } from "@recomenda/utils";

/**
 * Centered branded frame for the access screens (login / recuperar senha /
 * redefinir / convite). Brand mark on top, card slot in the middle, 250K
 * footer at the bottom — on the warm grain background from PublicLayout.
 */
export function AuthShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="relative flex min-h-[100dvh] flex-1 flex-col items-center justify-center px-4 py-12">
      <div className={cn("w-full max-w-md space-y-7", className)}>
        <div className="flex items-center justify-center gap-3.5">
          <span className="grid size-13 place-items-center rounded-2xl bg-primary shadow-(--brand-shadow)">
            <Logo className="size-7 fill-white" />
          </span>
          <div>
            <div className="font-display text-2xl font-bold tracking-[-0.02em] text-text-strong">
              Recomenda
            </div>
            <div className="text-sm text-muted-foreground">
              Sua plataforma de recomendações agrícolas
            </div>
          </div>
        </div>

        {children}

        <div className="flex flex-col items-center gap-1 pt-2 text-center">
          <p className="text-xs font-medium text-muted-foreground">
            Desenvolvido por
          </p>
          <a
            href="https://250k.com.br/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-base font-bold text-text-strong"
          >
            <Logo250K className="size-5" />
            250K
          </a>
        </div>
      </div>
    </div>
  );
}
