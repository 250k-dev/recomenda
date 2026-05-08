"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { logout, markNotificationRead, type Notification } from "@/lib/api/client";
import { clearAccessToken } from "@/lib/auth/token-store";
import { queryKeys } from "@/lib/api/hooks";
import {
  LayoutDashboard,
  Building2,
  Users,
  UsersRound,
  Package,
  Clock,
  Droplet,
  Leaf,
  BarChart3,
  CreditCard,
  Settings,
  Shield,
  Globe,
  LogOut,
  Bell,
} from "lucide-react";
import { navByRole } from "@/config/nav";
import type { UserRole } from "@/types/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMe, useNotifications } from "@/lib/api/hooks";

const iconMap: Record<string, React.ReactNode> = {
  "/dashboard": <LayoutDashboard className="h-4 w-4" />,
  "/farms": <Building2 className="h-4 w-4" />,
  "/producers": <Users className="h-4 w-4" />,
  "/catalog": <Package className="h-4 w-4" />,
  "/timing-templates": <Clock className="h-4 w-4" />,
  "/mix-templates": <Droplet className="h-4 w-4" />,
  "/seasons": <Leaf className="h-4 w-4" />,
  "/reports": <BarChart3 className="h-4 w-4" />,
  "/plan": <CreditCard className="h-4 w-4" />,
  "/settings": <Settings className="h-4 w-4" />,
  "/admin": <Shield className="h-4 w-4" />,
  "/admin/plans": <CreditCard className="h-4 w-4" />,
  "/admin/agronomists": <Users className="h-4 w-4" />,
  "/admin/producers": <UsersRound className="h-4 w-4" />,
  "/admin/global-catalog": <Globe className="h-4 w-4" />,
  "/admin/settings": <Settings className="h-4 w-4" />,
};

export function Sidebar({ role }: { role: UserRole }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { data: currentUser } = useMe();
  const { data: notificationsResponse } = useNotifications();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const items = navByRole[role];

  const notificationsList = Array.isArray(notificationsResponse)
    ? notificationsResponse
    : notificationsResponse?.data ?? [];
  const unreadCount = notificationsList.filter((n) => !n.read_at).length;

  const handleNotificationClick = (notification: Notification) => {
    const path = getNotificationPath(notification);
    setNotificationsOpen(false);
    void (async () => {
      try {
        await markNotificationRead(notification.id);
        await queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      } catch {
        /* continuação da navegação mesmo se marcar lida falhar */
      }
      if (path) {
        router.push(path);
      }
    })();
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // ignora erros do servidor
    }
    clearAccessToken();
    router.push("/login");
  };

  const sidebarProfileName =
    role === "ADMIN"
      ? "Administrador"
      : (currentUser?.name?.trim() || currentUser?.name || "");
  const userInitial = sidebarProfileName ? sidebarProfileName.charAt(0).toUpperCase() : "U";

  return (
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar sm:w-60">
      <div className="flex items-start gap-2 px-4 py-4">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Image
              src="/recomenda/mark-positive.svg"
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 dark:hidden"
              aria-hidden
            />
            <Image
              src="/recomenda/mark-reverse.svg"
              alt=""
              width={36}
              height={36}
              className="hidden h-9 w-9 shrink-0 dark:block"
              aria-hidden
            />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-sidebar-foreground">Recomenda</p>
            <p className="truncate text-xs text-muted-foreground">
              {role === "ADMIN" ? "Administrador" : "Agronomista"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-end pt-0.5">
          <Sheet open={notificationsOpen} onOpenChange={setNotificationsOpen}>
            <Button
              variant="outline"
              size="icon-sm"
              className="relative h-9 w-9 shrink-0 rounded-full border-sidebar-border bg-sidebar-accent/40 hover:bg-sidebar-accent"
              aria-label="Notificações"
              onClick={() => setNotificationsOpen(true)}
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 ? (
                <span
                  className={
                    unreadCount > 9
                      ? "absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
                      : "absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold leading-none text-primary-foreground"
                  }
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </Button>
            <SheetContent side="right" className="w-full sm:w-96">
              <SheetHeader>
                <SheetTitle>Notificações</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-2">
                {notificationsList.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma notificação</p>
                ) : (
                  notificationsList.map((notification) => (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => handleNotificationClick(notification)}
                      className="flex w-full items-start gap-3 rounded-2xl border border-zinc-200/80 bg-card p-3.5 text-left shadow-sm transition-colors hover:bg-accent/60"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {getNotificationTitle(notification)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(notification.created_at).toLocaleDateString("pt-BR", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      {!notification.read_at ? (
                        <div
                          className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-background bg-primary"
                          aria-hidden
                        />
                      ) : null}
                    </button>
                  ))
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      <Separator />
      <ScrollArea className="min-h-0 flex-1 px-2 py-3">
        <nav className="flex flex-col gap-0.5">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-l-2 border-primary bg-sidebar-accent pl-[10px] text-sidebar-accent-foreground"
                    : "border-l-2 border-transparent text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <span className={cn("text-muted-foreground", active && "text-primary")}>
                  {iconMap[item.href]}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>
      <div className="p-3">
        {currentUser && (
          <div className="mb-3 rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                {userInitial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-sidebar-foreground">
                  {sidebarProfileName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {currentUser.email}
                </p>
              </div>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </aside>
  );
}

function getNotificationTitle(notification: Notification): string {
  const typeMap: Record<string, string> = {
    INVITATION: "Você foi convidado",
    RECOMMENDATION_DUE: "Recomendação vencendo",
    RECOMMENDATION_LATE: "Recomendação atrasada",
    PRODUCT_SUBSTITUTED: "Produto substituído",
    SEASON_PUBLISHED: "Safra publicada",
    HARVEST_REGISTERED: "Colheita registrada",
  };
  return typeMap[notification.type] || "Nova notificação";
}

function payloadSeasonId(payload: Record<string, unknown> | undefined): string | null {
  if (!payload) return null;
  const v = payload.season_id ?? payload.seasonId;
  return typeof v === "string" && v.length > 0 ? v : null;
}

function getNotificationPath(notification: Notification): string | null {
  const { type, payload } = notification;
  const seasonId = payloadSeasonId(payload);

  switch (type) {
    case "SEASON_PUBLISHED":
    case "HARVEST_REGISTERED":
    case "RECOMMENDATION_DUE":
    case "RECOMMENDATION_LATE":
      return seasonId ? `/seasons/${seasonId}` : null;
    case "PRODUCT_SUBSTITUTED":
      return seasonId ? `/seasons/${seasonId}` : null;
    case "INVITATION":
    default:
      return null;
  }
}
