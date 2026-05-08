"use client";

import Link from "next/link";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { PageHeader } from "@/components/domain/page-header";
import { TableRowsSkeleton } from "@/components/domain/page-skeletons";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/table";
import {
  useArchiveSeason,
  useArchivedSeasons,
  useHardDeleteSeason,
  useSeasons,
} from "@/lib/api/hooks";

const CROP_LABELS: Record<string, string> = {
  SOYBEAN: "Soja",
  CORN: "Milho",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicada",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluída",
  ARCHIVED: "Removida",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700",
  PUBLISHED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-green-100 text-green-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  ARCHIVED: "bg-orange-100 text-orange-700",
};

export default function SeasonsPage() {
  const { data, isLoading: loadingActiveSeasons } = useSeasons();
  const { data: archivedData, isLoading: isLoadingArchived } = useArchivedSeasons();
  const archiveMutation = useArchiveSeason();
  const hardDeleteMutation = useHardDeleteSeason();
  const [tab, setTab] = useState<"active" | "archived">("active");

  const seasons = (Array.isArray(data) ? data : data?.data ?? []).filter(
    (s: any) => s.status !== "ARCHIVED"
  );
  const archived = Array.isArray(archivedData) ? archivedData : [];

  const makeRow = (season: any, showArchive: boolean) => {
    const cropLabel = CROP_LABELS[season.crop] ?? season.crop;
    const statusLabel = STATUS_LABELS[season.status] ?? season.status;
    const statusColor = STATUS_COLORS[season.status] ?? "bg-zinc-100 text-zinc-700";

    const parts = [cropLabel];
    if (season.farm_name) parts.push(season.farm_name);
    if (season.plot_name) parts.push(season.plot_name);
    const displayName = parts.join(" • ");

    return [
      showArchive ? (
        <Link
          key={season.id}
          href={`/seasons/${season.id}`}
          className="font-medium text-[var(--brand)] underline"
        >
          {displayName}
        </Link>
      ) : (
        <span key={season.id} className="font-medium text-zinc-700">{displayName}</span>
      ),
      <span key={`status-${season.id}`} className={`inline-block rounded px-2 py-1 text-xs font-medium ${statusColor}`}>
        {statusLabel}
      </span>,
      showArchive ? (
        <div key={`actions-${season.id}`} className="flex gap-2">
          <Button
            variant="outline"
            className="h-8 px-3 text-xs border-orange-300 bg-orange-50 text-orange-600 hover:bg-orange-100 hover:text-orange-700"
            disabled={archiveMutation.isPending}
            onClick={() => archiveMutation.mutate(season.id)}
          >
            Remover
          </Button>
        </div>
      ) : (
        <div key={`archived-actions-${season.id}`} className="flex gap-2">
          <Button
            variant="destructive"
            size="icon"
            className="h-8 w-8"
            disabled={hardDeleteMutation.isPending}
            title="Excluir permanentemente"
            onClick={() => {
              if (confirm(`Excluir permanentemente a safra "${displayName}"? Esta ação não pode ser desfeita.`)) {
                hardDeleteMutation.mutate(season.id);
              }
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    ];
  };

  const activeRows = seasons.map((s: any) => makeRow(s, true));
  const archivedRows = archived.map((s: any) => makeRow(s, false));

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <PageHeader title="Safras" description="Gestão de ciclo, timeline e status de execução." />
        {tab === "active" && (
          <Link href="/seasons/new">
            <Button>Nova safra</Button>
          </Link>
        )}
      </div>

      <div className="mb-4 flex gap-1 rounded-lg border border-zinc-200 bg-zinc-100 p-1 w-fit">
        <button
          onClick={() => setTab("active")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === "active"
              ? "bg-white text-zinc-900 shadow-sm"
              : "text-zinc-500 hover:text-zinc-800"
          }`}
        >
          Ativas
        </button>
        <button
          onClick={() => setTab("archived")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === "archived"
              ? "bg-white text-zinc-900 shadow-sm"
              : "text-zinc-500 hover:text-zinc-800"
          }`}
        >
          Removidas
          {archived.length > 0 && (
            <span className="ml-2 rounded-full bg-zinc-300 px-1.5 py-0.5 text-xs text-zinc-700">
              {archived.length}
            </span>
          )}
        </button>
      </div>

      {tab === "active" ? (
        loadingActiveSeasons ? (
          <TableRowsSkeleton rows={8} columns={3} />
        ) : (
          <DataTable headers={["Safra", "Status", ""]} rows={activeRows} />
        )
      ) : isLoadingArchived ? (
        <TableRowsSkeleton rows={6} columns={3} />
      ) : archivedRows.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhuma safra removida.</p>
      ) : (
        <DataTable headers={["Safra", "Status", ""]} rows={archivedRows} />
      )}
    </>
  );
}
