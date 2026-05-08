"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageHeader } from "@/components/domain/page-header";
import { TableRowsSkeleton } from "@/components/domain/page-skeletons";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/table";
import {
  useCreatePlot,
  useDeletePlot,
  useFarm,
  useFarmAccess,
  useFarmPlots,
  useGrantFarmAccess,
  useProducers,
  useRevokeFarmAccess,
  useUpdateFarm,
} from "@/lib/api/hooks";
import { activeAgronomistProducerAccounts } from "@/lib/api/client";
import { toast } from "sonner";

const farmSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  location: z.string().optional(),
});

const plotSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  area_hectares: z.number().positive("Área deve ser maior que zero"),
});

type FarmFormValues = z.infer<typeof farmSchema>;
type PlotFormValues = z.infer<typeof plotSchema>;

export default function FarmDetailPage() {
  const params = useParams<{ id: string }>();
  const farmId = params.id;

  const { data: farm } = useFarm(farmId);
  const updateFarm = useUpdateFarm(farmId);
  const { data: plots, isLoading: loadingPlots } = useFarmPlots(farmId);
  const { data: access, isLoading: loadingAccess } = useFarmAccess(farmId);
  const { data: producersData } = useProducers();
  const createPlot = useCreatePlot(farmId);
  const deletePlot = useDeletePlot(farmId);
  const grantAccess = useGrantFarmAccess(farmId);
  const revokeAccess = useRevokeFarmAccess(farmId);

  const [showPlotForm, setShowPlotForm] = useState(false);
  const [selectedProducer, setSelectedProducer] = useState("");

  const farmForm = useForm<FarmFormValues>({
    resolver: zodResolver(farmSchema),
    values: {
      name: farm?.name ?? "",
      location: farm?.location ?? "",
    },
  });

  const onUpdateFarm = farmForm.handleSubmit((values) => {
    updateFarm.mutate(values, {
      onSuccess: () => toast.success("Fazenda atualizada com sucesso!"),
      onError: () => toast.error("Erro ao atualizar fazenda"),
    });
  });

  const plotForm = useForm<PlotFormValues>({
    resolver: zodResolver(plotSchema),
    defaultValues: { name: "", area_hectares: 0 },
  });

  const onAddPlot = plotForm.handleSubmit((values) => {
    createPlot.mutate(values, {
      onSuccess: () => {
        setShowPlotForm(false);
        plotForm.reset();
      },
    });
  });

  const producers = producersData?.data ?? [];
  const grantableProducers = activeAgronomistProducerAccounts(producers);
  const grantedIds = new Set(access?.map((a) => a.producer_id) ?? []);
  const availableProducers = grantableProducers.filter((p) => !grantedIds.has(p.producer_id));
  const producerMap = new Map(grantableProducers.map((p) => [p.producer_id, p]));

  const plotRows =
    plots?.map((p) => [
      p.name,
      `${p.area_hectares} ha`,
      <Button
        key={`del-${p.id}`}
        variant="destructive"
        className="h-7 px-2 text-xs"
        disabled={deletePlot.isPending}
        onClick={() => deletePlot.mutate(p.id)}
      >
        Remover
      </Button>,
    ]) ?? [];

  const accessRows =
    access?.map((a) => {
      const producer = producerMap.get(a.producer_id);
      return [
        producer ? `${producer.name} (${producer.email})` : a.producer_id,
        new Date(a.granted_at).toLocaleDateString("pt-BR"),
        <Button
          key={`rev-${a.producer_id}`}
          variant="destructive"
          className="h-7 px-2 text-xs"
          disabled={revokeAccess.isPending}
          onClick={() => revokeAccess.mutate(a.producer_id)}
        >
          Revogar
        </Button>,
      ];
    }) ?? [];

  return (
    <>
      <Link href="/farms" className="mb-4 flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800">
        ← Voltar
      </Link>

      <PageHeader
        title={farm?.name ?? "Detalhes da fazenda"}
        description={farm?.location ?? ""}
      />

      <Card className="mb-6">
        <div className="mb-4 border-b border-zinc-200 pb-3">
          <h2 className="text-base font-semibold text-zinc-800">Editar fazenda</h2>
        </div>
        <form onSubmit={onUpdateFarm} className="flex flex-wrap items-end gap-4">
          <div className="min-w-48 flex-1">
            <label className="mb-1 block text-xs font-medium text-zinc-700">Nome</label>
            <Input {...farmForm.register("name")} placeholder="Nome da fazenda" />
            {farmForm.formState.errors.name && (
              <p className="mt-1 text-xs text-red-600">{farmForm.formState.errors.name.message}</p>
            )}
          </div>
          <div className="min-w-48 flex-1">
            <label className="mb-1 block text-xs font-medium text-zinc-700">Endereço</label>
            <Input {...farmForm.register("location")} placeholder="Ex: Município, Estado" />
          </div>
          <Button type="submit" disabled={updateFarm.isPending}>
            {updateFarm.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </form>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-800">Talhões</h2>
            <Button className="h-8 px-3 text-xs" onClick={() => setShowPlotForm((v) => !v)}>
              {showPlotForm ? "Cancelar" : "Adicionar talhão"}
            </Button>
          </div>

          {showPlotForm && (
            <Card className="mb-3">
              <form onSubmit={onAddPlot} className="flex flex-wrap items-end gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-zinc-600">Nome</label>
                  <Input {...plotForm.register("name")} placeholder="Ex: Talhão 1" />
                </div>
                <div className="w-32">
                  <label className="mb-1 block text-xs text-zinc-600">Área (ha)</label>
                  <Input
                    type="number"
                    step="0.01"
                    {...plotForm.register("area_hectares", { valueAsNumber: true })}
                  />
                </div>
                <Button type="submit" disabled={createPlot.isPending}>
                  {createPlot.isPending ? "..." : "Adicionar"}
                </Button>
              </form>
            </Card>
          )}

          {loadingPlots ? (
            <TableRowsSkeleton rows={6} columns={3} />
          ) : (
            <DataTable headers={["Nome", "Área", ""]} rows={plotRows} />
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-800">Acesso de Produtores</h2>
          </div>

          <Card className="mb-3">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-zinc-600">Adicionar produtor</label>
                <select
                  value={selectedProducer}
                  onChange={(e) => setSelectedProducer(e.target.value)}
                  className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-(--brand)"
                >
                  <option value="">Selecione...</option>
                  {availableProducers.map((p) => (
                    <option key={p.producer_id} value={p.producer_id}>
                      {p.name} — {p.email}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                disabled={!selectedProducer || grantAccess.isPending}
                onClick={() => {
                  if (selectedProducer) {
                    grantAccess.mutate(selectedProducer, {
                      onSuccess: () => setSelectedProducer(""),
                    });
                  }
                }}
              >
                Conceder
              </Button>
            </div>
          </Card>

          {loadingAccess ? (
            <TableRowsSkeleton rows={5} columns={3} />
          ) : (
            <DataTable headers={["Produtor ID", "Concedido em", ""]} rows={accessRows} />
          )}
        </section>
      </div>
    </>
  );
}
