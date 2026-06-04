"use client";

import Link from "next/link";
import { Logo } from "@/assets/logo";
import { ProducerSearch } from "@/components/domain/producer-search";
import { NotificationsBell } from "./notifications-bell";
import { UserMenu } from "./user-menu";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 flex h-18 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur md:gap-4 md:px-6">
      {/* Logo / app name — same fixed width as the right section on lg+ */}
      <div className="flex shrink-0 items-center lg:w-64">
        <Link
          href="/dashboard"
          className="flex items-center gap-2"
          aria-label="Recomenda — início"
        >
          <div className="rounded-lg bg-primary p-2">
            <Logo className="size-6" />
          </div>
          <span className="hidden text-base font-semibold text-foreground sm:inline">
            Recomenda
          </span>
        </Link>
      </div>

      {/* Producer search — fills the middle and stays centered between equal sides */}
      <div className="flex flex-1 justify-center">
        <div className="w-full max-w-xl">
          <ProducerSearch />
        </div>
      </div>

      {/* Notifications + user — same fixed width as the logo section on lg+ */}
      <div className="flex shrink-0 items-center justify-end gap-2 lg:w-64">
        <NotificationsBell />
        <UserMenu />
      </div>
    </header>
  );
}
