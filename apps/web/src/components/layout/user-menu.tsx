"use client";

import { routes } from "@recomenda/config";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, Bell, Check, LogOut, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@recomenda/ui/dropdown-menu";
import { Badge } from "@recomenda/ui/badge";
import { Skeleton } from "@recomenda/ui/skeleton";
import { useMe, usePlanQuota } from "@recomenda/api-hooks";
import { logout } from "@recomenda/api";
import { NotificationsPanel, useNotificationsList } from "./notifications-bell";

export function UserMenu() {
  const router = useRouter();
  const { data: currentUser, isLoading: userLoading } = useMe();
  const { data: planData, isLoading: planLoading } = usePlanQuota({
    enabled: true,
  });
  const { unreadCount } = useNotificationsList();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const name = currentUser?.name?.trim() || "";
  const planName = planData?.plan.name;

  const current = planData?.quota_usage.current ?? 0;
  const limit = planData?.quota_usage.limit ?? planData?.plan.plot_quota ?? 0;
  const pct =
    limit > 0 ? Math.min(100, Math.round((current / limit) * 100)) : 0;

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      /* ignore server errors */
    }
    router.push("/login?force=1");
  };

  return (
    <DropdownMenu
      open={menuOpen}
      onOpenChange={(open) => {
        setMenuOpen(open);
        if (!open) setNotifOpen(false);
      }}
    >
      <DropdownMenuTrigger
        aria-label="Menu do usuário"
        disabled={userLoading}
        className="transition-shadow rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <div className="relative flex items-center justify-center rounded-lg size-11 shrink-0 bg-primary text-primary-foreground">
          <User className="size-5" />
          {unreadCount > 0 && (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 size-3 rounded-full border-2 border-canvas bg-destructive"
            />
          )}
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="p-0 overflow-hidden w-80 rounded-2xl"
      >
        {/* Card hero: identidade + plano + quota */}
        <div className="p-4 m-2 rounded-xl bg-linear-160 from-primary to-primary-strong text-primary-foreground">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[0.65rem] bg-white/15">
              <User className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold tracking-tight truncate">
                {name}
              </p>
              {planName && (
                <Badge className="mt-1 gap-1 border-none bg-white/20 px-1.5 text-[0.65rem] font-semibold text-primary-foreground">
                  <Check className="size-3!" />
                  {planName}
                </Badge>
              )}
            </div>
          </div>

          {planLoading ? (
            <div className="mt-3.5 space-y-2">
              <Skeleton className="w-24 h-3 bg-white/20" />
              <Skeleton className="h-1.5 w-full rounded-full bg-white/20" />
            </div>
          ) : planData ? (
            <div className="mt-3.5">
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-xs text-primary-foreground/80">
                  Talhões em uso
                </span>
                <span className="text-xs font-semibold tabular-nums">
                  {current}{" "}
                  <span className="font-normal text-primary-foreground/60">
                    / {limit}
                  </span>
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/25">
                <div
                  className="h-full transition-all bg-white rounded-full"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="px-2 pb-2">
          <DropdownMenuSub open={notifOpen} onOpenChange={setNotifOpen}>
            {/* preventDefault nos eventos de pointer desativa o abrir/fechar por
                hover do Radix — o submenu só abre/fecha no clique (ou teclado).
                svg:last-child esconde o chevron embutido no SubTrigger. */}
            <DropdownMenuSubTrigger
              onClick={(event) => {
                event.preventDefault();
                setNotifOpen((open) => !open);
              }}
              onPointerMove={(event) => event.preventDefault()}
              onPointerLeave={(event) => event.preventDefault()}
              className="gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium [&>svg:last-child]:hidden"
            >
              <Bell className="size-4.5" />
              Notificações
              {unreadCount > 0 && (
                <Badge
                  variant="destructive"
                  className="ml-auto h-5 min-w-5 rounded-full px-1.5 text-[0.7rem] leading-none text-white! tabular-nums"
                >
                  {unreadCount}
                </Badge>
              )}
            </DropdownMenuSubTrigger>
            {/* alignOffset alinha o topo do painel ao topo do menu (145px = altura do card hero) */}
            <DropdownMenuSubContent
              sideOffset={10}
              alignOffset={-145}
              className="p-0 overflow-hidden w-84 rounded-2xl"
            >
              <NotificationsPanel onNavigate={() => setMenuOpen(false)} />
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem
            asChild
            className="gap-3 rounded-lg px-2.5 py-2.5 text-sm"
          >
            <Link href={routes.perfil}>
              <User className="size-4.5" />
              Meu perfil
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            asChild
            className="gap-3 rounded-lg px-2.5 py-2.5 text-sm"
          >
            <Link href={routes.relatorios}>
              <BarChart3 className="size-4.5" />
              Relatórios
            </Link>
          </DropdownMenuItem>
        </div>

        <DropdownMenuSeparator className="mx-4 my-0" />

        <div className="p-2">
          <DropdownMenuItem
            variant="destructive"
            onSelect={handleLogout}
            className="gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium"
          >
            <LogOut className="size-4.5" />
            Sair
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
