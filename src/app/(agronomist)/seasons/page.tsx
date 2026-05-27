"use client";

import Link from "next/link";
import { useState } from "react";
import { Info, Leaf, Plus } from "lucide-react";

import { PageHeader } from "@/components/domain/page-header";
import { SegmentedTabs } from "@/components/domain/segmented-tabs";
import { DeletePermanentIconButton } from "@/components/domain/delete-permanent-icon-button";
import { TableRowsSkeleton } from "@/components/domain/page-skeletons";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  useArchiveSeason,
  useArchivedSeasons,
  useHardDeleteSeason,
  useSeasons,
} from "@/lib/api/hooks";
import { deactivateOutlineButtonClass } from "@/lib/action-button-styles";
import { cn } from "@/lib/utils";

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

const STATUS_CLASSES: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PUBLISHED: "bg-sky-100 text-sky-600",
  IN_PROGRESS: "bg-primary/15 text-primary",
  COMPLETED: "bg-primary/15 text-primary",
  ARCHIVED: "bg-orange-100 text-orange-600",
};

interface SeasonRow {
  id: string;
  crop: string;
  status: string;
  farm_name?: string | null;
  plot_name?: string | null;
}

export default function SeasonsPage() {
  const { data, isLoading: loadingActiveSeasons } = useSeasons();
  const { data: archivedData, isLoading: isLoadingArchived } = useArchivedSeasons();
  const archiveMutation = useArchiveSeason();
  const hardDeleteMutation = useHardDeleteSeason();
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [archiveConfirm, setArchiveConfirm] = useState<{ id: string; name: string } | null>(null);
  const [hardDeleteConfirm, setHardDeleteConfirm] = useState<{ id: string; name: string } | null>(
    null,
  );

  const seasonsRaw = (Array.isArray(data) ? data : data?.data ?? []) as SeasonRow[];
  const seasons = seasonsRaw.filter((s) => s.status !== "ARCHIVED");
  const archived = (Array.isArray(archivedData) ? archivedData : []) as SeasonRow[];

  const formatDisplay = (season: SeasonRow) => {
    const parts: string[] = [CROP_LABELS[season.crop] ?? season.crop];
    if (season.farm_name) parts.push(season.farm_name);
    if (season.plot_name) parts.push(season.plot_name);
    return parts.join(" · ");
  };

  const makeRow = (season: SeasonRow, isActive: boolean) => {
    const statusLabel = STATUS_LABELS[season.status] ?? season.status;
    const statusClass = STATUS_CLASSES[season.status] ?? "bg-muted text-muted-foreground";
    const displayName = formatDisplay(season);

    return [
      isActive ? (
        <Link
          key={season.id}
          href={`/seasons/${season.id}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {displayName}
        </Link>
      ) : (
        <span key={season.id} className="font-medium text-foreground">
          {displayName}
        </span>
      ),
      <span
        key={`status-${season.id}`}
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
          statusClass,
        )}
      >
        {statusLabel}
      </span>,
      isActive ? (
        <div key={`actions-${season.id}`} className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            className={cn(deactivateOutlineButtonClass)}
            onClick={() => setArchiveConfirm({ id: season.id, name: displayName })}
          >
            Remover
          </Button>
        </div>
      ) : (
        <div key={`archived-actions-${season.id}`} className="flex justify-end">
          <DeletePermanentIconButton
            disabled={hardDeleteMutation.isPending}
            onClick={() => setHardDeleteConfirm({ id: season.id, name: displayName })}
          />
        </div>
      ),
    ];
  };

  const activeRows = seasons.map((s) => makeRow(s, true));
  const archivedRows = archived.map((s) => makeRow(s, false));

  return (
    <>
      <PageHeader
        icon={<Leaf className="h-5 w-5" />}
        section="Planejamento"
        title="Safras"
        description="Gestão de ciclo, timeline e status de execução."
        action={
          tab === "active" ? (
            <Link href="/seasons/new">
              <Button>
                <Plus className="h-4 w-4" />
                Nova safra
              </Button>
            </Link>
          ) : null
        }
      />

      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertTitle>Atalho disponível</AlertTitle>
        <AlertDescription>
          O fluxo recomendado agora é:{" "}
          <Link
            href="/producers"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Produtores
          </Link>{" "}
          → Fazenda → Safra.
        </AlertDescription>
      </Alert>

      <div className="mb-4">
        <SegmentedTabs
          value={tab}
          onValueChange={setTab}
          items={[
            { value: "active", label: "Ativas" },
            { value: "archived", label: "Removidas", badgeCount: archived.length },
          ]}
        />
      </div>

      {tab === "active" ? (
        loadingActiveSeasons ? (
          <TableRowsSkeleton rows={8} columns={3} />
        ) : activeRows.length === 0 ? (
          <EmptyState
            icon={Leaf}
            title="Nenhuma safra ativa"
            description="Crie uma nova safra a partir do fluxo Produtor → Fazenda → Safra."
            action={
              <Link href="/producers">
                <Button>Ir para Produtores</Button>
              </Link>
            }
          />
        ) : (
          <DataTable headers={["Safra", "Status", ""]} rows={activeRows} />
        )
      ) : isLoadingArchived ? (
        <TableRowsSkeleton rows={6} columns={3} />
      ) : archivedRows.length === 0 ? (
        <EmptyState icon={Leaf} title="Nenhuma safra removida" variant="inline" />
      ) : (
        <DataTable headers={["Safra", "Status", ""]} rows={archivedRows} />
      )}

      <ConfirmDialog
        open={!!archiveConfirm}
        onOpenChange={(open) => !open && setArchiveConfirm(null)}
        title="Remover safra"
        description={
          archiveConfirm
            ? `A safra "${archiveConfirm.name}" será movida para Removidas.`
            : undefined
        }
        confirmLabel="Remover"
        tone="destructive"
        loading={archiveMutation.isPending}
        onConfirm={async () => {
          if (!archiveConfirm) return;
          await new Promise<void>((resolve, reject) =>
            archiveMutation.mutate(archiveConfirm.id, {
              onSuccess: () => {
                setArchiveConfirm(null);
                resolve();
              },
              onError: (err) => reject(err),
            }),
          );
        }}
      />

      <ConfirmDialog
        open={!!hardDeleteConfirm}
        onOpenChange={(open) => !open && setHardDeleteConfirm(null)}
        title="Excluir permanentemente"
        description={
          hardDeleteConfirm
            ? `Excluir "${hardDeleteConfirm.name}" permanentemente? Esta ação não pode ser desfeita.`
            : undefined
        }
        confirmLabel="Excluir"
        tone="destructive"
        loading={hardDeleteMutation.isPending}
        onConfirm={async () => {
          if (!hardDeleteConfirm) return;
          await new Promise<void>((resolve, reject) =>
            hardDeleteMutation.mutate(hardDeleteConfirm.id, {
              onSuccess: () => {
                setHardDeleteConfirm(null);
                resolve();
              },
              onError: (err) => reject(err),
            }),
          );
        }}
      />
    </>
  );
}
