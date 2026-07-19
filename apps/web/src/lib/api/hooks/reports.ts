"use client";

import { useQuery } from "@tanstack/react-query";
import { getComparativeReport } from "@recomenda/api/reports";
import { queryKeys } from "./queryKeys";

export function useComparativeReport() {
  return useQuery({ queryKey: queryKeys.comparativeReport, queryFn: getComparativeReport });
}
