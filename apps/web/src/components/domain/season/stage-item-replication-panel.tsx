"use client";

import { useEffect, useMemo, useState } from "react";
import type { SameStageRecommendation } from "@recomenda/api/seasons";
import {
  SameStageTargetPicker,
  allPendingSameStageIds,
} from "@/components/domain/export/application-data-ui";

/** Seleção de talhões para replicar produto — só enquanto o formulário está aberto. */
export function useReplicateTargetIds(rows: SameStageRecommendation[], active: boolean) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => allPendingSameStageIds(rows));
  const rowsKey = rows.map((row) => `${row.id}:${row.status}`).join("|");
  useEffect(() => {
    if (!active) return;
    setSelectedIds(allPendingSameStageIds(rows));
  }, [active, rowsKey, rows]);
  return [selectedIds, setSelectedIds] as const;
}

export function StageItemReplicationPicker({
  rows,
  loading,
  selectedIds,
  onSelectedIdsChange,
  title = "Aplicar também nos outros talhões",
  defaultExpanded = false,
}: {
  rows: SameStageRecommendation[];
  loading: boolean;
  selectedIds: Set<string>;
  onSelectedIdsChange: (next: Set<string>) => void;
  title?: string;
  defaultExpanded?: boolean;
}) {
  const pending = useMemo(() => rows.filter((row) => row.status === "PENDING"), [rows]);
  if (pending.length === 0) return null;

  return (
    <SameStageTargetPicker
      rows={rows}
      loading={loading}
      selectedIds={selectedIds}
      onSelectedIdsChange={onSelectedIdsChange}
      title={title}
      defaultExpanded={defaultExpanded}
    />
  );
}
