"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UsersRound,
  Package,
  BarChart3,
  CreditCard,
  BadgeCheck,
  EllipsisVertical,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@recomenda/ui/primitives/sidebar";
import { useMe, usePlanQuota } from "@recomenda/api-hooks";
import { navFor } from "@/config/nav";
import { routes } from "@recomenda/config";
import type { AccessLevel, UserRole } from "@recomenda/api/auth-types";
import { Logo } from "@recomenda/ui/assets/logo";
import { NotificationsBell } from "./notifications-bell";
import { Badge } from "@recomenda/ui/primitives/badge";

const iconMap: Record<string, React.ReactNode> = {
  "/dashboard": <LayoutDashboard className="size-4" />,
  "/produtores": <Users className="size-4" />,
  "/produtos": <Package className="size-4" />,
  "/relatorios": <BarChart3 className="size-4" />,
  "/equipe": <UsersRound className="size-4" />,
  "/admin": <LayoutDashboard className="size-4" />,
  "/admin/planos": <CreditCard className="size-4" />,
  "/admin/agronomos": <Users className="size-4" />,
  "/admin/produtores": <UsersRound className="size-4" />,
  "/admin/catalogo-global": <Package className="size-4" />,
};

export function AppSidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const { data: currentUser } = useMe();
  const { data: planData } = usePlanQuota({ enabled: role === "AGRONOMIST" });

  const accessLevel = (currentUser?.access_level ?? null) as AccessLevel | null;
  const items = navFor(role, accessLevel);
  // Subtítulo da sidebar por papel/nível.
  const roleLabel =
    role === "ADMIN"
      ? "Administrador"
      : role === "STAFF"
        ? accessLevel === "MANAGER"
          ? "Gestor"
          : "Consultor"
        : "Agronomista";

  const profileName =
    role === "ADMIN" ? "Administrador" : currentUser?.name?.trim() || "";
  const userInitial = profileName ? profileName.charAt(0).toUpperCase() : "U";
  const profileHref = role === "ADMIN" ? routes.admin.perfil : routes.perfil;

  return (
    <Sidebar collapsible="icon">
      {/* Logo */}
      <SidebarHeader>
        <div className="flex h-10 items-center gap-2.5 rounded-md px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <div className="rounded-lg bg-sidebar-primary p-2">
            <Logo className="size-6" />
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="font-display text-base font-bold tracking-[-0.02em] text-sidebar-foreground">
              Recomenda
            </span>
            <span className="text-[10px] text-sidebar-foreground/70">
              {roleLabel}
            </span>
          </div>
          <NotificationsBell
            align="start"
            triggerClassName="ml-auto group-data-[collapsible=icon]:hidden"
          />
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

      {/* User profile */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
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
              <Link href={profileHref}>
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-base font-bold text-sidebar-primary-foreground">
                  {userInitial}
                </div>
                <div className="flex-1 flex items-center">
                  <div className="min-w-0 flex-1 text-left leading-tight">
                    {planData?.plan.name && (
                      <Badge className="text-[0.6rem] gap-0.5 px-1.5 leading-none bg-sky-100 text-sky-700">
                        <BadgeCheck className="size-2.5!" />
                        {planData?.plan.name}
                      </Badge>
                    )}
                    <p className="truncate text-sm font-semibold max-w-40">
                      {profileName}
                    </p>
                  </div>

                  <EllipsisVertical className="size-4 text-muted-foreground" />
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
