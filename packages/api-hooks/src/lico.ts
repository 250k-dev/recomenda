"use client";

import { useQuery } from "@tanstack/react-query";
import { getLicoRoster } from "@recomenda/api";
import { queryKeys } from "./queryKeys";

export function useLicoRoster(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.licoRoster,
    queryFn: getLicoRoster,
    enabled: options?.enabled !== false,
  });
}
