import { cn } from "@recomenda/utils";
import { Skeleton } from "@recomenda/ui/skeleton";

/** Alinha com `PageHeader`: título + descrição (+ ação opcional). */
export function PageHeaderSkeleton({ withAction }: { withAction?: boolean }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-3">
        <Skeleton className="h-8 w-44 md:h-9 md:w-56" />
        <Skeleton className="h-4 w-full max-w-2xl" />
        <Skeleton className="h-4 max-w-xl w-[85%]" />
      </div>
      {withAction ? <Skeleton className="h-10 w-36 shrink-0 rounded-md" /> : null}
    </div>
  );
}

/** Faixa de “toolbar” (botões / filtros) acima da tabela. */
export function ToolbarSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("mb-6 flex flex-wrap gap-2", className)}>
      <Skeleton className="h-10 w-40 rounded-md" />
      <Skeleton className="h-10 w-36 rounded-md" />
    </div>
  );
}

/** Tabela genérica (cabeçalho + linhas). */
export function TableRowsSkeleton({
  rows = 8,
  columns = 4,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card shadow-sm",
        className,
      )}
      aria-hidden
    >
      <div
        className="grid gap-3 border-b border-border bg-surface-2 px-4 py-3"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`h-${i}`} className="h-4 w-20" />
        ))}
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={`r-${r}`}
            className="grid items-center gap-3 px-4 py-3"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton
                key={`c-${c}`}
                className={cn("h-4", c === 0 ? "w-full max-w-[min(100%,14rem)]" : "w-16")}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Lista de cards empilhados (safras, talhões, modelos). */
export function ListCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-busy aria-label="Carregando">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-44 max-w-full" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-8 w-24 shrink-0 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Lista vertical de cartões (timeline, itens). */
export function TimelineCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <ul className="flex flex-col gap-3" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3 w-28" />
            </div>
            <div className="shrink-0 space-y-2 text-right">
              <Skeleton className="ml-auto h-3 w-24" />
              <Skeleton className="ml-auto h-3 w-20" />
            </div>
          </div>
          <Skeleton className="mt-3 h-3 w-full max-w-md" />
        </li>
      ))}
    </ul>
  );
}

/** KPIs tipo dashboard (cards pequenos). */
export function DashboardKpiSkeleton({
  cards = 3,
  className,
}: {
  cards?: 3 | 4;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-4",
        cards === 4 ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-3",
        className,
      )}
      aria-hidden
    >
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-9 w-14" />
        </div>
      ))}
    </div>
  );
}

/** Duas colunas de card (detalhe produtor / formulários). */
export function TwoColumnCardsSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2" aria-hidden>
      <div className="space-y-4 rounded-xl border border-border bg-card p-6">
        <Skeleton className="h-5 w-32" />
        <div className="space-y-3 pt-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
      <div className="space-y-4 rounded-xl border border-border bg-card p-6">
        <Skeleton className="h-5 w-36" />
        <div className="space-y-2 pt-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex justify-between gap-4 border-b border-border/60 pb-2 last:border-0">
              <Skeleton className="h-4 flex-1 max-w-[60%]" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Formulário em card (configurações / perfil). */
export function SettingsFormSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="rounded-xl border border-border bg-card p-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-2 h-4 w-64" />
        <div className="mt-6 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          ))}
          <Skeleton className="h-10 w-full max-w-xs rounded-md" />
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-6">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="mt-2 h-4 w-52" />
        <Skeleton className="mt-6 h-10 w-44 rounded-md" />
      </div>
    </div>
  );
}

/** Bloco de lista compacta (estoque no card). */
export function CompactListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex justify-between gap-4 border-b border-border/60 pb-2 last:border-0">
          <Skeleton className="h-4 flex-1 max-w-[70%]" />
          <Skeleton className="h-4 w-14" />
        </div>
      ))}
    </div>
  );
}

/** Detalhe de produtor: voltar + header + grid. */
export function ProducerDetailSkeleton() {
  return (
    <div className="animate-in fade-in duration-200" aria-busy aria-label="Carregando">
      <Skeleton className="mb-4 h-4 w-28" />
      <PageHeaderSkeleton withAction />
      <TwoColumnCardsSkeleton />
      <Skeleton className="mt-8 h-32 w-full rounded-xl border border-border" />
    </div>
  );
}

/** Abas horizontais + conteúdo (safra detalhe). */
export function TabsAndContentSkeleton() {
  return (
    <div className="animate-in fade-in duration-200" aria-hidden>
      <div className="mb-4 flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-md" />
        ))}
      </div>
      <TimelineCardsSkeleton count={3} />
    </div>
  );
}

/** Conteúdo principal padrão em `loading.tsx` (navegação entre rotas). */
export function RouteMainSkeleton() {
  return (
    <div className="animate-in fade-in duration-200" aria-busy aria-label="Carregando página">
      <PageHeaderSkeleton />
      <ToolbarSkeleton />
      <TableRowsSkeleton rows={10} columns={4} />
    </div>
  );
}

/** Detalhe de receita / calendário (mix ou timing) em carregamento. */
export function TemplateEditorSkeleton() {
  return (
    <div className="animate-in fade-in duration-200" aria-hidden>
      <Skeleton className="mb-4 h-4 w-28" />
      <PageHeaderSkeleton withAction />
      <div className="mb-4 flex items-center justify-between gap-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-9 w-40 rounded-md" />
      </div>
      <TableRowsSkeleton rows={8} columns={4} />
    </div>
  );
}

/** Relatórios: KPIs + painel principal + rail direito. */
export function ReportPageSkeleton() {
  return (
    <div className="space-y-5 animate-in fade-in duration-200" aria-hidden>
      <DashboardKpiSkeleton cards={4} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Skeleton className="h-[360px] w-full rounded-xl border border-border" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-56 w-full rounded-xl border border-border" />
          <Skeleton className="h-40 w-full rounded-xl border border-border" />
        </div>
      </div>
    </div>
  );
}
