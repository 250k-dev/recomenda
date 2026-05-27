"use client";

import Image from "next/image";
import { useState } from "react";
import { Menu } from "lucide-react";

import { SidebarBody } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { UserRole } from "@/types/auth";

export function MobileTopbar({ role }: { role: UserRole }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/85 px-3 backdrop-blur md:hidden">
      <div className="flex items-center gap-2">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Abrir menu" className="h-9 w-9">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 border-r border-sidebar-border bg-sidebar p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Menu de navegação</SheetTitle>
            </SheetHeader>
            <SidebarBody role={role} onNavigate={() => setOpen(false)} forceExpanded />
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2">
          <Image
            src="/recomenda/mark-positive.svg"
            alt=""
            width={28}
            height={28}
            className="h-7 w-7"
            aria-hidden
          />
          <span className="text-sm font-semibold text-foreground">Recomenda</span>
        </div>
      </div>
    </header>
  );
}
