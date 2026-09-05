"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { createBillingCheckout, getPlanCatalog } from "@recomenda/api/billing";
import { queryKeys } from "./queryKeys";

export function usePlanCatalog() {
  return useQuery({
    queryKey: queryKeys.planCatalog,
    queryFn: getPlanCatalog,
  });
}

export function useCreateBillingCheckout() {
  return useMutation({
    mutationFn: createBillingCheckout,
  });
}
