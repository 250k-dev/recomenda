"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/domain/page-header";
import { BreadcrumbBack } from "@/components/domain/breadcrumb-back";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  useProducer,
  useProducerFarms,
  useUpdateProducer,
} from "@/lib/api/hooks";
import { ProducerDetailSkeleton } from "@/components/domain/page-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, Plus, Tractor, Mail, Phone, Pencil } from "lucide-react";

const ACTIVE_SEASON_STATUSES = new Set(["DRAFT", "PUBLISHED", "IN_PROGRESS"]);

export type ProducerDetailViewProps = {
  producerId: string;
  backHref: string;
  showSeasonActions: boolean;
  showImpersonate?: boolean;
};

export function ProducerDetailView({
  producerId,
  backHref,
}: ProducerDetailViewProps) {
  const router = useRouter();
  const { data: producer, isLoading } = useProducer(producerId);
  const { data: farms, isLoading: loadingFarms } = useProducerFarms(producerId);
  const updateProducer = useUpdateProducer(producerId);

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [editedEmail, setEditedEmail] = useState("");
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [editedPhone, setEditedPhone] = useState("");

  useEffect(() => {
    if (producer?.name != null) setEditedName(producer.name);
    if (producer?.email != null) setEditedEmail(producer.email);
    if (producer?.phone != null) setEditedPhone(producer.phone ?? "");
  }, [producer?.name, producer?.email, producer?.phone]);

  const handleSaveName = () => {
    if (editedName.trim() && editedName !== producer?.name) {
      updateProducer.mutate({ name: editedName }, { onSuccess: () => setIsEditingName(false) });
    } else {
      setIsEditingName(false);
    }
  };

  const handleSaveEmail = () => {
    if (editedEmail.trim() && editedEmail !== producer?.email) {
      updateProducer.mutate({ email: editedEmail }, { onSuccess: () => setIsEditingEmail(false) });
    } else {
      setIsEditingEmail(false);
    }
  };

  const handleSavePhone = () => {
    if (editedPhone !== (producer?.phone ?? "")) {
      updateProducer.mutate({ phone: editedPhone }, { onSuccess: () => setIsEditingPhone(false) });
    } else {
      setIsEditingPhone(false);
    }
  };

  const farmsList = useMemo(() => farms ?? [], [farms]);

  if (isLoading) return <ProducerDetailSkeleton />;
  if (!producer) return <p className="text-sm text-destructive p-6">Produtor não encontrado.</p>;

  const breadcrumbs = [
    { label: "Produtores", href: backHref },
    { label: producer.name },
  ];

  return (
    <>
      <BreadcrumbBack items={breadcrumbs} />

      <PageHeader
        title={producer.name}
        description={producer.email}
        action={
          <Link href={`/farms/new?producer_id=${encodeURIComponent(producerId)}`}>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nova fazenda
            </Button>
          </Link>
        }
      />

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Fazendas</h2>
        <span className="text-xs text-muted-foreground">
          {farmsList.length} {farmsList.length === 1 ? "fazenda" : "fazendas"}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="min-w-0">

          {loadingFarms ? (
            <div className="space-y-4" aria-hidden>
              <Skeleton className="h-28 w-full rounded-xl border border-border" />
              <Skeleton className="h-28 w-full rounded-xl border border-border" />
            </div>
          ) : farmsList.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Tractor className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Nenhuma fazenda cadastrada
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Cadastre a primeira fazenda para iniciar o acompanhamento das safras.
                  </p>
                </div>
                <Link
                  href={`/farms/new?producer_id=${encodeURIComponent(producerId)}`}
                  className="mt-2"
                >
                  <Button size="sm" className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    Cadastrar primeira fazenda
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {farmsList.map((farm) => {
                const totalHectares = farm.plots.reduce(
                  (acc, plot) => acc + (parseFloat(plot.area_hectares) || 0),
                  0,
                );
                const activeSeasonsCount = farm.seasons.filter((s) =>
                  ACTIVE_SEASON_STATUSES.has(s.status),
                ).length;
                const farmHref = `/farms/${farm.id}?producer_id=${encodeURIComponent(producerId)}`;

                return (
                  <Card
                    key={farm.id}
                    className="group cursor-pointer overflow-hidden transition-colors hover:border-primary/40 hover:bg-accent/30"
                    onClick={() => router.push(farmHref)}
                  >
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Tractor className="h-6 w-6" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-base font-semibold text-foreground">
                            {farm.name}
                          </h3>
                          {activeSeasonsCount > 0 ? (
                            <Badge variant="default" className="shrink-0">
                              {activeSeasonsCount}{" "}
                              {activeSeasonsCount === 1 ? "safra ativa" : "safras ativas"}
                            </Badge>
                          ) : null}
                        </div>
                        {farm.location ? (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {farm.location}
                          </p>
                        ) : null}
                        <p className="mt-1.5 text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {farm.plots.length}
                          </span>{" "}
                          {farm.plots.length === 1 ? "talhão" : "talhões"}
                          <span className="mx-1.5 text-muted-foreground/60">·</span>
                          <span className="font-medium text-foreground">
                            {totalHectares.toFixed(2)}
                          </span>{" "}
                          ha
                        </p>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        title="Ver detalhes da fazenda"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(farmHref);
                        }}
                        className="shrink-0 group-hover:bg-background"
                      >
                        <Eye className="h-5 w-5" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <aside className="min-w-0 self-start">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Informações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 p-0 pb-4">
              <div className="px-6 py-2">
                <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Nome
                </p>
                {isEditingName ? (
                  <div className="flex flex-col gap-2 pt-1">
                    <Input
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="h-8 text-sm"
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                    />
                    <div className="flex gap-1.5">
                      <Button size="sm" className="h-7 text-xs" disabled={updateProducer.isPending} onClick={handleSaveName}>
                        {updateProducer.isPending ? "..." : "Salvar"}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setIsEditingName(false); setEditedName(producer.name); }}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{producer.name}</p>
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground" onClick={() => { setIsEditingName(true); setEditedName(producer.name); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="mx-6 border-t" />

              <div className="px-6 py-2">
                <p className="mb-0.5 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  E-mail
                </p>
                {isEditingEmail ? (
                  <div className="flex flex-col gap-2 pt-1">
                    <Input
                      type="email"
                      value={editedEmail}
                      onChange={(e) => setEditedEmail(e.target.value)}
                      className="h-8 text-sm"
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && handleSaveEmail()}
                    />
                    <div className="flex gap-1.5">
                      <Button size="sm" className="h-7 text-xs" disabled={updateProducer.isPending} onClick={handleSaveEmail}>
                        {updateProducer.isPending ? "..." : "Salvar"}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setIsEditingEmail(false); setEditedEmail(producer.email); }}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <p className="break-all text-sm font-medium text-foreground">{producer.email}</p>
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground" onClick={() => { setIsEditingEmail(true); setEditedEmail(producer.email); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="mx-6 border-t" />

              <div className="px-6 py-2">
                <p className="mb-0.5 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  Telefone
                </p>
                {isEditingPhone ? (
                  <div className="flex flex-col gap-2 pt-1">
                    <Input
                      type="tel"
                      value={editedPhone}
                      onChange={(e) => {
                        const d = e.target.value.replace(/\D/g, "").slice(0, 11);
                        const fmt = d.length <= 10
                          ? d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "")
                          : d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
                        setEditedPhone(fmt);
                      }}
                      className="h-8 text-sm"
                      placeholder="(00) 00000-0000"
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && handleSavePhone()}
                    />
                    <div className="flex gap-1.5">
                      <Button size="sm" className="h-7 text-xs" disabled={updateProducer.isPending} onClick={handleSavePhone}>
                        {updateProducer.isPending ? "..." : "Salvar"}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setIsEditingPhone(false); setEditedPhone(producer.phone ?? ""); }}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {producer.phone || <span className="text-muted-foreground">Não informado</span>}
                    </p>
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground" onClick={() => { setIsEditingPhone(true); setEditedPhone(producer.phone ?? ""); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}
