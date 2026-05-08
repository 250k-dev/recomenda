"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { PageHeader } from "@/components/domain/page-header";
import { TableRowsSkeleton } from "@/components/domain/page-skeletons";
import { AdminListFilter } from "@/components/domain/admin-list-filter";
import { DataTable } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { Plan } from "@/lib/api/client";
import { useCreateAdminPlan, usePlans, useUpdateAdminPlan } from "@/lib/api/hooks";

const planFormSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  plot_quota: z
    .string()
    .min(1, "Informe a quota")
    .refine((s) => /^\d+$/.test(s) && parseInt(s, 10) >= 1, "Quota mínima 1"),
  price_brl_monthly: z
    .string()
    .min(1, "Informe o preço")
    .refine((s) => {
      const n = parseFloat(s.replace(",", "."));
      return !Number.isNaN(n) && n > 0;
    }, "Preço deve ser positivo"),
  is_active: z.boolean(),
});

type PlanFormValues = z.infer<typeof planFormSchema>;

export default function AdminPlansPage() {
  const { data: plans, isLoading } = usePlans();
  const createMutation = useCreateAdminPlan();
  const updateMutation = useUpdateAdminPlan();
  const [filter, setFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<Plan | null>(null);

  const createForm = useForm<PlanFormValues>({
    resolver: zodResolver(planFormSchema),
    defaultValues: { name: "", plot_quota: "10", price_brl_monthly: "0", is_active: true },
  });

  const editForm = useForm<PlanFormValues>({
    resolver: zodResolver(planFormSchema),
    defaultValues: { name: "", plot_quota: "1", price_brl_monthly: "0", is_active: true },
  });

  const filteredPlans = useMemo(() => {
    const list = plans ?? [];
    const q = filter.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => {
      const blob = `${p.name} ${p.plot_quota} ${p.price_brl_monthly} ${p.is_active ? "ativo" : "inativo"}`.toLowerCase();
      return blob.includes(q);
    });
  }, [plans, filter]);

  const openEdit = (p: Plan) => {
    setEditPlan(p);
    editForm.reset({
      name: p.name,
      plot_quota: String(p.plot_quota),
      price_brl_monthly: String(Number(p.price_brl_monthly)),
      is_active: p.is_active,
    });
  };

  const onCreateSubmit = createForm.handleSubmit((values) => {
    createMutation.mutate(
      {
        name: values.name,
        plot_quota: parseInt(values.plot_quota, 10),
        price_brl_monthly: parseFloat(values.price_brl_monthly.replace(",", ".")),
        is_active: values.is_active,
      },
      {
        onSuccess: () => {
          toast.success("Plano criado.");
          setCreateOpen(false);
          createForm.reset({ name: "", plot_quota: "10", price_brl_monthly: "0", is_active: true });
        },
        onError: () => toast.error("Não foi possível criar o plano."),
      },
    );
  });

  const onEditSubmit = editForm.handleSubmit((values) => {
    if (!editPlan) return;
    updateMutation.mutate(
      {
        id: editPlan.id,
        payload: {
          name: values.name,
          plot_quota: parseInt(values.plot_quota, 10),
          price_brl_monthly: parseFloat(values.price_brl_monthly.replace(",", ".")),
          is_active: values.is_active,
        },
      },
      {
        onSuccess: () => {
          toast.success("Plano atualizado.");
          setEditPlan(null);
        },
        onError: () => toast.error("Não foi possível salvar o plano."),
      },
    );
  });

  const rows =
    filteredPlans?.map((p) => [
      p.name,
      String(p.plot_quota),
      `R$ ${Number(p.price_brl_monthly).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês`,
      p.is_active ? "Ativo" : "Inativo",
      <Button key={`e-${p.id}`} type="button" variant="outline" size="sm" onClick={() => openEdit(p)}>
        Editar
      </Button>,
    ]) ?? [];

  return (
    <>
      <PageHeader title="Planos" description="Planos disponíveis na plataforma, quotas e preços mensais." />

      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <AdminListFilter value={filter} onChange={setFilter} placeholder="Filtrar por nome, quota, preço ou status..." />
        <Sheet open={createOpen} onOpenChange={setCreateOpen}>
          <SheetTrigger asChild>
            <Button type="button">Novo plano</Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Novo plano</SheetTitle>
            </SheetHeader>
            <form onSubmit={onCreateSubmit} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Nome</label>
                <Input {...createForm.register("name")} />
                {createForm.formState.errors.name && (
                  <p className="mt-1 text-xs text-red-600">{createForm.formState.errors.name.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Quota de talhões</label>
                <Input type="number" min={1} {...createForm.register("plot_quota")} />
                {createForm.formState.errors.plot_quota && (
                  <p className="mt-1 text-xs text-red-600">{createForm.formState.errors.plot_quota.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Preço mensal (R$)</label>
                <Input type="number" step="0.01" min={0} {...createForm.register("price_brl_monthly")} />
                {createForm.formState.errors.price_brl_monthly && (
                  <p className="mt-1 text-xs text-red-600">{createForm.formState.errors.price_brl_monthly.message}</p>
                )}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="rounded border-zinc-300"
                  checked={createForm.watch("is_active")}
                  onChange={(e) =>
                    createForm.setValue("is_active", e.target.checked, { shouldValidate: true, shouldDirty: true })
                  }
                />
                Plano ativo
              </label>
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Salvando..." : "Criar plano"}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
                  Fechar
                </Button>
              </div>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      {isLoading ? (
        <TableRowsSkeleton rows={8} columns={5} />
      ) : (
        <DataTable headers={["Nome", "Quota de talhões", "Preço", "Status", ""]} rows={rows} />
      )}

      <Sheet open={Boolean(editPlan)} onOpenChange={(o) => !o && setEditPlan(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Editar plano</SheetTitle>
          </SheetHeader>
          <form onSubmit={onEditSubmit} className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">Nome</label>
              <Input {...editForm.register("name")} />
              {editForm.formState.errors.name && (
                <p className="mt-1 text-xs text-red-600">{editForm.formState.errors.name.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">Quota de talhões</label>
              <Input type="number" min={1} {...editForm.register("plot_quota")} />
              {editForm.formState.errors.plot_quota && (
                <p className="mt-1 text-xs text-red-600">{editForm.formState.errors.plot_quota.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">Preço mensal (R$)</label>
              <Input type="number" step="0.01" min={0} {...editForm.register("price_brl_monthly")} />
              {editForm.formState.errors.price_brl_monthly && (
                <p className="mt-1 text-xs text-red-600">{editForm.formState.errors.price_brl_monthly.message}</p>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="rounded border-zinc-300"
                checked={editForm.watch("is_active")}
                onChange={(e) =>
                  editForm.setValue("is_active", e.target.checked, { shouldValidate: true, shouldDirty: true })
                }
              />
              Plano ativo
            </label>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Salvando..." : "Salvar alterações"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setEditPlan(null)}>
                Fechar
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
