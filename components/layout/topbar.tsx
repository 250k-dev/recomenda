"use client";

import { Bell } from "lucide-react";
import { useNotifications, usePlanQuota } from "@/lib/api/hooks";

export function Topbar() {
  const { data: quota } = usePlanQuota();
  const { data: notifications } = useNotifications();
  const unreadCount = notifications?.data?.length ?? 0;

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-6">
      <div>
        <h1 className="text-sm font-semibold text-zinc-900">Recomenda</h1>
        <p className="text-xs text-zinc-500">
          Quota ativa: {quota?.current ?? 0} / {quota?.limit ?? 0}
        </p>
      </div>
      <div className="flex items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-700">
        <Bell className="h-4 w-4" />
        <span>{unreadCount}</span>
      </div>
    </header>
  );
}
