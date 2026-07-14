"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BreadcrumbBack } from "@/components/domain/breadcrumb-back";
import { EntityHero } from "@/components/domain/entity-hero";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  useFarm,
  useFarmAccess,
  useFarmPlots,
  useFarmCycles,
  useProducer,
  useUpdateFarm,
} from "@/lib/api/hooks";
import { FarmCyclesSection } from "@/components/domain/farm-cycles-section";
import { ProducerStockSection } from "@/components/domain/producer-stock-section";
import { toast } from "sonner";
import { MapPin, Pencil, Tractor } from "lucide-react";

const farmSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  location: z.string().optional(),
});

type FarmFormValues = z.infer<typeof farmSchema>;

type FarmViewTab = "seasons" | "plots" | "stock";

const fmtHa = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

function parseFarmViewTab(value: string | null): FarmViewTab {
  if (value === "plots" || value === "seasons" || value === "stock") {
    return value;
  }
  // Links legados com tab=purchase caem nas safras (a lista vive na safra).
  return "seasons";
}

export default function FarmDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const farmId = params.id;
  const searchParams = useSearchParams();
  const producerId = searchParams.get("producer_id");
  const tabFromUrl = parseFarmViewTab(searchParams.get("tab"));

  const { data: farm } = useFarm(farmId);
  const { data: producer } = useProducer(producerId ?? "");
  const { data: access } = useFarmAccess(farmId);

  const resolvedProducerId = useMemo(() => {
    if (producerId) return producerId;
    if (access?.length === 1) return access[0].producer_id;
    return null;
  }, [producerId, access]);
  const updateFarm = useUpdateFarm(farmId);
  const { data: plots } = useFarmPlots(farmId);
  const { data: cycles } = useFarmCycles(farmId);

  const [editOpen, setEditOpen] = useState(false);

  const setFarmViewWithUrl = useCallback(
    (tab: FarmViewTab) => {
      const next = new URLSearchParams(searchParams.toString());
      next.set("tab", tab);
      router.replace(`?${next.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

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
      (plots ?? []).reduce(
        (acc, p) => acc + (Number(p.area_hectares) || 0),
        0,
      ),
    [plots],
  );

  // Conta safras (ciclos), não as programações por talhão dentro delas —
  // do contrário uma safra com 3 talhões aparecia como "3 safras ativas".
  const activeSeasonsCount = useMemo(
    () => (cycles ?? []).filter((c) => c.status === "ACTIVE").length,
    [cycles],
  );

  const plotsHref = producerId
    ? `/farms/${farmId}/plots?producer_id=${encodeURIComponent(producerId)}`
    : `/farms/${farmId}/plots`;

  // A gestão de talhões virou tela própria — links legados `?tab=plots`
  // (que abriam o painel lateral) caem direto nela.
  useEffect(() => {
    if (tabFromUrl === "plots") router.replace(plotsHref);
  }, [tabFromUrl, plotsHref, router]);

  const breadcrumbs = [
    { label: "Produtores", href: "/producers" },
    ...(producerId && producer
      ? [{ label: producer.name, href: `/producers/${producerId}` }]
      : []),
    { label: farm?.name ?? "Fazenda" },
  ];

  return (
    <>
      <BreadcrumbBack items={breadcrumbs} />

      <EntityHero
        icon={<Tractor className="size-6" />}
        eyebrow="Fazenda"
        title={farm?.name ?? "Detalhes da fazenda"}
        meta={farm?.location?.trim() || "Sem localização cadastrada"}
        actions={
          <>
            <Button asChild variant="outline" className="gap-2">
              <Link href={plotsHref}>
                <MapPin className="size-4" />
                Gerenciar talhões
              </Link>
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="size-4" />
              Editar
            </Button>
          </>
        }
        stats={
          tabFromUrl !== "stock"
            ? [
                {
                  label: "Talhões",
                  value: plots?.length ?? 0,
                  onClick: () => router.push(plotsHref),
                },
                { label: "Área total", value: `${fmtHa(totalHectares)} ha` },
                { label: "Safras ativas", value: activeSeasonsCount },
              ]
            : undefined
        }
      />

      {tabFromUrl === "stock" ? (
        <section>
          <div className="mb-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              onClick={() => setFarmViewWithUrl("seasons")}
            >
              ← Voltar às safras
            </Button>
          </div>
          {resolvedProducerId ? (
            <ProducerStockSection producerId={resolvedProducerId} />
          ) : (
            <EmptyState
              title="Produtor não vinculado"
              description="Associe um produtor a esta fazenda para gerenciar o estoque."
            />
          )}
        </section>
      ) : (
        <section>
          <FarmCyclesSection
            farmId={farmId}
            producerId={resolvedProducerId}
          />
        </section>
      )}

      {/* Editar fazenda */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Editar fazenda</SheetTitle>
          </SheetHeader>
          <form onSubmit={onUpdateFarm} className="space-y-4 px-4 pb-4">
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
            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                disabled={updateFarm.isPending}
                className="flex-1"
              >
                {updateFarm.isPending ? "Salvando..." : "Salvar"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
