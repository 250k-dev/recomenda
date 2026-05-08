"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/domain/page-header";
import {
  PageHeaderSkeleton,
  TableRowsSkeleton,
  TimelineCardsSkeleton,
} from "@/components/domain/page-skeletons";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  useSeason,
  useSeasonTimeline,
  useSeasonShoppingList,
  useProducerStock,
  usePublishSeason,
} from "@/lib/api/hooks";

const CROP_LABELS: Record<string, string> = {
  SOYBEAN: "Soja",
  CORN: "Milho",
};

const STATUS_LABELS_SEASON: Record<string, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicada",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluída",
  ARCHIVED: "Removida",
};

const tabs = ["Linha do tempo", "Lista de compras", "Estoque", "Auditoria"] as const;
type Tab = (typeof tabs)[number];

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  APPLIED_ON_TIME: "Aplicado no prazo",
  APPLIED_LATE: "Aplicado com atraso",
  SKIPPED: "Pulado",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "text-zinc-500",
  APPLIED_ON_TIME: "text-green-600",
  APPLIED_LATE: "text-yellow-600",
  SKIPPED: "text-red-500",
};

type ShoppingListRow = {
  local_product_id: string;
  product_name?: string;
  dose_unit?: string;
  total_quantity?: number;
  quantity_to_buy?: number;
  current_stock?: number;
};

function TimelineTab({ seasonId }: { seasonId: string }) {
  const { data: recommendations, isLoading } = useSeasonTimeline(seasonId);
  if (isLoading) return <TimelineCardsSkeleton count={5} />;
  if (!recommendations?.length)
    return <p className="text-sm text-zinc-500">Nenhuma recomendação encontrada.</p>;

  return (
    <ul className="flex flex-col gap-3">
      {(recommendations as Record<string, unknown>[]).map((rec) => (
        <li key={rec.id as string} className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium text-zinc-900">{rec.name as string}</p>
              <p className={`text-xs ${STATUS_COLORS[rec.status as string] ?? "text-zinc-500"}`}>
                {STATUS_LABELS[rec.status as string] ?? (rec.status as string)}
              </p>
            </div>
            <div className="text-right text-xs text-zinc-500">
              {rec.predicted_date_current ? (
                <div>
                  Previsto:{" "}
                  {new Date(rec.predicted_date_current as string).toLocaleDateString("pt-BR")}
                </div>
              ) : null}
              {rec.executed_date ? (
                <div>
                  Executado:{" "}
                  {new Date(rec.executed_date as string).toLocaleDateString("pt-BR")}
                </div>
              ) : null}
            </div>
          </div>
          {rec.notes ? <p className="mt-2 text-xs text-zinc-500">{rec.notes as string}</p> : null}
        </li>
      ))}
    </ul>
  );
}

function ShoppingListTab({ seasonId }: { seasonId: string }) {
  const { data: items, isLoading } = useSeasonShoppingList(seasonId);
  if (isLoading) return <TableRowsSkeleton rows={6} columns={4} />;
  if (!items?.length) return <p className="text-sm text-zinc-500">Nenhum produto necessário. Verifique se a safra está publicada e os estágios têm receitas vinculadas.</p>;

  const rows =
    (items as ShoppingListRow[]).map((item) => {
      const unit = item.dose_unit || "un";
      const needToBuy = item.quantity_to_buy ?? item.total_quantity ?? 0;
      return [
        item.product_name ?? item.local_product_id,
        `${Number(item.total_quantity).toFixed(2)} ${unit}`,
        `${Number(item.current_stock ?? 0).toFixed(2)} ${unit}`,
        <span key={item.local_product_id} className={needToBuy > 0 ? "font-medium text-red-600" : "text-green-600"}>
          {needToBuy > 0 ? `${Number(needToBuy).toFixed(2)} ${unit}` : "Estoque OK"}
        </span>,
      ];
    }) ?? [];

  return <DataTable headers={["Produto", "Total necessário", "Estoque atual", "A comprar"]} rows={rows} />;
}

function StockTab({ producerId }: { producerId: string }) {
  const { data: stock, isLoading } = useProducerStock(producerId || "");
  if (!producerId) return <p className="text-sm text-zinc-500">Produtor não identificado.</p>;
  if (isLoading) return <TableRowsSkeleton rows={6} columns={2} />;

  const rows =
    stock?.map((s) => [
      s.product_name ?? s.local_product_id,
      `${s.quantity} ${s.dose_unit ?? "un"}`,
    ]) ?? [];

  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">Nenhum produto em estoque.</p>;
  }

  return <DataTable headers={["Produto", "Estoque atual"]} rows={rows} />;
}

export default function SeasonDetailPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Linha do tempo");
  const params = useParams<{ id: string }>();
  const seasonId = params.id;

  // Todos os hooks devem ser chamados antes de qualquer condicional
  const publishMutation = usePublishSeason(seasonId || "");
  const { data: season, isLoading: loadingSeason } = useSeason(seasonId || "");

  if (!seasonId) {
    return <p className="text-sm text-red-600">ID da safra não encontrado.</p>;
  }

  const cropLabel = season ? (CROP_LABELS[season.crop] ?? season.crop) : "";
  const statusLabel = season ? (STATUS_LABELS_SEASON[season.status] ?? season.status) : "";
  const description = season ? `${cropLabel} · ${statusLabel}` : "";

  const handlePublish = () => {
    publishMutation.mutate([], {
      onSuccess: () => {
        toast.success("Safra publicada com sucesso!");
      },
      onError: (error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Falha ao publicar safra";
        toast.error(`Erro: ${message || "Falha ao publicar safra"}`);
      },
    });
  };

  return (
    <>
      <Link href="/seasons" className="mb-4 flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800">
        ← Voltar
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex-1">
          {loadingSeason ? (
            <PageHeaderSkeleton withAction />
          ) : (
            <PageHeader title={cropLabel || "Safra"} description={description} />
          )}
        </div>
        {season?.status === "DRAFT" && (
          <Button
            className="mt-1 h-10"
            onClick={handlePublish}
            disabled={publishMutation.isPending}
          >
            {publishMutation.isPending ? "Publicando..." : "Publicar safra"}
          </Button>
        )}
      </div>

      <div className="mb-4 flex gap-1 border-b border-zinc-200 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              activeTab === tab
                ? "bg-[var(--brand)] text-white"
                : "text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Linha do tempo" && <TimelineTab seasonId={seasonId} />}
      {activeTab === "Lista de compras" && <ShoppingListTab seasonId={seasonId} />}
      {activeTab === "Estoque" && (
        loadingSeason ? (
          <TableRowsSkeleton rows={5} columns={2} />
        ) : season ? (
          <StockTab producerId={season.producer_id} />
        ) : (
          <p className="text-sm text-zinc-500">Dados da safra não encontrados.</p>
        )
      )}
      {activeTab === "Auditoria" && (
        <Card>
          <p className="text-sm text-zinc-500">Auditoria disponível em breve.</p>
        </Card>
      )}
    </>
  );
}
