"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageHeader } from "@/components/domain/page-header";
import { DataTable } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useCreateInvitation, useFarms, useImpersonateProducer, useProducers } from "@/lib/api/hooks";
import { TableRowsSkeleton } from "@/components/domain/page-skeletons";
import { AdminListFilter } from "@/components/domain/admin-list-filter";
import { cn } from "@/lib/utils";
import type { AgronomistProducerListRow } from "@/lib/api/client";
import { ProducerAccountStatusBadge } from "@/components/domain/producer-account-status-badge";

const inviteSchema = z.object({
  email: z.string().email("E-mail inválido"),
  farm_ids: z.array(z.string()).min(1, "Selecione ao menos uma fazenda"),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

function rowKey(p: AgronomistProducerListRow): string {
  return p.row_type === "producer" ? `p-${p.producer_id}` : `i-${p.invitation_id}`;
}

export default function ProducersPage() {
  const { data, isLoading } = useProducers();
  const { data: farmsData } = useFarms();
  const impersonateMutation = useImpersonateProducer();
  const createInvitation = useCreateInvitation();
  const [open, setOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [filter, setFilter] = useState("");

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", farm_ids: [] },
  });

  const onSubmit = form.handleSubmit((values) => {
    createInvitation.mutate(values, {
      onSuccess: (data) => {
        setInviteLink(data.link);
        form.reset();
      },
    });
  });

  const farms = farmsData?.data ?? [];
  const list = useMemo(() => data?.data ?? [], [data]);

  const activeList = useMemo(
    () => list.filter((p) => p.row_type === "invitation" || p.is_active),
    [list],
  );
  const archivedList = useMemo(
    () => list.filter((p) => p.row_type === "producer" && !p.is_active),
    [list],
  );

  const sourceList = tab === "active" ? activeList : archivedList;

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return sourceList;
    return sourceList.filter((p) => {
      const blob =
        `${p.name} ${p.email} ${p.producer_id ?? ""} ${p.invitation_id ?? ""} ${p.account_status}`.toLowerCase();
      return blob.includes(q);
    });
  }, [sourceList, filter]);

  const activeRows = filtered.map((p) => [
    p.row_type === "producer" && p.producer_id ? (
      <Link
        key={`name-${rowKey(p)}`}
        href={`/producers/${p.producer_id}`}
        className="font-medium text-[var(--brand)] underline"
      >
        {p.name}
      </Link>
    ) : (
      <span key={`name-${rowKey(p)}`} className="text-muted-foreground">
        {p.name}
      </span>
    ),
    p.email,
    <ProducerAccountStatusBadge key={`st-${rowKey(p)}`} status={p.account_status} />,
    <div key={`act-${rowKey(p)}`} className="flex flex-wrap justify-end gap-2">
      {p.row_type === "producer" && p.producer_id ? (
        <>
          <Button
            variant="outline"
            className="h-8 px-3 text-xs"
            onClick={() => {
              window.location.href = `/producers/${p.producer_id}`;
            }}
          >
            Editar
          </Button>
          <Button
            variant="secondary"
            className="h-8 px-3 text-xs"
            onClick={() => impersonateMutation.mutate(p.producer_id!)}
            disabled={impersonateMutation.isPending || !p.is_active}
            title={!p.is_active ? "Conta inativa" : undefined}
          >
            Acessar
          </Button>
        </>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      )}
    </div>,
  ]);

  const archivedRows = filtered.map((p) => [
    p.producer_id ? (
      <Link
        key={`name-${rowKey(p)}`}
        href={`/producers/${p.producer_id}`}
        className="font-medium text-[var(--brand)] underline"
      >
        {p.name}
      </Link>
    ) : (
      <span key={`name-${rowKey(p)}`}>{p.name}</span>
    ),
    p.email,
    <ProducerAccountStatusBadge key={`st-${rowKey(p)}`} status={p.account_status} />,
    <div key={`arc-${rowKey(p)}`} className="flex flex-wrap justify-end gap-2">
      {p.producer_id ? (
        <>
          <Button
            variant="outline"
            className="h-8 px-3 text-xs"
            onClick={() => {
              window.location.href = `/producers/${p.producer_id}`;
            }}
          >
            Editar
          </Button>
          <Button
            variant="secondary"
            className="h-8 px-3 text-xs"
            onClick={() => impersonateMutation.mutate(p.producer_id!)}
            disabled={impersonateMutation.isPending}
          >
            Acessar
          </Button>
        </>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      )}
    </div>,
  ]);

  const rows = tab === "active" ? activeRows : archivedRows;
  const headers = ["Nome", "E-mail", "Status", ""];

  return (
    <>
      <PageHeader
        title="Produtores"
        description="Contas vinculadas a você e convites pendentes. O status indica conta ativa, inativa ou convite (enviado / expirado). Na aba Inativos aparecem produtores com acesso desativado pelo administrador."
      />

      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2 lg:flex-1">
          <div className="flex gap-1 rounded-lg border border-zinc-200 bg-zinc-100 p-1">
            <button
              type="button"
              onClick={() => {
                setTab("active");
                setFilter("");
              }}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                tab === "active" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800",
              )}
            >
              Ativos
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("archived");
                setFilter("");
              }}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                tab === "archived" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800",
              )}
            >
              Inativos
              {archivedList.length > 0 && (
                <span className="ml-2 rounded-full bg-zinc-300 px-1.5 py-0.5 text-xs text-zinc-700">
                  {archivedList.length}
                </span>
              )}
            </button>
          </div>
          <div className="min-w-0 w-full sm:max-w-md lg:max-w-lg">
            <AdminListFilter
              value={filter}
              onChange={setFilter}
              placeholder="Filtrar por nome, e-mail ou ID..."
            />
          </div>
        </div>

        <Sheet
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) setInviteLink(null);
          }}
        >
          <SheetTrigger asChild>
            <Button className="shrink-0">Convidar produtor</Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:w-96">
            <SheetHeader>
              <SheetTitle>Convidar produtor</SheetTitle>
            </SheetHeader>

            {inviteLink ? (
              <div className="mt-6 space-y-4">
                <p className="text-sm text-zinc-600">
                  Convite gerado! Copie o link abaixo e envie ao produtor:
                </p>
                <div className="rounded-md border bg-zinc-50 p-3">
                  <p className="break-all text-xs text-zinc-700">{inviteLink}</p>
                </div>
                <Button className="w-full" onClick={() => navigator.clipboard.writeText(inviteLink)}>
                  Copiar link
                </Button>
                <Button variant="secondary" className="w-full" onClick={() => setInviteLink(null)}>
                  Novo convite
                </Button>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-700">E-mail do produtor</label>
                  <Input
                    {...form.register("email")}
                    type="email"
                    placeholder="produtor@exemplo.com"
                    autoFocus
                  />
                  {form.formState.errors.email && (
                    <p className="mt-1 text-xs text-red-600">{form.formState.errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-700">Fazendas com acesso</label>
                  {farms.length === 0 ? (
                    <p className="text-xs text-zinc-500">Nenhuma fazenda cadastrada.</p>
                  ) : (
                    <Controller
                      control={form.control}
                      name="farm_ids"
                      render={({ field }) => (
                        <div className="space-y-2 rounded-md border p-3">
                          {farms.map((farm) => (
                            <label key={farm.id} className="flex cursor-pointer items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                value={farm.id}
                                checked={field.value.includes(farm.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    field.onChange([...field.value, farm.id]);
                                  } else {
                                    field.onChange(field.value.filter((id) => id !== farm.id));
                                  }
                                }}
                                className="h-4 w-4 rounded border-zinc-300"
                              />
                              <span>{farm.name}</span>
                              {farm.location && <span className="text-zinc-400">· {farm.location}</span>}
                            </label>
                          ))}
                        </div>
                      )}
                    />
                  )}
                  {form.formState.errors.farm_ids && (
                    <p className="mt-1 text-xs text-red-600">{form.formState.errors.farm_ids.message}</p>
                  )}
                </div>

                <div className="pt-2">
                  <Button type="submit" disabled={createInvitation.isPending} className="w-full">
                    {createInvitation.isPending ? "Gerando convite..." : "Gerar convite"}
                  </Button>
                </div>
              </form>
            )}
          </SheetContent>
        </Sheet>
      </div>

      {isLoading ? (
        <TableRowsSkeleton rows={8} columns={4} />
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-500">
          {tab === "active" ? "Nenhum produtor ou convite na lista ativa." : "Nenhuma conta inativa."}
        </p>
      ) : (
        <DataTable headers={headers} rows={rows} />
      )}
    </>
  );
}
