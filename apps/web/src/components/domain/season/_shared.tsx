"use client";

import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@recomenda/utils";

/** Talhão usado nos fluxos de lista de compra e safra. */
export type WizardPlot = {
  id: string;
  name: string;
  area: number;
  farmId: string;
  farmName: string;
};

/** Configuração por talhão no wizard de safra. */
export type PlotSchedule = {
  plotId: string;
  variety: string;
  plantingDate: string;
  cycleDays: string;
};

/** Estágio rascunho para montar cronograma no wizard. */
export type DraftTimingStage = {
  key: string;
  name: string;
  trigger_type: string;
  window_start_days: string;
  window_end_days: string;
};

export const STAGES = [
  "Dessecação",
  "Pós-emergência",
  "Fungicida V4",
  "Fungicida V6",
  "Fungicida VT",
  "Inseticida",
  "Foliar",
  "Outra",
];

export const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/** Área plantada — sempre com 2 casas (ex.: 325 → "325,00"). */
export const fmtArea = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function StepHeader({
  title,
  subtitle,
  onBack,
  backLabel = "Voltar",
}: {
  title: string;
  subtitle: string;
  onBack?: () => void;
  backLabel?: string;
}) {
  return (
    <div className="mb-8">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </button>
      ) : null}
      <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] text-text-strong sm:text-3xl">
        {title}
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {subtitle}
      </p>
    </div>
  );
}

export function Field({
  htmlFor,
  label,
  hint,
  children,
}: {
  htmlFor?: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-foreground">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      {message}
    </div>
  );
}

export function StepFooter({
  back,
  primary,
  secondary,
}: {
  back?: ReactNode;
  primary: ReactNode;
  secondary?: ReactNode;
}) {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-2 border-t pt-4">
      {back}
      <div className="flex-1" />
      {secondary}
      {primary}
    </div>
  );
}

export function ContextBadge({
  tone,
  children,
}: {
  tone: "primary" | "sky";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        tone === "primary" && "bg-primary-soft text-primary-strong",
        tone === "sky" && "bg-tb-soft text-tb",
      )}
    >
      {children}
    </span>
  );
}

export function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-border bg-card p-[18px] shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-[18px] font-semibold tracking-[-0.01em] text-text-strong">
        {value}
      </p>
    </div>
  );
}

export function extractError(e: unknown): string {
  if (e && typeof e === "object" && "response" in e) {
    const resp = (e as { response?: { data?: { message?: string } } }).response;
    if (resp?.data?.message) return resp.data.message;
  }
  if (e instanceof Error) return e.message;
  return "Não foi possível concluir. Tente novamente.";
}
