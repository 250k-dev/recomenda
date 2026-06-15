"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BreadcrumbBack } from "@/components/domain/breadcrumb-back";
import { KpiStrip, KpiCell } from "@/components/domain/kpi-strip";
import { MonthCalendar } from "@/components/domain/agenda/month-calendar";
import { ProducerTimingTemplatesSection } from "@/components/domain/timing/producer-timing-templates-section";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  useProducer,
  useProducerFarms,
  useUpdateProducer,
  queryKeys,
} from "@/lib/api/hooks";
import { createFarm, grantFarmAccess } from "@/lib/api/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ProducerDetailSkeleton } from "@/components/domain/page-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Plus,
  Tractor,
  Mail,
  Phone,
  Pencil,
  ShoppingCart,
  CalendarDays,
  ChevronRight,
  ChevronDown,
  MapPin,
  Sprout,
  Leaf,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ACTIVE_SEASON_STATUSES = new Set(["DRAFT", "PUBLISHED", "IN_PROGRESS"]);

const fmtHa = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

function formatPhone(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  return d.length <= 10
    ? d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "")
    : d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
}

export type ProducerDetailViewProps = {
  producerId: string;
  backHref: string;
  showSeasonActions: boolean;
  showImpersonate?: boolean;
};

export function ProducerDetailView({
  producerId,
  backHref,
  showSeasonActions,
}: ProducerDetailViewProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: producer, isLoading } = useProducer(producerId);
  const { data: farms, isLoading: loadingFarms } = useProducerFarms(producerId);
  const updateProducer = useUpdateProducer(producerId);

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [newFarmOpen, setNewFarmOpen] = useState(false);
  const [newFarmName, setNewFarmName] = useState("");
  const [newFarmLocation, setNewFarmLocation] = useState("");

  const newFarmMutation = useMutation({
    mutationFn: async () => {
      const farm = await createFarm({
        name: newFarmName.trim(),
        location: newFarmLocation.trim() || undefined,
      });
      await grantFarmAccess(farm.id, producerId);
      return farm;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.producerFarms(producerId),
      });
      toast.success("Fazenda cadastrada.");
      setNewFarmOpen(false);
      setNewFarmName("");
      setNewFarmLocation("");
    },
    onError: () => toast.error("Não foi possível cadastrar a fazenda."),
  });

  const farmsList = useMemo(() => farms ?? [], [farms]);

  const stats = useMemo(() => {
    let plots = 0;
    let hectares = 0;
    let activeSeasons = 0;
    for (const f of farmsList) {
      plots += f.plots.length;
      hectares += f.plots.reduce(
        (s, p) => s + (parseFloat(p.area_hectares) || 0),
        0,
      );
      activeSeasons += f.seasons.filter((s) =>
        ACTIVE_SEASON_STATUSES.has(s.status),
      ).length;
    }
    return { farms: farmsList.length, plots, hectares, activeSeasons };
  }, [farmsList]);

  const openEdit = () => {
    if (!producer) return;
    setEditName(producer.name);
    setEditEmail(producer.email ?? "");
    setEditPhone(producer.phone ?? "");
    setEditOpen(true);
  };

  const saveEdit = () => {
    if (!editName.trim()) return;
    const payload: { name: string; email?: string; phone?: string } = {
      name: editName.trim(),
      phone: editPhone.trim(),
    };
    if (editEmail.trim()) payload.email = editEmail.trim();
    updateProducer.mutate(payload, {
      onSuccess: () => {
        toast.success("Produtor atualizado.");
        setEditOpen(false);
      },
      onError: () => toast.error("Não foi possível atualizar o produtor."),
    });
  };

  if (isLoading) return <ProducerDetailSkeleton />;
  if (!producer)
    return (
      <p className="p-6 text-sm text-destructive">Produtor não encontrado.</p>
    );

  const breadcrumbs = [
    { label: "Produtores", href: backHref },
    { label: producer.name },
  ];

  const initial = (producer.name.trim().charAt(0) || "?").toUpperCase();

  return (
    <>
      <BreadcrumbBack items={breadcrumbs} />

      {/* Hero / identidade do produtor */}
      <section className="p-5 mb-6 border border-border shadow-sm rounded-xl bg-card sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start min-w-0 gap-4">
            <div className="flex items-center justify-center w-14 h-14 text-2xl font-bold shrink-0 rounded-xl bg-primary-soft text-primary-strong">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary-strong">
                Produtor
              </p>
              <h1 className="mt-0.5 truncate font-display text-2xl font-semibold tracking-[-0.02em] text-text-strong">
                {producer.name}
              </h1>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <ContactChip
                  icon={<Mail className="h-3.5 w-3.5" />}
                  value={producer.email}
                  empty="Sem e-mail"
                />
                <ContactChip
                  icon={<Phone className="h-3.5 w-3.5" />}
                  value={producer.phone}
                  empty="Sem telefone"
                />
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            size="lg"
            className="gap-2 shrink-0"
            onClick={openEdit}
          >
            <Pencil className="w-4 h-4" />
            Editar
          </Button>
        </div>
      </section>

      {/* KPIs — indicadores do produtor */}
      {loadingFarms ? (
        <Skeleton className="w-full h-24 mb-6 border rounded-xl border-border" />
      ) : (
        <KpiStrip className="mb-6">
          <KpiCell
            icon={<Tractor className="size-4" />}
            label="Fazendas"
            value={String(stats.farms)}
          />
          <KpiCell
            icon={<MapPin className="size-4" />}
            label="Talhões"
            value={String(stats.plots)}
          />
          <KpiCell
            icon={<Sprout className="size-4" />}
            label="Hectares totais"
            value={`${fmtHa(stats.hectares)} ha`}
          />
          <KpiCell
            icon={<Leaf className="size-4" />}
            label="Safras ativas"
            value={String(stats.activeSeasons)}
          />
        </KpiStrip>
      )}

      {showSeasonActions ? (
        <>
          <section className="mb-8">
            <details className="group overflow-hidden rounded-xl border border-primary/15 bg-card shadow-sm open:shadow-md">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 transition-colors marker:content-none hover:bg-primary/3 group-open:border-b group-open:bg-primary/4 [&::-webkit-details-marker]:hidden sm:px-6 sm:py-5">
                <div className="flex min-w-0 items-center gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm ring-1 ring-primary/10">
                    <CalendarDays className="h-6 w-6" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                      Planejamento
                    </p>
                    <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                      Cronograma
                    </h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Aplicações pendentes e atrasadas deste produtor
                    </p>
                  </div>
                </div>
                <span className="flex shrink-0 items-center gap-2 text-sm font-medium text-muted-foreground">
                  <span className="group-open:hidden">Expandir</span>
                  <span className="hidden group-open:inline">Recolher</span>
                  <ChevronDown className="h-5 w-5 transition-transform duration-200 group-open:rotate-180" />
                </span>
              </summary>
              <div className="border-t border-primary/10 px-4 pb-5 pt-4 sm:px-6">
                <MonthCalendar producerId={producerId} showHeader={false} focusNearestEvent />
              </div>
            </details>
          </section>

          <div id="timing-templates">
            <ProducerTimingTemplatesSection
              producerId={producerId}
              producerName={producer.name}
            />
          </div>
        </>
      ) : null}

      {/* Fazendas */}
      <section>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-baseline gap-2">
            <h2 className="text-lg font-semibold text-foreground">Fazendas</h2>
          </div>
          <Button
            size="lg"
            className="gap-2 shrink-0"
            onClick={() => setNewFarmOpen(true)}
          >
            <Plus className="w-4 h-4" />
            Nova fazenda
          </Button>
        </div>

        {loadingFarms ? (
          <div className="space-y-3" aria-hidden>
            <Skeleton className="w-full h-24 border rounded-xl border-border" />
            <Skeleton className="w-full h-24 border rounded-xl border-border" />
          </div>
        ) : farmsList.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary">
                <Tractor className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Nenhuma fazenda cadastrada
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Cadastre a primeira fazenda para iniciar o acompanhamento das
                  safras.
                </p>
              </div>
              <Button
                size="sm"
                className="mt-2 gap-1.5"
                onClick={() => setNewFarmOpen(true)}
              >
                <Plus className="w-4 h-4" />
                Cadastrar primeira fazenda
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {farmsList.map((farm) => {
              const totalHectares = farm.plots.reduce(
                (acc, plot) => acc + (parseFloat(plot.area_hectares) || 0),
                0,
              );
              const activeSeasonsCount = farm.seasons.filter((s) =>
                ACTIVE_SEASON_STATUSES.has(s.status),
              ).length;
              const farmBase = `/farms/${farm.id}?producer_id=${encodeURIComponent(producerId)}`;
              const farmHref = farmBase;
              const seasonsHref = `${farmBase}&tab=seasons`;
              const purchaseHref = `${farmBase}&tab=purchase`;

              return (
                <Card
                  key={farm.id}
                  className="overflow-hidden transition-all group hover:border-primary/40 hover:shadow-md"
                >
                  <CardContent className="p-4">
                    <button
                      type="button"
                      className="flex w-full cursor-pointer items-center gap-4 text-left"
                      onClick={() => router.push(farmHref)}
                    >
                      <div className="flex items-center justify-center w-12 h-12 transition-transform shrink-0 rounded-xl bg-primary/10 text-primary group-hover:scale-105">
                        <Tractor className="w-6 h-6" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold truncate text-foreground">
                            {farm.name}
                          </h3>
                          {activeSeasonsCount > 0 ? (
                            <Badge variant="success" className="shrink-0">
                              {activeSeasonsCount}{" "}
                              {activeSeasonsCount === 1 ? "safra" : "safras"}
                            </Badge>
                          ) : null}
                        </div>
                        {farm.location ? (
                          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <MapPin className="w-3 h-3 shrink-0" />
                            {farm.location}
                          </p>
                        ) : null}
                        <p className="mt-1.5 text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {farm.plots.length}
                          </span>{" "}
                          {farm.plots.length === 1 ? "talhão" : "talhões"}
                          <span className="mx-1.5 text-muted-foreground/60">
                            ·
                          </span>
                          <span className="font-medium text-foreground">
                            {fmtHa(totalHectares)}
                          </span>{" "}
                          ha
                        </p>
                      </div>

                      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </button>

                    {showSeasonActions ? (
                      <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link href={seasonsHref}>
                            <CalendarDays className="h-3.5 w-3.5" />
                            Safras
                          </Link>
                        </Button>
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link href={purchaseHref}>
                            <ShoppingCart className="h-3.5 w-3.5" />
                            Lista de compra
                          </Link>
                        </Button>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Editar produtor */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Editar produtor</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Nome</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nome do produtor"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && saveEdit()}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email">E-mail (opcional)</Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="produtor@exemplo.com"
                onKeyDown={(e) => e.key === "Enter" && saveEdit()}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-phone">Telefone</Label>
              <Input
                id="edit-phone"
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(formatPhone(e.target.value))}
                placeholder="(00) 00000-0000"
                onKeyDown={(e) => e.key === "Enter" && saveEdit()}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1"
                disabled={!editName.trim() || updateProducer.isPending}
                onClick={saveEdit}
              >
                {updateProducer.isPending ? "Salvando..." : "Salvar"}
              </Button>
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Nova fazenda — formulário em página (sem navegar) */}
      <Sheet open={newFarmOpen} onOpenChange={setNewFarmOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Nova fazenda</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-farm-name">Nome da fazenda</Label>
              <Input
                id="new-farm-name"
                value={newFarmName}
                onChange={(e) => setNewFarmName(e.target.value)}
                placeholder="Ex: Fazenda Santa Rosa"
                autoFocus
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  newFarmName.trim() &&
                  newFarmMutation.mutate()
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-farm-location">Localização (opcional)</Label>
              <Input
                id="new-farm-location"
                value={newFarmLocation}
                onChange={(e) => setNewFarmLocation(e.target.value)}
                placeholder="Cidade, UF"
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  newFarmName.trim() &&
                  newFarmMutation.mutate()
                }
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1"
                disabled={!newFarmName.trim() || newFarmMutation.isPending}
                onClick={() => newFarmMutation.mutate()}
              >
                {newFarmMutation.isPending
                  ? "Salvando..."
                  : "Cadastrar fazenda"}
              </Button>
              <Button variant="outline" onClick={() => setNewFarmOpen(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

    </>
  );
}

function ContactChip({
  icon,
  value,
  empty,
}: {
  icon: ReactNode;
  value?: string | null;
  empty: string;
}) {
  const hasValue = Boolean(value && value.trim());
  return (
    <span
      className={
        hasValue
          ? "inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-foreground"
          : "inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground"
      }
    >
      {icon}
      <span className="truncate max-w-55">{hasValue ? value : empty}</span>
    </span>
  );
}

