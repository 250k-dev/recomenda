"use client";

import { BreadcrumbTrail } from "@/components/domain/breadcrumb-back";
import { DashboardGreeting } from "@/components/domain/dashboard-greeting";
import { ProducerSearchButton } from "@/components/domain/producer-search";
import {
  CascadeBackButton,
  useCascadeNav,
} from "./cascade-back-button";
import { NotificationsBell } from "./notifications-bell";
import { ScopeSwitcher } from "./scope-switcher";
import { UserMenu } from "./user-menu";

function HeaderActions({ compact }: { compact?: boolean }) {
  return (
    <div
      className={
        compact
          ? "flex shrink-0 items-center gap-1"
          : "flex shrink-0 items-center gap-2"
      }
    >
      {compact ? <ProducerSearchButton iconOnly /> : null}
      <ScopeSwitcher compact={compact} />
      <NotificationsBell />
      <UserMenu />
    </div>
  );
}

export function AppHeader() {
  const { isHome, current, items } = useCascadeNav();

  return (
    <header className="border-b border-border/70 bg-canvas/95 px-2 py-1.5 backdrop-blur-md md:border-0 md:bg-transparent md:px-8 md:pt-6 md:pb-2 md:backdrop-blur-none">
      <div className="mx-auto flex min-h-12 w-full max-w-7xl items-center gap-1">
        {isHome ? (
          <div className="min-w-0 flex-1 pl-2">
            <div className="md:hidden">
              <DashboardGreeting compact />
            </div>
            <div className="hidden md:block">
              <DashboardGreeting />
            </div>
          </div>
        ) : (
          <>
            <div className="flex min-w-0 flex-1 items-center gap-1 md:hidden">
              <CascadeBackButton />
              <p className="min-w-0 flex-1 truncate font-display text-[17px] font-semibold leading-tight tracking-[-0.02em] text-text-strong">
                {current?.label ?? "Recomenda"}
              </p>
            </div>
            <div className="hidden min-w-0 shrink-0 md:block">
              <BreadcrumbTrail items={items} />
            </div>
          </>
        )}

        <div className="hidden min-w-0 flex-1 justify-end md:flex">
          <ProducerSearchButton />
        </div>
        <div className="md:hidden">
          <HeaderActions compact />
        </div>
        <div className="hidden md:block">
          <HeaderActions />
        </div>
      </div>
    </header>
  );
}
