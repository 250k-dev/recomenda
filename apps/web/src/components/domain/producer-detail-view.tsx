"use client";

import { routes } from "@recomenda/config";

import type { Route } from "next";
import { useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { getFarmCycles } from "@recomenda/api/cycles";
import { BreadcrumbBack, type BreadcrumbItem } from "@/components/domain/breadcrumb-back";
import { OnboardingPromptDialog } from "@/components/domain/onboarding-prompt-dialog";
import { NewCycleDialog } from "@/components/domain/farm-cycles-section";
import { PageHero, type PageHeroStat } from "@/components/domain/page-hero";
import { ProducerFarmsSection } from "@/components/domain/producer-farms-section";
import { MonthCalendar } from "@/components/domain/agenda/month-calendar";
import { ProducerTimingTemplatesPanel } from "@/components/domain/timing/producer-timing-templates-section";
import { Button } from "@recomenda/ui/primitives/button";
import { Input } from "@recomenda/ui/primitives/input";
import { Label } from "@recomenda/ui/primitives/label";
import {
  useAgronomistAgenda,
  useProducer,
  useProducerFarms,
  useUpdateProducer,
  queryKeys,
} from "@recomenda/api-hooks";
import { createFarm, grantFarmAccess } from "@recomenda/api";
import { useCan } from "@recomenda/api-hooks/use-can";
import { InviteProducerAccessDialog } from "@/components/domain/invite-producer-access-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@recomenda/ui/primitives/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recomenda/ui/primitives/dialog";
import { ProducerDetailSkeleton } from "@/components/domain/page-skeletons";
import { Skeleton } from "@recomenda/ui/primitives/skeleton";
import { formatPhoneBR, maskPhoneBR } from "@recomenda/utils";
import { toast } from "sonner";
import {
  Pencil,
  UserRound,
  Sprout,
  CalendarDays,
  Clock,
  TriangleAlert,
  Mail,
} from "lucide-react";

const fmtHa = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export type ProducerDetailViewProps = {
  producerId: string;
  backHref: Route;
  showSeasonActions: boolean;
  showImpersonate?: boolean;
};

export function ProducerDetailView({
  producerId,
  backHref,
  showSeasonActions,
}: ProducerDetailViewProps) {
  const queryClient = useQueryClient();
  const { data: producer, isLoading } = useProducer(producerId);
  const { data: farms, isLoading: loadingFarms } = useProducerFarms(producerId);
  const updateProducer = useUpdateProducer(producerId);
  const canInviteAccess = useCan("PRODUCER_CREATE");
  const [inviteOpen, setInviteOpen] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [newFarmOpen, setNewFarmOpen] = useState(false);
  const [newFarmName, setNewFarmName] = useState("");
  const [newFarmLocation, setNewFarmLocation] = useState("");
  const [cronogramOpen, setCronogramOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const onbFarmId = searchParams.get("farm_id") ?? "";
  const onbCycleId = searchParams.get("cycle_id") ?? "";
  // Fluxo por safra: "season" (criar safra) → lista de compra → "recommendation"
  // (programação). "purchase-list" é legado e cai no início do fluxo novo.
  const [onbStage, setOnbStage] = useState<"season" | "recommendation" | null>(
    () => {
      const s = searchParams.get("onboarding");
      if (s === "season" || s === "purchase-list") return "season";
      if (s === "recommendation") return "recommendation";
      return null;
    },
  );
  const [newCycleOpen, setNewCycleOpen] = useState(false);

  const today = useMemo(() => new Date(), []);
  const agenda = useAgronomistAgenda(today, producerId);
  const lateCount = showSeasonActions ? agenda.lateCount : 0;

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

  // Safras ativas = cycles (safra de verdade), não `f.seasons` (uma linha por
  // talhão plantado) — do contrário uma safra com 3 talhões virava "3 safras".
  const cycleQueries = useQueries({
    queries: farmsList.map((f) => ({
      queryKey: queryKeys.farmCycles(f.id),
      queryFn: () => getFarmCycles(f.id),
      staleTime: 60_000,
    })),
  });

  const stats = useMemo(() => {
    let plots = 0;
    let hectares = 0;
    for (const f of farmsList) {
      plots += f.plots.length;
      hectares += f.plots.reduce(
        (s, p) => s + (parseFloat(p.area_hectares) || 0),
        0,
      );
    }
    const activeSeasons = cycleQueries.reduce(
      (sum, q) =>
        sum + (q.data ?? []).filter((c) => c.status === "ACTIVE").length,
      0,
    );
    return { farms: farmsList.length, plots, hectares, activeSeasons };
  }, [farmsList, cycleQueries]);

  const openEdit = () => {
    if (!producer) return;
    setEditName(producer.name);
    setEditEmail(producer.email ?? "");
    setEditPhone(maskPhoneBR(producer.phone));
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

  const breadcrumbs: BreadcrumbItem[] = [
    { label: "Produtores", href: backHref },
    { label: producer.name },
  ];

  const statValue = (value: ReactNode) =>
    loadingFarms ? <Skeleton className="w-12 h-6" /> : value;

  const heroStats: PageHeroStat[] = [
    { label: "Telefone", value: formatPhoneBR(producer.phone) },
    ...(producer.email?.trim()
      ? [{ label: "E-mail", value: producer.email.trim() }]
      : []),
    { label: "Fazendas", value: statValue(stats.farms) },
    { label: "Talhões", value: statValue(stats.plots) },
    { label: "Hectares", value: statValue(`${fmtHa(stats.hectares)} ha`) },
    { label: "Safras ativas", value: statValue(stats.activeSeasons) },
    // No mobile este dado vira o banner de alerta abaixo das métricas.
    ...(lateCount > 0
      ? [
          {
            label: "Atrasadas",
            value: lateCount,
            tone: "danger" as const,
            hideOnMobile: true,
            onClick: () => setCronogramOpen(true),
          },
        ]
      : []),
  ];

  return (
    <>
      <BreadcrumbBack items={breadcrumbs} />

      <PageHero
        variant="inverted"
        icon={<UserRound className="size-6" />}
        eyebrow="Produtor"
        title={producer.name}
        titleAction={
          <Button
            variant="secondary"
            size="icon-xs"
            className="border-white/30 bg-white/10 text-primary-foreground hover:bg-white/20"
            onClick={openEdit}
          >
            <Pencil />
          </Button>
        }
        actions={
          <>
            {canInviteAccess ? (
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setInviteOpen(true)}
              >
                <Mail className="size-4" />
                Enviar convite de acesso
              </Button>
            ) : null}
            {showSeasonActions ? (
              <>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => setTemplatesOpen(true)}
                >
                  <Clock className="size-4" />
                  Modelos
                </Button>
                <Button
                  variant="clay"
                  className="gap-2"
                  onClick={() => setCronogramOpen(true)}
                >
                  <CalendarDays className="size-4" />
                  Cronograma
                </Button>
              </>
            ) : null}
          </>
        }
        stats={heroStats}
      >
        {lateCount > 0 ? (
          <button
            type="button"
            className="mt-3 flex w-full items-center gap-2 rounded-xl border border-danger-border bg-danger-soft px-3.5 py-2.5 text-left text-sm font-medium text-danger-strong sm:hidden"
            onClick={() => setCronogramOpen(true)}
          >
            <TriangleAlert className="size-4 shrink-0" aria-hidden />
            {lateCount === 1
              ? "1 aplicação atrasada"
              : `${lateCount} aplicações atrasadas`}
          </button>
        ) : null}
      </PageHero>

      <ProducerFarmsSection
        producerId={producerId}
        farms={farmsList}
        loadingFarms={loadingFarms}
        showSeasonActions={showSeasonActions}
        onNewFarm={() => setNewFarmOpen(true)}
      />

      {showSeasonActions ? (
        <>
          <Dialog open={cronogramOpen} onOpenChange={setCronogramOpen}>
            <DialogContent className="max-w-7xl">
              <DialogHeader>
                <DialogTitle>Cronograma</DialogTitle>
                <DialogDescription>
                  Aplicações pendentes e atrasadas deste produtor
                </DialogDescription>
              </DialogHeader>
              <div className="px-6 pt-6 pb-8 overflow-y-auto">
                <MonthCalendar
                  producerId={producerId}
                  showHeader={false}
                  focusNearestEvent
                />
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={templatesOpen} onOpenChange={setTemplatesOpen}>
            <DialogContent className="max-w-7xl">
              <DialogHeader>
                <DialogTitle>Modelos de recomendação</DialogTitle>
                <DialogDescription>
                  Modelos reutilizáveis de {producer.name}
                </DialogDescription>
              </DialogHeader>
              <div className="px-6 pt-6 pb-8 overflow-y-auto">
                <ProducerTimingTemplatesPanel
                  producerId={producerId}
                  producerName={producer.name}
                  onboardingFarmId={
                    onbStage === "recommendation" ? onbFarmId : undefined
                  }
                />
              </div>
            </DialogContent>
          </Dialog>

          {/* Fluxo por safra: 1) criar a safra (nome + culturas, leve) →
              2) lista de compra da safra (o agrônomo entrega ao produtor) →
              3) programação (modelos × talhões), que pode ficar para depois. */}
          <OnboardingPromptDialog
            open={onbStage === "season" && !newCycleOpen}
            onOpenChange={(open) => {
              if (!open) setOnbStage(null);
            }}
            icon={Sprout}
            eyebrow="Próximo passo"
            title="Vamos criar a primeira safra?"
            confirmLabel="Sim, criar safra"
            onConfirm={() => setNewCycleOpen(true)}
          />

          {onbFarmId ? (
            <NewCycleDialog
              open={newCycleOpen}
              onOpenChange={(open) => {
                setNewCycleOpen(open);
                if (!open) setOnbStage(null);
              }}
              farmId={onbFarmId}
              producerId={producerId}
              onCreated={(cycleId) =>
                router.push(
                  routes.fazendas.novaListaDeCompra(onbFarmId, {
                    producer_id: producerId,
                    cycle_id: cycleId,
                    onboarding: "recommendation",
                  }),
                )
              }
            />
          ) : null}

          <OnboardingPromptDialog
            open={onbStage === "recommendation"}
            onOpenChange={(open) => {
              if (!open) setOnbStage(null);
            }}
            icon={Clock}
            eyebrow="Próximo passo"
            title="Quer montar a programação da safra?"
            description="Escolha um modelo de recomendação (ou monte um na hora) e aplique aos talhões. Também pode ficar para depois — a safra e a lista de compra já estão salvas."
            confirmLabel="Sim, montar programação"
            onConfirm={() =>
              router.push(
                onbCycleId
                  ? routes.fazendas.safra(onbFarmId, onbCycleId, {
                      producer_id: producerId,
                    })
                  : routes.fazendas.detalhe(onbFarmId, {
                      producer_id: producerId,
                    }),
              )
            }
          />
        </>
      ) : null}

      {/* Editar produtor */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar produtor</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-5 space-y-4">
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
                onChange={(e) => setEditPhone(maskPhoneBR(e.target.value))}
                placeholder="(00) 00000-0000"
                onKeyDown={(e) => e.key === "Enter" && saveEdit()}
              />
            </div>
          </div>
          <DialogFooter className="sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!editName.trim() || updateProducer.isPending}
              onClick={saveEdit}
            >
              {updateProducer.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <InviteProducerAccessDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        target={{
          producerId,
          name: producer.name,
          email: producer.email ?? "",
        }}
      />
    </>
  );
}
