"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { PageHeader } from "@/components/domain/page-header";
import { TableRowsSkeleton } from "@/components/domain/page-skeletons";
import { AdminListFilter } from "@/components/domain/admin-list-filter";
import { DataTable } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SegmentedTabs } from "@/components/domain/segmented-tabs";
import { DeletePermanentIconButton } from "@/components/domain/delete-permanent-icon-button";
import { deactivateOutlineButtonClass } from "@/lib/action-button-styles";
import type { AdminAgronomist } from "@/lib/api/client";
import {
  useAdminAgronomists,
  useCreateAdminAgronomist,
  useDeleteAdminAgronomist,
  usePlans,
  useUpdateAdminAgronomist,
} from "@/lib/api/hooks";

const createSchema = z.object({
  name: z.string().min(2, "Nome obrigatório"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
  plan_id: z.string().min(1, "Plano obrigatório"),
});

const editSchema = z.object({
  name: z.string().min(2, "Nome obrigatório"),
  email: z.string().email("E-mail inválido"),
  password: z
    .string()
    .optional()
    .refine((p) => !p || p.length === 0 || p.length >= 6, "Senha deve ter ao menos 6 caracteres"),
  plan_id: z.string().min(1, "Plano obrigatório"),
  plan_started_at: z.string().min(1, "Data obrigatória"),
});

type CreateFormValues = z.infer<typeof createSchema>;
type EditFormValues = z.infer<typeof editSchema>;

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function apiErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const msg = error.response?.data as { message?: string } | undefined;
    if (msg?.message && typeof msg.message === "string") return msg.message;
  }
  return fallback;
}

export default function AdminAgronomistsPage() {
  const [tab, setTab] = useState<"active" | "inactive">("active");
  const { data: activeData, isLoading: loadingActive } = useAdminAgronomists("active");
  const { data: inactiveData, isLoading: loadingInactive } = useAdminAgronomists("inactive");
  const { data: plans } = usePlans();
  const createMutation = useCreateAdminAgronomist();
  const updateMutation = useUpdateAdminAgronomist();
  const deleteMutation = useDeleteAdminAgronomist();
  const [filter, setFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<AdminAgronomist | null>(null);

  const createForm = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", email: "", password: "", plan_id: "" },
  });

  const editForm = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      plan_id: "",
      plan_started_at: "",
    },
  });

  const activeList = useMemo(() => (Array.isArray(activeData) ? activeData : []), [activeData]);
  const inactiveList = useMemo(() => (Array.isArray(inactiveData) ? inactiveData : []), [inactiveData]);
  const sourceList = tab === "active" ? activeList : inactiveList;
  const isLoading = tab === "active" ? loadingActive : loadingInactive;

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return sourceList;
    return sourceList.filter((a) => {
      const blob = `${a.name} ${a.email} ${a.user_id} ${a.plan_id} ${a.active_plots_count}`.toLowerCase();
      return blob.includes(q);
    });
  }, [sourceList, filter]);

  const onCreate = createForm.handleSubmit(({ name, email, password, plan_id }) => {
    createMutation.mutate(
      { user: { name, email, password }, plan_id },
      {
        onSuccess: () => {
          toast.success("Agrônomo criado.");
          setCreateOpen(false);
          createForm.reset();
        },
        onError: (e) => toast.error(apiErrorMessage(e, "Não foi possível criar o agrônomo.")),
      },
    );
  });

  const openEdit = (a: AdminAgronomist) => {
    setEditRow(a);
    editForm.reset({
      name: a.name,
      email: a.email,
      password: "",
      plan_id: a.plan_id,
      plan_started_at: toDatetimeLocalValue(a.plan_started_at),
    });
  };

  const onEdit = editForm.handleSubmit((values) => {
    if (!editRow) return;
    updateMutation.mutate(
      {
        id: editRow.user_id,
        plan_id: values.plan_id,
        plan_started_at: new Date(values.plan_started_at).toISOString(),
        user: {
          name: values.name,
          email: values.email,
          ...(values.password && values.password.length > 0 ? { password: values.password } : {}),
        },
      },
      {
        onSuccess: () => {
          toast.success("Agrônomo atualizado.");
          setEditRow(null);
        },
        onError: (e) => toast.error(apiErrorMessage(e, "Não foi possível salvar as alterações.")),
      },
    );
  });

  const deactivate = (a: AdminAgronomist) => {
    if (!globalThis.confirm(`Desativar o agrônomo "${a.name}"? Ele não poderá mais entrar na plataforma.`)) return;
    updateMutation.mutate(
      { id: a.user_id, user: { is_active: false } },
      {
        onSuccess: () => toast.success("Agrônomo desativado."),
        onError: (e) => toast.error(apiErrorMessage(e, "Não foi possível desativar.")),
      },
    );
  };

  const reactivate = (a: AdminAgronomist) => {
    updateMutation.mutate(
      { id: a.user_id, user: { is_active: true } },
      {
        onSuccess: () => toast.success("Agrônomo reativado."),
        onError: (e) => toast.error(apiErrorMessage(e, "Não foi possível reativar.")),
      },
    );
  };

  const removeHard = (a: AdminAgronomist) => {
    if (
      !globalThis.confirm(
        `Excluir permanentemente "${a.name}"? Esta ação não pode ser desfeita. Só é permitido se não houver fazendas, produtores ou safras vinculados.`,
      )
    ) {
      return;
    }
    deleteMutation.mutate(a.user_id, {
      onSuccess: () => toast.success("Agrônomo excluído."),
      onError: (e) => toast.error(apiErrorMessage(e, "Não foi possível excluir.")),
    });
  };

  const activeRows = filtered.map((a) => [
    <Link key={`nm-${a.user_id}`} href={`/admin/agronomists/${a.user_id}`} className="font-medium text-primary hover:underline">
      {a.name}
    </Link>,
    a.email,
    plans?.find((p) => p.id === a.plan_id)?.name ?? a.plan_id,
    new Date(a.plan_started_at).toLocaleDateString("pt-BR"),
    String(a.active_plots_count),
    <div key={`act-${a.user_id}`} className="flex flex-wrap justify-end gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => openEdit(a)}>
        Editar
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={deactivateOutlineButtonClass}
        disabled={updateMutation.isPending}
        onClick={() => deactivate(a)}
      >
        Desativar
      </Button>
    </div>,
  ]);

  const inactiveRows = filtered.map((a) => [
    <Link key={`nm-${a.user_id}`} href={`/admin/agronomists/${a.user_id}`} className="font-medium text-primary hover:underline">
      {a.name}
    </Link>,
    a.email,
    plans?.find((p) => p.id === a.plan_id)?.name ?? a.plan_id,
    new Date(a.plan_started_at).toLocaleDateString("pt-BR"),
    String(a.active_plots_count),
    <div key={`ina-${a.user_id}`} className="flex flex-wrap justify-end gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => openEdit(a)}>
        Editar
      </Button>
      <Button type="button" variant="secondary" size="sm" disabled={updateMutation.isPending} onClick={() => reactivate(a)}>
        Reativar
      </Button>
      <DeletePermanentIconButton disabled={deleteMutation.isPending} onClick={() => removeHard(a)} />
    </div>,
  ]);

  const rows = tab === "active" ? activeRows : inactiveRows;

  return (
    <>
      <PageHeader
        title="Agrônomos"
        description="Contas ativas e inativas. Desative para bloquear acesso; na aba Inativos você pode reativar ou excluir definitivamente."
      />

      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <SegmentedTabs
          value={tab}
          onValueChange={(v) => {
            setTab(v);
            setFilter("");
          }}
          items={[
            { value: "active", label: "Ativos" },
            { value: "inactive", label: "Inativos", badgeCount: inactiveList.length },
          ]}
        />

        <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-end sm:justify-end">
          <div className="min-w-0 flex-1 sm:max-w-md">
            <AdminListFilter value={filter} onChange={setFilter} placeholder="Filtrar por nome, e-mail, plano ou ID..." />
          </div>
          {tab === "active" && (
            <Sheet open={createOpen} onOpenChange={setCreateOpen}>
              <SheetTrigger asChild>
                <Button type="button" className="shrink-0">
                  Novo agrônomo
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>Novo agrônomo</SheetTitle>
                </SheetHeader>
                <form onSubmit={onCreate} className="mt-6 space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-700">Nome</label>
                    <Input {...createForm.register("name")} placeholder="Nome completo" />
                    {createForm.formState.errors.name && (
                      <p className="mt-1 text-xs text-red-600">{createForm.formState.errors.name.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-700">E-mail</label>
                    <Input type="email" {...createForm.register("email")} placeholder="email@exemplo.com" />
                    {createForm.formState.errors.email && (
                      <p className="mt-1 text-xs text-red-600">{createForm.formState.errors.email.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-700">Senha inicial</label>
                    <Input type="password" autoComplete="new-password" {...createForm.register("password")} />
                    {createForm.formState.errors.password && (
                      <p className="mt-1 text-xs text-red-600">{createForm.formState.errors.password.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-700">Plano</label>
                    <select
                      {...createForm.register("plan_id")}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Selecione...</option>
                      {plans?.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    {createForm.formState.errors.plan_id && (
                      <p className="mt-1 text-xs text-red-600">{createForm.formState.errors.plan_id.message}</p>
                    )}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? "Criando..." : "Criar agrônomo"}
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
                      Fechar
                    </Button>
                  </div>
                </form>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>

      {isLoading ? (
        <TableRowsSkeleton rows={10} columns={6} />
      ) : (
        <DataTable
          headers={["Nome", "E-mail", "Plano", "Início do plano", "Talhões ativos", "Ações"]}
          rows={rows}
        />
      )}

      <Sheet open={Boolean(editRow)} onOpenChange={(o) => !o && setEditRow(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Editar agrônomo</SheetTitle>
          </SheetHeader>
          <form onSubmit={onEdit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">Nome</label>
              <Input {...editForm.register("name")} />
              {editForm.formState.errors.name && (
                <p className="mt-1 text-xs text-red-600">{editForm.formState.errors.name.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">E-mail</label>
              <Input type="email" {...editForm.register("email")} />
              {editForm.formState.errors.email && (
                <p className="mt-1 text-xs text-red-600">{editForm.formState.errors.email.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">Nova senha (opcional)</label>
              <Input type="password" autoComplete="new-password" placeholder="Deixe em branco para manter" {...editForm.register("password")} />
              {editForm.formState.errors.password && (
                <p className="mt-1 text-xs text-red-600">{editForm.formState.errors.password.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">Plano</label>
              <select
                {...editForm.register("plan_id")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {plans?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">Início do plano</label>
              <Input type="datetime-local" {...editForm.register("plan_started_at")} />
              {editForm.formState.errors.plan_started_at && (
                <p className="mt-1 text-xs text-red-600">{editForm.formState.errors.plan_started_at.message}</p>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setEditRow(null)}>
                Fechar
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
