"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { markNotificationRead, type Notification } from "@/lib/api/client";
import { queryKeys, useNotifications } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

export function NotificationsBell({
  triggerClassName,
  align = "end",
}: {
  triggerClassName?: string;
  align?: "start" | "center" | "end";
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: notificationsResponse } = useNotifications();
  const [open, setOpen] = useState(false);

  const notificationsList = Array.isArray(notificationsResponse)
    ? notificationsResponse
    : (notificationsResponse?.data ?? []);
  const unreadCount = notificationsList.filter((n) => !n.read_at).length;

  const handleNotificationClick = (notification: Notification) => {
    const path = getNotificationPath(notification);
    setOpen(false);
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
      <PopoverContent align={align} className="p-0 w-80">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Notificações</p>
        </div>
        <div className="p-2 space-y-2 overflow-y-auto max-h-96">
          {notificationsList.length === 0 ? (
            <p className="py-8 text-sm text-center text-muted-foreground">
              Nenhuma notificação
            </p>
          ) : (
            notificationsList.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => handleNotificationClick(notification)}
                className="flex items-start w-full gap-3 p-3 text-left transition-all border shadow-sm rounded-xl border-border bg-card hover:border-primary/30 hover:bg-accent/60"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {getNotificationTitle(notification)}
                  </p>
                  {getNotificationBody(notification) ? (
                    <p className="mt-0.5 text-xs leading-relaxed text-foreground/80">
                      {getNotificationBody(notification)}
                    </p>
                  ) : null}
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
      </PopoverContent>
    </Popover>
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
    case "TEAM_ACTIVITY": {
      const farmId = payload?.farm_id;
      return typeof farmId === "string" && farmId ? `/farms/${farmId}` : null;
    }
    case "INVITATION":
    default:
      return null;
  }
}
