"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { BreadcrumbBack, type BreadcrumbItem } from "@/components/domain/breadcrumb-back";
import { PageHero } from "@/components/domain/page-hero";
import { FarmLocationFields } from "@/components/domain/farm-location-fields";
import { Button } from "@recomenda/ui/primitives/button";
import { Input } from "@recomenda/ui/primitives/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recomenda/ui/primitives/dialog";
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
import { FarmPlotsSection } from "@/components/domain/farm-plots-section";
import { optionalFarmLocation, parseFarmLocation } from "@recomenda/utils";
import { toast } from "sonner";
import { Boxes, Pencil, Tractor } from "lucide-react";

const fmtHa = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export default function FarmDetailPage() {
  const params = useParams<{ id: string }>();
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
  const [editName, setEditName] = useState("");
  const [editStateUf, setEditStateUf] = useState("");
  const [editCity, setEditCity] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  // Semeia o formulário ao abrir o dialog (evita useEffect + setState).
  const editSeed = editOpen && farm ? `${farm.id}:${farm.name}:${farm.location ?? ""}` : null;
  const [prevEditSeed, setPrevEditSeed] = useState<string | null>(null);
  if (editSeed !== prevEditSeed) {
    setPrevEditSeed(editSeed);
    if (editSeed && farm) {
      setEditName(farm.name ?? "");
      const parsed = parseFarmLocation(farm.location);
      setEditStateUf(parsed.uf);
      setEditCity(parsed.city);
      setNameError(null);
    }
  }

  const onUpdateFarm = () => {
    if (!editName.trim()) {
      setNameError("Nome obrigatório");
      return;
    }
    setNameError(null);
    updateFarm.mutate(
      {
        name: editName.trim(),
        location: optionalFarmLocation(editCity, editStateUf) ?? "",
      },
      {
        onSuccess: () => {
          toast.success("Fazenda atualizada com sucesso!");
          setEditOpen(false);
        },
        onError: () => toast.error("Erro ao atualizar fazenda"),
      },
    );
  };

  const totalHectares = useMemo(
    () =>
      (plots ?? []).reduce((acc, p) => acc + (Number(p.area_hectares) || 0), 0),
    [plots],
  );

  const activeSeasonsCount = useMemo(
    () => (cycles ?? []).filter((c) => c.status === "ACTIVE").length,
    [cycles],
  );

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
          <Button asChild variant="outline" className="gap-2">
            <Link href={stockHref}>
              <Boxes className="size-4" />
              Estoque
            </Link>
          </Button>
        }
        stats={[
          {
            label: "Localização",
            value: farm?.location?.trim() || "Não cadastrada",
          },
          {
            label: "Talhões",
            value: plots?.length ?? 0,
            onClick: () =>
              document
                .getElementById("talhoes-cadastrados")
                ?.scrollIntoView({ behavior: "smooth", block: "start" }),
          },
          { label: "Área total", value: `${fmtHa(totalHectares)} ha` },
          { label: "Safras ativas", value: activeSeasonsCount },
        ]}
      />

      <div className="space-y-10">
        <section>
          <FarmCyclesSection
            farmId={farmId}
            producerId={resolvedProducerId}
            showCreateCycle={false}
          />
        </section>

        <div id="talhoes-cadastrados">
          <FarmPlotsSection farmId={farmId} />
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar fazenda</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 py-5">
            <div className="space-y-1.5">
              <label className="mb-1.5 block text-xs font-medium text-foreground">
                Nome
              </label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nome da fazenda"
              />
              {nameError ? (
                <p className="mt-1 text-xs text-destructive">{nameError}</p>
              ) : null}
            </div>
            <FarmLocationFields
              idPrefix="edit-farm"
              stateUf={editStateUf}
              city={editCity}
              onStateChange={setEditStateUf}
              onCityChange={setEditCity}
            />
          </div>
          <DialogFooter className="sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEditOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={updateFarm.isPending}
              onClick={onUpdateFarm}
            >
              {updateFarm.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
