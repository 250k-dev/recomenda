"use client";

import { routes } from "@recomenda/config";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, Briefcase, Check, LogOut, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@recomenda/ui/primitives/dropdown-menu";
import { Badge } from "@recomenda/ui/primitives/badge";
import { Skeleton } from "@recomenda/ui/primitives/skeleton";
import {
  useActiveScope,
  useMe,
  useMemberships,
  usePlanQuota,
} from "@recomenda/api-hooks";
import { logout } from "@recomenda/api";
import { scopeOfLabel } from "@/lib/scope-label";

export function UserMenu() {
  const router = useRouter();
  const { data: currentUser, isLoading: userLoading } = useMe();
  const { data: memberships } = useMemberships();
  const activeScope = useActiveScope();
  // Plano/quota é da conta própria de agrônomo — esconde no modo gestão para
  // não misturar a identidade da carteira hospedeira com a do usuário.
  const showOwnPlan = !activeScope && currentUser?.role === "AGRONOMIST";
  const { data: planData, isLoading: planLoading } = usePlanQuota({
    enabled: showOwnPlan,
  });
  const hasMemberships = (memberships?.memberships.length ?? 0) > 0;

  const name = currentUser?.name?.trim() || "";
  const planName = showOwnPlan ? planData?.plan.name : undefined;

  const current = planData?.quota_usage.current ?? 0;
  const limit = planData?.quota_usage.limit ?? planData?.plan.plot_quota ?? null;
  const pct =
    limit != null && limit > 0 ? Math.min(100, Math.round((current / limit) * 100)) : 0;

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      /* ignore server errors */
    }
    router.push("/login?force=1");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Menu do usuário"
        disabled={userLoading}
        className="transition-shadow rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <div className="relative flex items-center justify-center rounded-lg size-11 shrink-0 bg-primary text-primary-foreground">
          <User className="size-5" />
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
              {activeScope ? (
                <Badge className="mt-1 gap-1 border-none bg-white/20 px-1.5 text-[0.65rem] font-semibold text-primary-foreground">
                  <Briefcase className="size-3!" />
                  {scopeOfLabel(activeScope.agronomist_name, activeScope.access_level)}
                </Badge>
              ) : planName ? (
                <Badge className="mt-1 gap-1 border-none bg-white/20 px-1.5 text-[0.65rem] font-semibold text-primary-foreground">
                  <Check className="size-3!" />
                  {planName}
                </Badge>
              ) : null}
            </div>
          </div>

          {showOwnPlan && planLoading ? (
            <div className="mt-3.5 space-y-2">
              <Skeleton className="w-24 h-3 bg-white/20" />
              <Skeleton className="h-1.5 w-full rounded-full bg-white/20" />
            </div>
          ) : showOwnPlan && planData ? (
            <div className="mt-3.5">
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-xs text-primary-foreground/80">
                  Talhões em uso
                </span>
                <span className="text-xs font-semibold tabular-nums">
                  {current}{" "}
                  <span className="font-normal text-primary-foreground/60">
                    / {limit ?? "∞"}
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
          ) : activeScope ? (
            <p className="mt-3.5 text-xs text-primary-foreground/80">
              Sessão imersa: produtores, agenda e equipe abaixo são só desta
              carteira.
            </p>
          ) : null}
        </div>

        <div className="px-2 pb-2">
          <DropdownMenuItem
            asChild
            className="gap-3 rounded-lg px-2.5 py-2.5 text-sm"
          >
            <Link href={routes.perfil}>
              <User className="size-4.5" />
              Meu perfil
            </Link>
          </DropdownMenuItem>
          {/* Relatórios agregam a carteira própria — fora do modo gestão. */}
          {!activeScope ? (
            <DropdownMenuItem
              asChild
              className="gap-3 rounded-lg px-2.5 py-2.5 text-sm"
            >
              <Link href={routes.relatorios}>
                <BarChart3 className="size-4.5" />
                Relatórios
              </Link>
            </DropdownMenuItem>
          ) : null}
          {/* Em escopo ativo o seletor/banner já trocam de carteira. */}
          {hasMemberships && !activeScope ? (
            <DropdownMenuItem
              asChild
              className="gap-3 rounded-lg px-2.5 py-2.5 text-sm"
            >
              <Link href={routes.minhasGestoes}>
                <Briefcase className="size-4.5" />
                Minhas Gestões
              </Link>
            </DropdownMenuItem>
          ) : null}
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
