"use client";

import Image from "next/image";
import { Menu } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Logo } from "@/assets/logo";

export function MobileTopbar() {
  const { toggleSidebar } = useSidebar();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-3 backdrop-blur md:hidden">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        aria-label="Abrir menu"
        className="h-9 w-9"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <div className="flex items-center gap-2">
        <div className="bg-primary rounded-md p-1.5">
          <Logo className="size-4.5" />
        </div>
        <span className="text-sm font-semibold text-foreground">Recomenda</span>
      </div>
    </header>
  );
}
