"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, LogOut, UserCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe, usePlanQuota } from "@/lib/api/hooks";
import { logout } from "@/lib/api/client";
import { clearAccessToken } from "@/lib/auth/token-store";
import { cn } from "@/lib/utils";

export function UserMenu() {
  const router = useRouter();
  const { data: currentUser, isLoading: userLoading } = useMe();
  const { data: planData, isLoading: planLoading } = usePlanQuota({
    enabled: true,
  });

  const name = currentUser?.name?.trim() || "";
  const initial = name ? name.charAt(0).toUpperCase() : "U";
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
    clearAccessToken();
    router.push("/login");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-lg p-1 pr-2 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
        {userLoading ? (
          <>
            <Skeleton className="rounded-lg size-9" />
            <div className="flex-col hidden gap-1 sm:flex">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="w-16 h-3" />
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center text-sm font-bold rounded-lg size-9 shrink-0 bg-primary text-primary-foreground">
              {initial}
            </div>
            <div className="flex-col hidden min-w-0 leading-tight sm:flex">
              <span className="text-sm font-semibold truncate max-w-36 text-foreground">
                {name}
              </span>
              {planLoading ? (
                <Skeleton className="mt-0.5 h-3 w-14" />
              ) : planName ? (
                <span className="text-xs truncate max-w-36 text-muted-foreground">
                  {planName}
                </span>
              ) : null}
            </div>
          </>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <div className="flex flex-col gap-1 px-1.5 py-1.5">
          {userLoading ? (
            <Skeleton className="w-32 h-4" />
          ) : (
            <p className="text-sm font-semibold truncate text-foreground">
              {name}
            </p>
          )}

          {planLoading ? (
            <div className="space-y-1.5">
              <Skeleton className="w-20 h-4" />
              <Skeleton className="h-1.5 w-full" />
            </div>
          ) : planData ? (
            <div className="space-y-1.5">
              {planName && (
                <Badge className="w-fit gap-0.5 bg-sky-100 px-1.5 text-[0.6rem] leading-none text-sky-700">
                  <BadgeCheck className="size-2.5!" />
                  {planName}
                </Badge>
              )}
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-muted-foreground">Talhões em uso</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {current} / {limit}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    pct >= 90 ? "bg-amber-500" : "bg-primary",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          ) : null}
        </div>

        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile" className="mt-2 mb-1">
            <UserCircle className="size-4" />
            Meu perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onSelect={handleLogout}
          className="mb-1"
        >
          <LogOut className="size-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
