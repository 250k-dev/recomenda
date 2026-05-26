"use client";

import { useQuery } from "@tanstack/react-query";
import { getNotifications } from "@/lib/api/notifications";
import { queryKeys } from "./queryKeys";

export function useNotifications() {
  return useQuery({ queryKey: queryKeys.notifications, queryFn: getNotifications });
}
