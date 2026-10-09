"use client";

import { useState } from "react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bug, Camera, Leaf, Lock, MapPin, Package, Sprout, TriangleAlert } from "lucide-react";
import {
  fieldObservationPhotoUrl,
  type FieldObservation,
  type FieldObservationReport,
} from "@recomenda/api/field-observations";
import { useFieldObservations, usePrincipal, useProducers } from "@recomenda/api-hooks";
import { EmptyState } from "@recomenda/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@recomenda/ui/primitives/dialog";
import { PageHeader } from "@/components/domain/page-header";

const TIPO: Record<FieldObservation["tipo"], { label: string; icon: typeof Bug }> = {
  praga: { label: "Praga", icon: Bug },
  doenca: { label: "Doença", icon: TriangleAlert },
  daninha: { label: "Planta daninha", icon: Sprout },
  deficiencia: { label: "Deficiência", icon: Leaf },
};

const CONFIANCA: Record<string, string> = { alta: "alta", media: "média", baixa: "baixa" };

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/**
 * Histórico do Lico: fotos de praga, doença, planta daninha e deficiência que chegaram
 * pelo WhatsApp, com diagnóstico, local e a sugestão do Lico (opções registradas p/ o
 * alvo, estoque do produtor primeiro). Apoio ao agrônomo, gestor e consultor — sem
 * status de "visto/resolvido" (decisão de 08/10). Filtro ?produtor=<id> no endereço.
 */
export function FieldObservationsView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const principal = usePrincipal();
  const producerId = params.get("produtor") ?? undefined;
  const canSee =
    principal.role === "AGRONOMIST" ||
    (principal.role === "STAFF" && (principal.access_level === "MANAGER" || principal.access_level === "CONSULTANT"));
  const { data, isLoading } = useFieldObservations(undefined, producerId);
  const producers = useProducers();
  const [open, setOpen] = useState<FieldObservation | null>(null);
  // ?ocorrencia=<id> (vindo da notificação): abre o relatório direto até ser fechado.
  const linkedId = params.get("ocorrencia");
  const [linkedClosed, setLinkedClosed] = useState(false);
  const linked = !linkedClosed && linkedId ? (data?.find((o) => o.id === linkedId) ?? null) : null;
  const current = open ?? linked;
  const close = () => {
    setOpen(null);
    setLinkedClosed(true);
  };

  const setProducer = (value: string | undefined) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set("produtor", value);
    else next.delete("produtor");
    const qs = next.toString();
    router.replace((qs ? `${pathname}?${qs}` : pathname) as Route);
  };

  if (principal.me && !canSee) {
    return (
      <EmptyState
        icon={Lock}
        title="Sem acesso"
        description="O histórico do Lico é do agrônomo responsável, do gestor e do consultor da carteira."
      />
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <PageHeader
        icon={<Camera className="h-5 w-5" />}
        section="Lico"
        title="Histórico de ocorrências"
        description="Fotos de praga, doença, planta daninha e deficiência analisadas pelo Lico no WhatsApp, com a sugestão para revisão."
      />

      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Produtor"
          className="h-9 rounded-lg border border-border bg-card px-3 text-sm"
          value={producerId ?? ""}
          onChange={(e) => setProducer(e.target.value || undefined)}
        >
          <option value="">Todos os produtores</option>
          {(producers.data?.data ?? [])
            .filter((p) => p.row_type === "producer" && p.producer_id)
            .map((p) => (
              <option key={p.producer_id} value={p.producer_id ?? ""}>
                {p.name}
              </option>
            ))}
        </select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : !data?.length ? (
        <EmptyState
          icon={Camera}
          title="Nenhuma ocorrência aqui"
          description="Quando alguém mandar foto de praga, doença ou planta daninha para o Lico, ela aparece aqui."
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((o) => (
            <ObservationCard key={o.id} observation={o} onOpen={() => setOpen(o)} />
          ))}
        </ul>
      )}

      <Dialog open={Boolean(current)} onOpenChange={(v) => (v ? null : close())}>
        <DialogContent className="flex max-h-[min(90vh,820px)] w-full min-w-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          {current ? <ObservationDetail observation={current} /> : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function TipoChip({ o }: { o: FieldObservation }) {
  const tipo = TIPO[o.tipo] ?? TIPO.praga;
  const Icon = tipo.icon;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary-strong">
      <Icon className="h-3 w-3" aria-hidden />
      {tipo.label}
    </span>
  );
}

/** Cartão compacto: foto, achado, local e um resumo da sugestão. Clique abre o detalhe. */
function ObservationCard({ observation: o, onOpen }: { observation: FieldObservation; onOpen: () => void }) {
  const r = o.sugestoes;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border bg-card text-left transition hover:border-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {o.tem_foto ? (
          <span className="block bg-muted">
            {/* Foto privada: o proxy /api/v1 autentica pelo cookie; next/image não passaria o cookie. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fieldObservationPhotoUrl(o.id)} alt={o.resumo} loading="lazy" className="h-44 w-full object-cover" />
          </span>
        ) : null}
        <span className="flex flex-1 flex-col gap-2 p-4">
          <span className="flex flex-wrap items-center gap-2">
            <TipoChip o={o} />
            {o.cultura ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{o.cultura}</span>
            ) : null}
          </span>
          <span className="line-clamp-2 text-sm font-semibold text-foreground">{o.resumo}</span>
          {o.local_nome ? (
            <span className="inline-flex items-center gap-1 text-xs text-foreground">
              <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden /> {o.local_nome}
            </span>
          ) : null}
          {r ? (
            <span className={r.sem_registro ? "text-xs font-medium text-warning-strong" : "text-xs text-muted-foreground"}>
              {r.sem_registro
                ? "Sem produto registrado para o alvo"
                : `${r.total_registrados} opção(ões) registrada(s)${r.no_estoque ? ` · ${r.no_estoque} no estoque` : ""}`}
            </span>
          ) : null}
          <span className="mt-auto pt-1 text-[11px] text-muted-foreground">
            {o.author_name ?? "Alguém"} · {fmtDateTime(o.created_at)}
          </span>
        </span>
      </button>
    </li>
  );
}

/** Detalhe no modal: foto grande, diagnóstico completo, local e o relatório do Lico. */
function ObservationDetail({ observation: o }: { observation: FieldObservation }) {
  const candidatos = o.diagnostico?.candidatos ?? [];
  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
      <DialogHeader className="shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <TipoChip o={o} />
          {o.cultura ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{o.cultura}</span>
          ) : null}
        </div>
        <DialogTitle className="text-lg">{o.resumo}</DialogTitle>
        <DialogDescription>
          {o.author_name ?? "Alguém"} · {fmtDateTime(o.created_at)}
          {o.local_nome ? ` · ${o.local_nome}` : ""}
        </DialogDescription>
      </DialogHeader>

      <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto px-6 py-5 text-sm wrap-break-word">
        {o.tem_foto ? (
          <a href={fieldObservationPhotoUrl(o.id)} target="_blank" rel="noreferrer" className="block min-w-0 overflow-hidden rounded-xl bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fieldObservationPhotoUrl(o.id)} alt={o.resumo} className="max-h-72 w-full max-w-full object-contain" />
          </a>
        ) : null}

        {candidatos.length ? (
          <div className="min-w-0">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Diagnóstico do Lico</p>
            <ul className="space-y-2">
              {candidatos.map((c, i) => (
                <li key={`${c.nome_comum}-${i}`} className="min-w-0">
                  <p className="text-foreground">
                    <span className="font-medium">
                      {i + 1}. {c.nome_comum}
                    </span>
                    {c.nome_cientifico ? <i className="text-muted-foreground"> ({c.nome_cientifico})</i> : null}
                    <span className="text-muted-foreground"> — confiança {CONFIANCA[c.confianca] ?? c.confianca}</span>
                  </p>
                  {c.evidencias ? <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{c.evidencias}</p> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {o.diagnostico?.sintomas ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Sintomas: </span>
            {o.diagnostico.sintomas}
          </p>
        ) : null}
        {o.diagnostico?.severidade ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Severidade: </span>
            {o.diagnostico.severidade}
          </p>
        ) : null}
        {o.legenda ? <p className="text-xs italic text-muted-foreground">&ldquo;{o.legenda}&rdquo;</p> : null}
        {o.sugestoes ? <ReportBlock report={o.sugestoes} /> : null}
      </div>
    </div>
  );
}

/**
 * Relatório do Lico para o agrônomo: o que é REGISTRADO para o alvo na cultura do talhão,
 * o estoque do produtor primeiro e a dose da bula. É sugestão para revisar — a receita é
 * do agrônomo.
 */
function ReportBlock({ report: r }: { report: FieldObservationReport }) {
  if (r.sem_registro) {
    return (
      <div className="rounded-xl border border-warning/40 bg-warning/20 px-3 py-2 text-xs text-foreground">
        <strong>Nenhum produto registrado no MAPA</strong> para <i>{r.alvo}</i>
        {r.cultura ? ` em ${r.cultura}` : ""}. Avaliar manejo sem opção de bula.
      </div>
    );
  }
  return (
    <div className="min-w-0 space-y-2 rounded-xl border border-border bg-muted/40 p-3 wrap-break-word">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        Sugestão do Lico · {r.total_registrados} registrado(s) para <i className="normal-case">{r.alvo}</i>
        {r.cultura ? ` em ${r.cultura}` : ""}
        {r.no_estoque ? ` · ${r.no_estoque} no estoque` : ""}
      </p>
      {r.aviso_ogm ? <p className="text-xs font-semibold text-danger-strong">⚠ Há dose só para cultivar tolerante (OGM) — confira a cultivar.</p> : null}
      <ul className="space-y-1.5">
        {r.opcoes.map((p) => (
          <li key={p.registro} className="text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-foreground">{p.marca}</span>
              {p.no_estoque ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-1.5 py-0.5 text-[10px] font-bold text-primary-strong">
                  <Package className="h-3 w-3" aria-hidden />
                  no estoque{p.estoque ? `: ${p.estoque.quantidade.toLocaleString("pt-BR")} ${p.estoque.unidade ?? ""}` : ""}
                </span>
              ) : null}
              {p.biologico ? <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold">biológico</span> : null}
            </div>
            <div className="text-muted-foreground">
              {p.ativo}
              {p.dose_bula.length ? ` · dose da bula: ${p.dose_bula.slice(0, 2).join(" / ")}` : " · dose: conferir na bula"}
            </div>
          </li>
        ))}
      </ul>
      <p className="text-[10px] text-muted-foreground">Fonte: bulas do MAPA (AGROFIT). Sugestão para revisão — a receita é do agrônomo.</p>
    </div>
  );
}
