"use client";

import { Menu } from "lucide-react";
import { useSidebar } from "@recomenda/ui/sidebar";
import { Button } from "@recomenda/ui/button";
import { Logo } from "@recomenda/ui/assets/logo";

export function MobileTopbar() {
  const { toggleSidebar } = useSidebar();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface/95 px-3 backdrop-blur md:hidden">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <div className="flex items-center gap-2">
        <div className="bg-primary rounded-lg p-1.5 shadow-(--brand-shadow)">
          <Logo className="size-4.5" />
        </div>
        <span className="font-display text-sm font-bold tracking-[-0.02em] text-text-strong">
          Recomenda
        </span>
      </div>
    </header>
  );
}
