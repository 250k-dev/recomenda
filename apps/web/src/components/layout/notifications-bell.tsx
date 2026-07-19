"use client";

import type { Route } from "next";
import { routes } from "@recomenda/config";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeftRight,
  Bell,
  Check,
  Sprout,
  TriangleAlert,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from "@recomenda/api";
import { queryKeys, useNotifications } from "@recomenda/api-hooks";
import { cn } from "@recomenda/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

/** Lista de notificações + contagem de não lidas, normalizada. */
export function useNotificationsList() {
  const { data: notificationsResponse } = useNotifications();
  const notifications = Array.isArray(notificationsResponse)
    ? notificationsResponse
    : (notificationsResponse?.data ?? []);
  const unreadCount = notifications.filter((n) => !n.read_at).length;
  return { notifications, unreadCount };
}

/**
 * Conteúdo do menu de notificações (cabeçalho + lista agrupada por dia).
 * Usado no popover do sino (sidebar admin) e no submenu do menu do usuário.
 */
export function NotificationsPanel({
  onNavigate,
}: {
  /** Chamado ao clicar numa notificação — fecha o menu que hospeda o painel. */
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { notifications, unreadCount } = useNotificationsList();

  const handleNotificationClick = (notification: Notification) => {
    const path = getNotificationPath(notification);
    onNavigate?.();
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

  const handleMarkAllRead = () => {
    void (async () => {
      try {
        await markAllNotificationsRead();
        await queryClient.invalidateQueries({
          queryKey: queryKeys.notifications,
        });
      } catch {
        /* mantém o estado atual se falhar */
      }
    })();
  };

  const groups = groupByDay(notifications);

  return (
    <>
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <p className="text-[0.95rem] font-semibold tracking-tight text-foreground">
            Notificações
          </p>
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="h-5 min-w-5 rounded-full px-1.5 text-[0.7rem] leading-none tabular-nums"
            >
              {unreadCount}
            </Badge>
          )}
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="ml-auto inline-flex items-center gap-1 rounded-sm text-xs font-medium text-primary outline-none transition-colors hover:text-primary-strong focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Check className="size-3.5" />
              Marcar todas como lidas
            </button>
          )}
        </div>
      </div>

      <div className="max-h-[26rem] overflow-y-auto px-2 pb-2 pt-1">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Bell className="size-5 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label}>
              <p className="px-2.5 pb-1 pt-2 text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
                {group.label}
              </p>
              {group.items.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  onClick={() => handleNotificationClick(notification)}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </>
  );
}

function NotificationRow({
  notification,
  onClick,
}: {
  notification: Notification;
  onClick: () => void;
}) {
  const read = Boolean(notification.read_at);
  const style = NOTIFICATION_STYLES[notification.type] ?? DEFAULT_STYLE;
  const Icon = style.icon;
  const body = getNotificationBody(notification);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl px-2.5 py-2.5 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
        !read && "bg-primary-soft/40 hover:bg-primary-soft/60",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[0.55rem]",
          read ? "bg-muted" : style.tile,
        )}
      >
        <Icon
          className={cn(
            "size-4",
            read ? "text-muted-foreground" : style.iconColor,
          )}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-[0.8rem] font-semibold text-foreground",
            read && "font-medium text-foreground/70",
          )}
        >
          {getNotificationTitle(notification)}
        </span>
        {body ? (
          <span
            className={cn(
              "mt-px block text-xs leading-snug text-muted-foreground",
              read && "text-muted-foreground/70",
            )}
          >
            {body}
          </span>
        ) : null}
        <span
          className={cn(
            "mt-1 block text-[0.7rem] text-muted-foreground/70",
            read && "text-muted-foreground/50",
          )}
        >
          {formatNotificationDate(notification.created_at)}
        </span>
      </span>
      {!read && (
        <span
          aria-hidden
          className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
        />
      )}
    </button>
  );
}

export function NotificationsBell({
  triggerClassName,
  align = "end",
}: {
  triggerClassName?: string;
  align?: "start" | "center" | "end";
}) {
  const { unreadCount } = useNotificationsList();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="icon-lg"
          variant="outline"
          aria-label="Notificações"
          className={cn("relative", triggerClassName)}
        >
          <Bell />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute w-5 h-5 p-1.5 border-4 rounded-full -top-0.5 -right-0.5 border-background"
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-84 overflow-hidden rounded-2xl p-0">
        <NotificationsPanel onNavigate={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

/** Ícone + cores do tile por tipo de notificação (estado não lido). */
const NOTIFICATION_STYLES: Record<
  Notification["type"],
  { icon: LucideIcon; tile: string; iconColor: string }
> = {
  HARVEST_REGISTERED: {
    icon: Check,
    tile: "bg-primary-soft",
    iconColor: "text-primary",
  },
  SEASON_PUBLISHED: {
    icon: Sprout,
    tile: "bg-primary-soft",
    iconColor: "text-primary",
  },
  RECOMMENDATION_DUE: {
    icon: TriangleAlert,
    tile: "bg-warning-soft",
    iconColor: "text-warning-strong",
  },
  RECOMMENDATION_LATE: {
    icon: TriangleAlert,
    tile: "bg-danger-soft",
    iconColor: "text-danger",
  },
  PRODUCT_SUBSTITUTED: {
    icon: ArrowLeftRight,
    tile: "bg-tb-soft",
    iconColor: "text-tb",
  },
  INVITATION: {
    icon: UserPlus,
    tile: "bg-clay-soft",
    iconColor: "text-clay",
  },
  TEAM_ACTIVITY: {
    icon: Users,
    tile: "bg-tb-soft",
    iconColor: "text-tb",
  },
};

const DEFAULT_STYLE = {
  icon: Bell,
  tile: "bg-primary-soft",
  iconColor: "text-primary",
} satisfies (typeof NOTIFICATION_STYLES)[keyof typeof NOTIFICATION_STYLES];

type NotificationGroup = { label: string; items: Notification[] };

/** Agrupa notificações consecutivas por dia relativo (Hoje / Ontem / Anteriores). */
function groupByDay(notifications: Notification[]): NotificationGroup[] {
  const groups: NotificationGroup[] = [];
  for (const notification of notifications) {
    const label = dayLabel(notification.created_at);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(notification);
    else groups.push({ label, items: [notification] });
  }
  return groups;
}

function dayLabel(dateStr: string): string {
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round(
    (startOfDay(new Date()) - startOfDay(new Date(dateStr))) / 86_400_000,
  );
  if (days <= 0) return "Hoje";
  if (days === 1) return "Ontem";
  return "Anteriores";
}

function formatNotificationDate(dateStr: string): string {
  return format(new Date(dateStr), "d MMM, HH:mm", { locale: ptBR });
}

function getNotificationTitle(notification: Notification): string {
  const typeMap: Record<string, string> = {
    INVITATION: "Você foi convidado",
    RECOMMENDATION_DUE: "Recomendação vencendo",
    RECOMMENDATION_LATE: "Recomendação atrasada",
    PRODUCT_SUBSTITUTED: "Produto substituído",
    SEASON_PUBLISHED: "Safra publicada",
    HARVEST_REGISTERED: "Colheita registrada",
    TEAM_ACTIVITY: "Atividade da equipe",
  };
  return typeMap[notification.type] || "Nova notificação";
}

/** Linha descritiva ("quem fez o quê") — hoje só a atividade da equipe usa. */
function getNotificationBody(notification: Notification): string | null {
  if (notification.type !== "TEAM_ACTIVITY") return null;
  const p = notification.payload ?? {};
  const actor = typeof p.actor_name === "string" ? p.actor_name : "Alguém";
  const summary = typeof p.summary === "string" ? p.summary : "fez uma alteração";
  const farm = typeof p.farm_name === "string" && p.farm_name ? ` · ${p.farm_name}` : "";
  return `${actor} ${summary}${farm}`;
}

function payloadSeasonId(
  payload: Record<string, unknown> | undefined,
): string | null {
  if (!payload) return null;
  const v = payload.season_id ?? payload.seasonId;
  return typeof v === "string" && v.length > 0 ? v : null;
}

function getNotificationPath(notification: Notification): Route | null {
  const { type, payload } = notification;
  const seasonId = payloadSeasonId(payload);
  switch (type) {
    case "SEASON_PUBLISHED":
    case "HARVEST_REGISTERED":
    case "RECOMMENDATION_DUE":
    case "RECOMMENDATION_LATE":
    case "PRODUCT_SUBSTITUTED":
      return seasonId ? routes.safras.cronograma(seasonId) : null;
    case "TEAM_ACTIVITY": {
      const farmId = payload?.farm_id;
      return typeof farmId === "string" && farmId
        ? routes.fazendas.detalhe(farmId)
        : null;
    }
    case "INVITATION":
    default:
      return null;
  }
}
