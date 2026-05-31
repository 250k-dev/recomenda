"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  UsersRound,
  Package,
  BarChart3,
  CreditCard,
  Settings,
  LogOut,
  Bell,
  ChevronsUpDown,
  UserCircle,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  logout,
  markNotificationRead,
  type Notification,
} from "@/lib/api/client";
import { clearAccessToken } from "@/lib/auth/token-store";
import { queryKeys, useMe, useNotifications } from "@/lib/api/hooks";
import { navByRole } from "@/config/nav";
import type { UserRole } from "@/types/auth";
import { Logo } from "@/assets/logo";
import { Badge } from "../ui/badge";

const iconMap: Record<string, React.ReactNode> = {
  "/dashboard": <LayoutDashboard className="size-4" />,
  "/producers": <Users className="size-4" />,
  "/catalog": <Package className="size-4" />,
  "/reports": <BarChart3 className="size-4" />,
  "/admin": <LayoutDashboard className="size-4" />,
  "/admin/plans": <CreditCard className="size-4" />,
  "/admin/agronomists": <Users className="size-4" />,
  "/admin/producers": <UsersRound className="size-4" />,
  "/admin/global-catalog": <Package className="size-4" />,
  "/admin/settings": <Settings className="size-4" />,
};

export function AppSidebar({ role }: { role: UserRole }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { isMobile } = useSidebar();
  const { data: currentUser } = useMe();
  const { data: notificationsResponse } = useNotifications();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const items = navByRole[role];
  const notificationsList = Array.isArray(notificationsResponse)
    ? notificationsResponse
    : (notificationsResponse?.data ?? []);
  const unreadCount = notificationsList.filter((n) => !n.read_at).length;

  const handleNotificationClick = (notification: Notification) => {
    const path = getNotificationPath(notification);
    setNotificationsOpen(false);
    void (async () => {
      try {
        await markNotificationRead(notification.id);
        await queryClient.invalidateQueries({
          queryKey: queryKeys.notifications,
        });
      } catch {
        /* navigation continues if marking read fails */
      }
      if (path) router.push(path);
    })();
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      /* ignore server errors */
    }
    clearAccessToken();
    router.push("/login");
  };

  const profileName =
    role === "ADMIN" ? "Administrador" : currentUser?.name?.trim() || "";
  const userInitial = profileName ? profileName.charAt(0).toUpperCase() : "U";

  return (
    <>
      <Sidebar collapsible="icon">
        {/* Logo */}
        <SidebarHeader>
          <div className="flex h-10 items-center gap-2 rounded-md px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
            <div className="bg-primary rounded-md p-1.5">
              <Logo className="size-5" />
            </div>
            <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
              <span className="text-sm font-semibold text-sidebar-foreground">
                Recomenda
              </span>
              <span className="text-[10px] text-muted-foreground">
                {role === "ADMIN" ? "Administrador" : "Agronomista"}
              </span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarSeparator />

        {/* Nav */}
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              {items.map((item) => {
                const active =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname === item.href ||
                      pathname.startsWith(`${item.href}/`);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.label}
                    >
                      <Link href={item.href}>
                        {iconMap[item.href]}
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        <SidebarSeparator />
        {/* User dropdown */}
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    tooltip={{
                      children: (
                        <>
                          <p className="font-medium">{profileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {currentUser?.email}
                          </p>
                        </>
                      ),
                    }}
                  >
                    <div className="relative">
                      {notificationsList.length > 0 && (
                        <Badge
                          variant="destructive"
                          className="absolute -top-1 -right-1 w-3.5 h-3.5 p-0 border-2 border-sidebar"
                        />
                      )}
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                        {userInitial}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 text-left leading-tight">
                      <p className="truncate text-xs font-semibold">
                        {profileName}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {currentUser?.email}
                      </p>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                  side={isMobile ? "bottom" : "right"}
                  align="end"
                  sideOffset={4}
                >
                  {role === "AGRONOMIST" && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link href="/profile">
                          <UserCircle className="size-4" />
                          Meu perfil
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onClick={() => setNotificationsOpen(true)}>
                    <Bell className="size-4" />
                    Notificações
                    {unreadCount > 0 && (
                      <SidebarMenuBadge className="static ml-auto size-auto rounded-full px-1.5">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </SidebarMenuBadge>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    variant="destructive"
                  >
                    <LogOut className="size-4" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      {/* Notification panel */}
      <Sheet open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <SheetContent side="right" className="w-full sm:w-96">
          <SheetHeader>
            <SheetTitle>Notificações</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-2">
            {notificationsList.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma notificação
              </p>
            ) : (
              notificationsList.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => handleNotificationClick(notification)}
                  className="flex w-full items-start gap-3 rounded-2xl border border-border bg-card p-3.5 text-left shadow-sm transition-all hover:border-primary/30 hover:bg-accent/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {getNotificationTitle(notification)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(notification.created_at).toLocaleDateString(
                        "pt-BR",
                        {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </p>
                  </div>
                  {!notification.read_at && (
                    <div
                      className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-background bg-primary"
                      aria-hidden
                    />
                  )}
                </button>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
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

function payloadSeasonId(
  payload: Record<string, unknown> | undefined,
): string | null {
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
    case "PRODUCT_SUBSTITUTED":
      return seasonId ? `/seasons/${seasonId}` : null;
    case "INVITATION":
    default:
      return null;
  }
}
