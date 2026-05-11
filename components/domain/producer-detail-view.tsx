"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/domain/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/table";
import {
  useImpersonateProducer,
  useProducer,
  useProducerStock,
  useProducerFarms,
  useUpdateProducer,
  useRemoveFarmAccess,
} from "@/lib/api/hooks";
import { ProducerDetailSkeleton, CompactListSkeleton } from "@/components/domain/page-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicada",
  IN_PROGRESS: "Em andamento",
  HARVESTED: "Colhida",
  ARCHIVED: "Removida",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  DRAFT: "secondary",
  PUBLISHED: "default",
  IN_PROGRESS: "default",
  HARVESTED: "outline",
  ARCHIVED: "secondary",
};

const CROP_LABELS: Record<string, string> = {
  SOYBEAN: "Soja",
  CORN: "Milho",
};

export type ProducerDetailViewProps = {
  producerId: string;
  backHref: string;
  /** Quando false, não exibe o atalho para a página de safra (fluxo do agrônomo). */
  showSeasonActions: boolean;
  /** Painel do agrônomo: personificar produtor. Admin só consulta — padrão true. */
  showImpersonate?: boolean;
};

export function ProducerDetailView({
  producerId,
  backHref,
  showSeasonActions,
  showImpersonate = true,
}: ProducerDetailViewProps) {
  const router = useRouter();
  const { data: producer, isLoading } = useProducer(producerId);
  const { data: stock, isLoading: loadingStock } = useProducerStock(producerId);
  const { data: farms, isLoading: loadingFarms } = useProducerFarms(producerId);
  const impersonateMutation = useImpersonateProducer();
  const updateProducer = useUpdateProducer(producerId);
  const removeFarmAccess = useRemoveFarmAccess(producerId);

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");

  useEffect(() => {
    if (producer?.name != null) setEditedName(producer.name);
  }, [producer?.name]);

  const handleSaveName = () => {
    if (editedName.trim() && editedName !== producer?.name) {
      updateProducer.mutate(
        { name: editedName },
        {
          onSuccess: () => setIsEditingName(false),
        },
      );
    } else {
      setIsEditingName(false);
    }
  };

  if (isLoading) return <ProducerDetailSkeleton />;
  if (!producer) return <p className="text-sm text-red-600 p-6">Produtor não encontrado.</p>;

  const stockRows =
    stock?.map((s) => [s.product_name ?? s.local_product_id, `${s.quantity} ${s.dose_unit ?? "un"}`]) ?? [];

  return (
    <>
      <Link href={backHref} className="mb-4 flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800">
        ← Voltar
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4">
        <PageHeader title={producer.name} description={producer.email} />
        {showImpersonate ? (
          <Button
            variant="secondary"
            disabled={impersonateMutation.isPending}
            onClick={() => impersonateMutation.mutate(producerId)}
          >
            {impersonateMutation.isPending ? "Acessando..." : "Acessar como produtor"}
          </Button>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Informações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Nome</dt>
                {isEditingName ? (
                  <div className="flex gap-2">
                    <Input
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="h-8 text-sm"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      disabled={updateProducer.isPending}
                      onClick={handleSaveName}
                    >
                      {updateProducer.isPending ? "..." : "Salvar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8"
                      onClick={() => {
                        setIsEditingName(false);
                        setEditedName(producer.name);
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <dd className="font-medium text-foreground">{producer.name}</dd>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs"
                      onClick={() => {
                        setIsEditingName(true);
                        setEditedName(producer.name);
                      }}
                    >
                      Editar
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">E-mail</dt>
                <dd className="font-medium text-foreground">{producer.email}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">ID</dt>
                <dd className="font-mono text-xs text-muted-foreground">{producer.id}</dd>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estoque atual</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStock ? (
              <CompactListSkeleton rows={6} />
            ) : stockRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum produto em estoque.</p>
            ) : (
              <div className="space-y-2">
                {stockRows.map((row, idx) => (
                  <div key={idx} className="flex justify-between border-b pb-2 last:border-b-0 text-sm">
                    <span className="text-foreground">{row[0]}</span>
                    <span className="text-muted-foreground">{row[1]}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {loadingFarms ? (
        <div className="mt-6 space-y-4" aria-hidden>
          <Skeleton className="h-40 w-full rounded-xl border border-border" />
          <Skeleton className="h-40 w-full rounded-xl border border-border" />
        </div>
      ) : !farms || farms.length === 0 ? (
        <div className="mt-6 p-6 text-center text-sm text-zinc-500">Nenhuma fazenda vinculada a este produtor.</div>
      ) : (
        <div className="mt-6 space-y-6">
          {farms.map((farm) => (
            <Card key={farm.id}>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {farm.name}
                    {farm.location && (
                      <span className="text-sm font-normal text-muted-foreground ml-2">· {farm.location}</span>
                    )}
                  </CardTitle>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-8 px-3 text-xs"
                  disabled={removeFarmAccess.isPending}
                  onClick={() => {
                    if (
                      globalThis.confirm(
                        `Remover acesso à fazenda "${farm.name}"? Esta ação não pode ser desfeita.`,
                      )
                    ) {
                      removeFarmAccess.mutate(farm.id);
                    }
                  }}
                >
                  {removeFarmAccess.isPending ? "..." : "Remover"}
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-medium text-sm mb-3 text-foreground">Talhões</h3>
                  {farm.plots.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum talhão cadastrado.</p>
                  ) : (
                    <DataTable
                      headers={["Nome", "Área"]}
                      rows={farm.plots.map((plot) => [
                        plot.name,
                        `${parseFloat(plot.area_hectares).toFixed(2)} ha`,
                      ])}
                    />
                  )}
                </div>

                <div>
                  <h3 className="font-medium text-sm mb-3 text-foreground">Safras</h3>
                  {farm.seasons.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma safra vinculada.</p>
                  ) : (
                    <div className="space-y-2">
                      {farm.seasons.map((season) => (
                        <div
                          key={season.id}
                          className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 hover:border-zinc-300 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant={STATUS_VARIANTS[season.status] || "default"}>
                              {STATUS_LABELS[season.status] || season.status}
                            </Badge>
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {CROP_LABELS[season.crop] || season.crop} — {season.variety}
                              </p>
                              <p className="text-xs text-muted-foreground">{season.plot_name}</p>
                            </div>
                          </div>
                          {showSeasonActions ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-3 text-xs"
                              onClick={() => router.push(`/seasons/${season.id}`)}
                            >
                              Ver safra →
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">Painel do consultor</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
