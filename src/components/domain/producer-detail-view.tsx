"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { getFarmCycles } from "@/lib/api/cycles";
import { BreadcrumbBack } from "@/components/domain/breadcrumb-back";
import { OnboardingPromptDialog } from "@/components/domain/onboarding-prompt-dialog";
import { NewCycleDialog } from "@/components/domain/farm-cycles-section";
import { KpiStrip, KpiCell } from "@/components/domain/kpi-strip";
import { ProducerFarmsSection } from "@/components/domain/producer-farms-section";
import { MonthCalendar } from "@/components/domain/agenda/month-calendar";
import { ProducerTimingTemplatesPanel } from "@/components/domain/timing/producer-timing-templates-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProducerDetailSkeleton } from "@/components/domain/page-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Tractor,
  Mail,
  Phone,
  Pencil,
  MapPin,
  Sprout,
  Leaf,
  CalendarDays,
  Clock,
  ShoppingCart,
} from "lucide-react";

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
  const [cronogramOpen, setCronogramOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  
  const router = useRouter();
  const searchParams = useSearchParams();
  const onbFarmId = searchParams.get("farm_id") ?? "";
  const onbCycleId = searchParams.get("cycle_id") ?? "";
  // Fluxo por safra: "season" (criar safra) → lista de compra → "recommendation"
  // (programação). "purchase-list" é legado e cai no início do fluxo novo.
  const [onbStage, setOnbStage] = useState<"season" | "recommendation" | null>(() => {
    const s = searchParams.get("onboarding");
    if (s === "season" || s === "purchase-list") return "season";
    if (s === "recommendation") return "recommendation";
    return null;
  });
  const [newCycleOpen, setNewCycleOpen] = useState(false);

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
      (sum, q) => sum + (q.data ?? []).filter((c) => c.status === "ACTIVE").length,
      0,
    );
    return { farms: farmsList.length, plots, hectares, activeSeasons };
  }, [farmsList, cycleQueries]);

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
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-auto min-h-14 justify-start gap-3 rounded-xl border-primary/15 px-4 py-3 text-left hover:border-primary/30 hover:bg-primary/3"
            onClick={() => setCronogramOpen(true)}
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarDays className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-primary-strong">
                Planejamento
              </span>
              <span className="mt-0.5 block font-display text-base font-semibold text-text-strong">
                Cronograma
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Aplicações pendentes e atrasadas
              </span>
            </span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-auto min-h-14 justify-start gap-3 rounded-xl border-primary/15 px-4 py-3 text-left hover:border-primary/30 hover:bg-primary/3"
            onClick={() => setTemplatesOpen(true)}
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Clock className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-primary-strong">
                Planejamento
              </span>
              <span className="mt-0.5 block font-display text-base font-semibold text-text-strong">
                Modelos de recomendação
              </span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                Dessecação, fungicidas e janelas
              </span>
            </span>
          </Button>
        </div>
      ) : null}

      <ProducerFarmsSection
        producerId={producerId}
        farms={farmsList}
        loadingFarms={loadingFarms}
        showSeasonActions={showSeasonActions}
        onNewFarm={() => setNewFarmOpen(true)}
        onOpenRecommendationModels={() => setTemplatesOpen(true)}
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
              <div className="overflow-y-auto px-6 pt-6 pb-8">
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
              <div className="overflow-y-auto px-6 pt-6 pb-8">
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
                  `/farms/${onbFarmId}/purchase-list/new?producer_id=${encodeURIComponent(producerId)}&cycle_id=${encodeURIComponent(cycleId)}&onboarding=recommendation`,
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
                  ? `/farms/${onbFarmId}/cycles/${onbCycleId}?producer_id=${encodeURIComponent(producerId)}`
                  : `/farms/${onbFarmId}?producer_id=${encodeURIComponent(producerId)}&tab=seasons`,
              )
            }
          />
        </>
      ) : null}

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

