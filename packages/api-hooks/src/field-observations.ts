"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getFieldObservations,
  updateFieldObservationStatus,
  type FieldObservationStatus,
} from "@recomenda/api/field-observations";
import { queryKeys } from "./queryKeys";

export function useFieldObservations(status?: FieldObservationStatus, producerId?: string) {
  return useQuery({
    queryKey: [...queryKeys.fieldObservations, status ?? "todas", producerId ?? "carteira"],
    queryFn: () =>
      getFieldObservations({
        ...(status ? { status } : {}),
        ...(producerId ? { producer_id: producerId } : {}),
      }),
  });
}

export function useUpdateFieldObservationStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: FieldObservationStatus }) =>
      updateFieldObservationStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.fieldObservations }),
  });
}
