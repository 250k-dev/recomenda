"use client";

import { useState, type ReactNode } from "react";
import { Copy, FileText, Lock, Minus, Plus } from "lucide-react";
import { WhatsAppIcon } from "@recomenda/ui/assets/whatsapp-icon";
import { Popover, PopoverContent, PopoverTrigger } from "@recomenda/ui/primitives/popover";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@recomenda/ui/primitives/dialog";
import { cn } from "@recomenda/utils";
import { DEFAULT_PREVIEW_ZOOM, type PreviewZoom } from "@/components/domain/export/paged-preview";

/**
 * Peças do padrão "Exportar" (talhão, safra e dados da aplicação): moldura em
 * duas colunas com rolagem própria e rodapé fixo, passos numerados, caixa de
 * três estados, cartões de documento e o painel de prévia.
 * Referência: design_handoff_exportar/README.md.
 */

// ---------------------------------------------------------------- moldura

export type ExportTab = { id: string; label: string };

export function ExportShell({
  open,
  onOpenChange,
  title,
  subtitle,
  tabs,
  tab,
  onTab,
  left,
  right,
  footer,
  mobile,
  mobileView,
  onMobileView,
  mobilePreviewLabel = "Prévia",
  maxWidth = 1300,
  onEscapeKeyDown,
  contentKey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: ReactNode;
  tabs?: ExportTab[];
  tab?: string;
  onTab?: (id: string) => void;
  left: ReactNode;
  right: ReactNode;
  footer: ReactNode;
  mobile: boolean;
  mobileView: "config" | "preview";
  onMobileView: (view: "config" | "preview") => void;
  mobilePreviewLabel?: string;
  maxWidth?: number;
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
  /** Troca de aba remonta as colunas (cada aba tem a própria prévia). */
  contentKey?: string;
}) {
  // A mesma proporção em todas as abas: configuração estreita, prévia larga.
  const grid = "md:grid-cols-[minmax(440px,540px)_minmax(0,1fr)]";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onEscapeKeyDown={onEscapeKeyDown}
        className={cn(
          "gap-0 bg-[#faf9f5] p-0 text-[#24231f]",
          mobile
            ? "inset-0 top-0 left-0 h-[100dvh] max-h-none w-screen max-w-none translate-x-0 translate-y-0 rounded-none"
            : "h-[min(880px,calc(100vh-48px))] max-h-none w-[calc(100vw-48px)] rounded-2xl shadow-[0_24px_64px_rgba(30,28,20,.28)]",
        )}
        style={mobile ? undefined : { maxWidth }}
      >
        <header className="shrink-0 border-b border-[#e2e0d6] px-6 pt-[18px] pb-3.5 pr-14">
          <DialogTitle className="font-display text-[19px] font-semibold">{title}</DialogTitle>
          {subtitle ? (
            <DialogDescription className="mt-0.5 text-[13px] text-[#6b6a62]">{subtitle}</DialogDescription>
          ) : (
            <DialogDescription className="sr-only">{title}</DialogDescription>
          )}
          {tabs?.length || mobile ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {tabs?.length ? (
                <Pills items={tabs} value={tab ?? tabs[0].id} onChange={(id) => onTab?.(id)} />
              ) : null}
              {mobile ? (
                <Pills
                  tone="soft"
                  items={[
                    { id: "config", label: "Configurar" },
                    { id: "preview", label: mobilePreviewLabel },
                  ]}
                  value={mobileView}
                  onChange={(id) => onMobileView(id as "config" | "preview")}
                />
              ) : null}
            </div>
          ) : null}
        </header>
        {/* No celular as duas colunas continuam montadas: a escondida fica
            invisível (não display:none), senão a prévia não pagina e o
            "N folhas" some até abrir a aba. */}
        <div className={cn("relative grid min-h-0 flex-1", mobile ? "grid-cols-1" : grid)}>
          <div
            key={`l-${contentKey}`}
            className={cn(
              "min-h-0 overflow-y-auto px-6 py-5",
              mobile && mobileView !== "config" && "invisible absolute inset-0",
            )}
          >
            {left}
          </div>
          <div
            key={`r-${contentKey}`}
            className={cn(
              "relative flex min-h-0 flex-col bg-[#ecebe4]",
              !mobile && "border-l border-[#e2e0d6]",
              mobile && mobileView !== "preview" && "invisible absolute inset-0",
            )}
          >
            {right}
          </div>
        </div>
        <footer className="shrink-0 border-t border-[#e2e0d6] bg-white px-6 py-3">{footer}</footer>
      </DialogContent>
    </Dialog>
  );
}

export function Pills({
  items,
  value,
  onChange,
  tone = "primary",
}: {
  items: ExportTab[];
  value: string;
  onChange: (id: string) => void;
  tone?: "primary" | "soft";
}) {
  return (
    <div className="inline-flex rounded-[10px] bg-[#f1f0ea] p-[3px]">
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors",
              active
                ? tone === "primary"
                  ? "bg-[#2f6d3f] text-white"
                  : "bg-white text-[#24231f] shadow-sm"
                : "text-[#55534b] hover:text-[#24231f]",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/** Rodapé: resumo à esquerda (laranja quando falta seleção), ações à direita. */
export function ExportFooter({
  summary,
  sub,
  warn = false,
  children,
}: {
  summary: ReactNode;
  sub?: ReactNode;
  warn?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-[13.5px] font-semibold", warn ? "text-[#b8541f]" : "text-[#24231f]")}>
          {summary}
        </p>
        {sub ? <p className="truncate text-xs text-[#6b6a62]">{sub}</p> : null}
      </div>
      <div className="flex w-full gap-2 sm:w-auto">{children}</div>
    </div>
  );
}

export function FooterButton({
  tone,
  disabled,
  onClick,
  children,
}: {
  tone: "primary" | "ghost";
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-[10px] px-4 text-[13.5px] font-semibold whitespace-nowrap transition-colors sm:flex-none",
        tone === "primary" && "bg-[#2f6d3f] text-white hover:bg-[#24562f] disabled:bg-[#a9bfa9]",
        tone === "ghost" && "text-[#55534b] hover:bg-[#f1f0ea]",
        "disabled:cursor-not-allowed",
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- blocos

export function Step({
  n,
  title,
  links,
  children,
}: {
  n: number;
  title: string;
  links?: Array<{ label: string; onClick: () => void }>;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span className="flex size-5 flex-none items-center justify-center rounded-full bg-[#2f6d3f] text-[11px] font-bold text-white">
          {n}
        </span>
        <span className="flex-1 text-sm font-semibold">{title}</span>
        {links?.length ? (
          <span className="flex gap-2.5 text-[12.5px] font-semibold">
            {links.map((link) => (
              <button key={link.label} type="button" className="text-[#2f6d3f] hover:underline" onClick={link.onClick}>
                {link.label}
              </button>
            ))}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export type TriState = "on" | "off" | "mixed";

export function TriCheck({ state, disabled = false }: { state: TriState; disabled?: boolean }) {
  const on = state !== "off";
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-4 flex-none items-center justify-center rounded border-[1.5px]",
        on ? "border-[#2f6d3f] bg-[#2f6d3f]" : "border-[#bdb9ab] bg-white",
        disabled && "opacity-50",
      )}
    >
      {state === "on" ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : state === "mixed" ? (
        <span className="h-0.5 w-2 rounded-sm bg-white" />
      ) : null}
    </span>
  );
}

export function triOf(values: boolean[]): TriState {
  if (values.length === 0) return "off";
  const on = values.filter(Boolean).length;
  return on === 0 ? "off" : on === values.length ? "on" : "mixed";
}

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  APPLIED_ON_TIME: { label: "Aplicada no prazo", className: "bg-[#e3efe4] text-[#2f6d3f]" },
  APPLIED_LATE: { label: "Aplicada com atraso", className: "bg-[#f7ebcf] text-[#8a5a00]" },
  SKIPPED: { label: "Pulada", className: "bg-[#fde4d6] text-[#b8541f]" },
  PENDING: { label: "Pendente", className: "bg-[#e1eff6] text-[#2b6a86]" },
  OVERDUE: { label: "Atrasada", className: "bg-[#fde4d6] text-[#b8541f]" },
};

export function StatusBadge({ status, short = false }: { status: string; short?: boolean }) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.PENDING;
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap", style.className)}>
      {short && status.startsWith("APPLIED") ? "Registrada" : style.label}
    </span>
  );
}

/** Cartão de documento do PDF (Resumo / Receitas). */
export function PartCard({
  title,
  tag,
  tagTone,
  desc,
  pages,
  on,
  onToggle,
  children,
}: {
  title: string;
  tag: string;
  tagTone: "producer" | "operator";
  desc: string;
  pages?: string;
  on: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border transition-colors",
        on ? "border-[#cfdccf] bg-white" : "border-[#e2e0d6] bg-[#faf9f5]",
      )}
    >
      <button type="button" onClick={onToggle} className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left">
        <span className="mt-0.5">
          <TriCheck state={on ? "on" : "off"} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[13.5px] font-semibold">{title}</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
                tagTone === "producer" ? "bg-[#efe7d6] text-[#7a5a1e]" : "bg-[#e1eff6] text-[#2b6a86]",
              )}
            >
              {tag}
            </span>
            {pages ? <span className="ml-auto text-xs text-[#6b6a62]">{pages}</span> : null}
          </span>
          <span className="mt-0.5 block text-[12.5px] leading-snug text-[#6b6a62]">{desc}</span>
        </span>
      </button>
      {children}
    </div>
  );
}

/** Interruptor "Incluir preços e custos" (mora dentro do cartão do Resumo). */
export function PriceSwitch({
  on,
  onToggle,
  canPrice,
  disabled = false,
}: {
  on: boolean;
  onToggle: () => void;
  canPrice: boolean;
  disabled?: boolean;
}) {
  if (!canPrice) {
    return (
      <p className="flex items-center gap-2 border-t border-[#efede5] px-3 py-2 text-xs text-[#7a786e]">
        <Lock className="size-3.5" /> Sem preços — seu perfil não vê custos.
      </p>
    );
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2.5 border-t border-[#efede5] px-3 py-2 text-left",
        disabled && "opacity-45",
      )}
    >
      <span
        aria-hidden
        className={cn("relative h-5 w-8 flex-none rounded-full transition-colors", on ? "bg-[#2f6d3f]" : "bg-[#cfccc0]")}
      >
        <span className={cn("absolute top-0.5 size-4 rounded-full bg-white transition-all", on ? "left-3.5" : "left-0.5")} />
      </span>
      <span>
        <span className="block text-[12.5px] font-semibold">Incluir preços e custos</span>
        <span className="block text-[11.5px] text-[#6b6a62]">Custo/ha, total por etapa e total do talhão.</span>
      </span>
    </button>
  );
}

// ---------------------------------------------------------------- prévia

export function PreviewToolbar({
  title,
  zoom,
  effectiveZoom,
  onZoom,
}: {
  title: ReactNode;
  zoom: PreviewZoom;
  effectiveZoom: number;
  onZoom: (zoom: PreviewZoom) => void;
}) {
  const step = (delta: number) => {
    const current = zoom === "fit" ? effectiveZoom : zoom;
    onZoom(Math.max(0.3, Math.min(2, Math.round((current + delta) * 100) / 100)));
  };
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-[#dedbd0] bg-[#f6f4ee] px-4 py-2.5">
      <div className="min-w-0 flex-1 truncate text-[13px] font-semibold">{title}</div>
      <div className="flex items-center rounded-lg border border-[#d9d6ca] bg-white">
        <button type="button" aria-label="Diminuir zoom" className="p-1.5 text-[#55534b]" onClick={() => step(-0.1)}>
          <Minus className="size-3.5" />
        </button>
        <button
          type="button"
          title="Voltar a 80%"
          className="min-w-12 px-1 text-xs font-semibold tabular-nums"
          onClick={() => onZoom(DEFAULT_PREVIEW_ZOOM)}
        >
          {Math.round(effectiveZoom * 100)}%
        </button>
        <button type="button" aria-label="Aumentar zoom" className="p-1.5 text-[#55534b]" onClick={() => step(0.1)}>
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

/** Botão "Compartilhar" do rodapé (ícone do WhatsApp): popover com copiar o texto ou abrir a conversa. */
export function WhatsappButton({
  message,
  disabled,
  onCopy,
  onSend,
}: {
  message: string;
  disabled?: boolean;
  onCopy: () => void;
  onSend: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled || !message}
          className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-[10px] bg-[#25D366] px-4 text-[13.5px] font-semibold whitespace-nowrap text-white transition-colors hover:bg-[#20bd5a] disabled:cursor-not-allowed disabled:bg-[#a8dcb9] sm:flex-none"
        >
          <WhatsAppIcon className="size-4" /> Compartilhar
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-60 p-1.5">
        <button
          type="button"
          onClick={() => {
            onCopy();
            setOpen(false);
          }}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium hover:bg-[#f1f0ea]"
        >
          <Copy className="size-4 text-[#55534b]" /> Copiar texto
        </button>
        <button
          type="button"
          onClick={() => {
            onSend();
            setOpen(false);
          }}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium hover:bg-[#f1f0ea]"
        >
          <WhatsAppIcon className="size-4 text-[#1fa855]" /> Enviar no WhatsApp
        </button>
      </PopoverContent>
    </Popover>
  );
}

export function PreviewEmpty({ title, text }: { title: string; text: string }) {
  return (
    <div className="max-w-[280px] text-center text-[#6b6a62]">
      <FileText className="mx-auto mb-2 size-8 text-[#a9a69a]" />
      <p className="text-sm font-semibold text-[#24231f]">{title}</p>
      <p className="mt-1 text-[12.5px]">{text}</p>
    </div>
  );
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="h-3.5 w-1/3 animate-pulse rounded-md bg-[#e9e6dc]" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-11 animate-pulse rounded-[10px] bg-[#efede5]" />
      ))}
    </div>
  );
}

export const fmtPages = (n: number) => `${n} ${n === 1 ? "folha" : "folhas"}`;
