"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BreadcrumbBack, type BreadcrumbItem } from "@/components/domain/breadcrumb-back";
import { PageHero } from "@/components/domain/page-hero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useFarm,
  useFarmPlots,
  useFarmCycles,
  useProducer,
  useResolvedFarmProducerId,
  useUpdateFarm,
} from "@recomenda/api-hooks";
import { routes } from "@recomenda/config";
import { FarmCyclesSection } from "@/components/domain/farm-cycles-section";
import { toast } from "sonner";
import { Boxes, MapPin, Pencil, Tractor } from "lucide-react";

const farmSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  location: z.string().optional(),
});

type FarmFormValues = z.infer<typeof farmSchema>;

const fmtHa = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export default function FarmDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const farmId = params.id;
  const searchParams = useSearchParams();
  const producerId = searchParams.get("producer_id");

  const { data: farm } = useFarm(farmId);
  const { data: producer } = useProducer(producerId ?? "");
  const resolvedProducerId = useResolvedFarmProducerId(farmId, producerId);
  const updateFarm = useUpdateFarm(farmId);
  const { data: plots } = useFarmPlots(farmId);
  const { data: cycles } = useFarmCycles(farmId);

  const [editOpen, setEditOpen] = useState(false);

  const farmForm = useForm<FarmFormValues>({
    resolver: zodResolver(farmSchema),
    values: {
      name: farm?.name ?? "",
      location: farm?.location ?? "",
    },
  });

  const onUpdateFarm = farmForm.handleSubmit((values) => {
    updateFarm.mutate(values, {
      onSuccess: () => {
        toast.success("Fazenda atualizada com sucesso!");
        setEditOpen(false);
      },
      onError: () => toast.error("Erro ao atualizar fazenda"),
    });
  });

  const totalHectares = useMemo(
    () =>
      (plots ?? []).reduce((acc, p) => acc + (Number(p.area_hectares) || 0), 0),
    [plots],
  );

  // Conta safras (ciclos), não as programações por talhão dentro delas —
  // do contrário uma safra com 3 talhões aparecia como "3 safras ativas".
  const activeSeasonsCount = useMemo(
    () => (cycles ?? []).filter((c) => c.status === "ACTIVE").length,
    [cycles],
  );

  const plotsHref = routes.fazendas.talhoes(farmId, {
    producer_id: producerId,
  });
  const stockHref = routes.fazendas.estoque(farmId, {
    producer_id: producerId,
  });

  const breadcrumbs: BreadcrumbItem[] = [
    { label: "Produtores", href: routes.produtores.lista },
    ...(producerId && producer
      ? [{ label: producer.name, href: routes.produtores.detalhe(producerId) }]
      : []),
    { label: farm?.name ?? "Fazenda" },
  ];

  return (
    <>
      <BreadcrumbBack items={breadcrumbs} />

      <PageHero
        icon={<Tractor className="size-6" />}
        eyebrow="Fazenda"
        title={farm?.name ?? "Detalhes da fazenda"}
        titleAction={
          <Button
            variant="secondary"
            size="icon-xs"
            onClick={() => setEditOpen(true)}
          >
            <Pencil />
          </Button>
        }
        actions={
          <>
            <Button asChild variant="outline" className="gap-2">
              <Link href={stockHref}>
                <Boxes className="size-4" />
                Estoque
              </Link>
            </Button>
            <Button asChild variant="clay" className="gap-2">
              <Link href={plotsHref}>
                <MapPin className="size-4" />
                Gerenciar talhões
              </Link>
            </Button>
          </>
        }
        stats={[
          {
            label: "Localização",
            value: farm?.location?.trim() || "Não cadastrada",
          },
          {
            label: "Talhões",
            value: plots?.length ?? 0,
            onClick: () => router.push(plotsHref),
          },
          { label: "Área total", value: `${fmtHa(totalHectares)} ha` },
          { label: "Safras ativas", value: activeSeasonsCount },
        ]}
      />

      <section>
        <FarmCyclesSection farmId={farmId} producerId={resolvedProducerId} />
      </section>

      {/* Editar fazenda */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar fazenda</DialogTitle>
          </DialogHeader>
          <form onSubmit={onUpdateFarm}>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">
                  Nome
                </label>
                <Input
                  {...farmForm.register("name")}
                  placeholder="Nome da fazenda"
                />
                {farmForm.formState.errors.name && (
                  <p className="mt-1 text-xs text-destructive">
                    {farmForm.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">
                  Endereço
                </label>
                <Input
                  {...farmForm.register("location")}
                  placeholder="Ex: Município, Estado"
                />
              </div>
            </div>
            <DialogFooter className="sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={updateFarm.isPending}>
                {updateFarm.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
