"use client";

import { useMemo, useState } from "react";
import { useForm, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { PageHeader } from "@/components/domain/page-header";
import { apiErrorMessage } from "@recomenda/api/api-error";
import { CreditCard, Plus } from "lucide-react";
import { SegmentedTabs } from "@/components/domain/segmented-tabs";
import { StatusBadge } from "@/components/domain/status-badge";
import { DeletePermanentIconButton } from "@/components/domain/delete-permanent-icon-button";
import { TableRowsSkeleton } from "@/components/domain/page-skeletons";
import { AdminListFilter } from "@/components/domain/admin-list-filter";
import { DataTable } from "@recomenda/ui/patterns/data-table";
import { Button } from "@recomenda/ui/primitives/button";
import { Input } from "@recomenda/ui/primitives/input";
import { Label } from "@recomenda/ui/primitives/label";
import { Textarea } from "@recomenda/ui/primitives/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@recomenda/ui/primitives/sheet";
import type { Plan } from "@recomenda/api";
import {
  useCreateAdminPlan,
  useDeleteAdminPlan,
  usePlans,
  useUpdateAdminPlan,
} from "@recomenda/api-hooks";
import { deactivateOutlineButtonClass } from "@recomenda/utils";

const planFormSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  slug: z
    .string()
    .min(1, "Slug obrigatório")
    .regex(/^[a-z0-9-]+$/, "Use letras minúsculas, números e hífen"),
  plot_quota: z
    .string()
    .refine((s) => s.trim() === "" || /^\d+$/.test(s), "Quota inválida"),
  timing_template_quota: z
    .string()
    .min(1, "Informe a quota")
    .refine((s) => /^\d+$/.test(s) && parseInt(s, 10) >= 1, "Quota mínima 1"),
  price_brl_monthly: z
    .string()
    .min(1, "Informe o preço")
    .refine((s) => {
      const n = parseFloat(s.replace(",", "."));
      return !Number.isNaN(n) && n >= 0;
    }, "Preço deve ser zero ou positivo"),
  billing_kind: z.enum(["free", "monthly", "harvest"]),
  includes_whatsapp: z.boolean(),
  plot_range: z.string(),
  description: z.string(),
  features: z.string(),
  sort_order: z.string().refine((s) => /^\d+$/.test(s), "Ordem inválida"),
  is_active: z.boolean(),
});

type PlanFormValues = z.infer<typeof planFormSchema>;

const emptyPlanForm: PlanFormValues = {
  name: "",
  slug: "",
  plot_quota: "10",
  timing_template_quota: "3",
  price_brl_monthly: "0",
  billing_kind: "monthly",
  includes_whatsapp: false,
  plot_range: "",
  description: "",
  features: "",
  sort_order: "100",
  is_active: true,
};

function parseQuota(value: string): number | null {
  const t = value.trim();
  if (!t) return null;
  return parseInt(t, 10);
}

function parseFeatures(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function featuresToText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value.map((item) => String(item).trim()).filter(Boolean).join("\n");
}

function toPlanWritePayload(values: PlanFormValues) {
  return {
    name: values.name,
    slug: values.slug,
    plot_quota: parseQuota(values.plot_quota),
    timing_template_quota: parseInt(values.timing_template_quota, 10),
    price_brl_monthly: parseFloat(values.price_brl_monthly.replace(",", ".")),
    billing_kind: values.billing_kind,
    includes_whatsapp: values.includes_whatsapp,
    plot_range: values.plot_range.trim() || null,
    description: values.description.trim() || null,
    features: parseFeatures(values.features),
    sort_order: parseInt(values.sort_order, 10),
    is_active: values.is_active,
  };
}

function PlanVitrineFields({
  register,
  idPrefix,
}: {
  register: UseFormRegister<PlanFormValues>;
  idPrefix: string;
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-range`}>Faixa na vitrine</Label>
        <Input
          id={`${idPrefix}-range`}
          placeholder="Ex.: Até 10 talhões"
          {...register("plot_range")}
        />
        <p className="text-xs text-muted-foreground">Linha abaixo do nome em /planos.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-description`}>Descrição</Label>
        <Textarea
          id={`${idPrefix}-description`}
          rows={3}
          placeholder="Texto do card na página de planos"
          {...register("description")}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-features`}>Benefícios (um por linha)</Label>
        <Textarea
          id={`${idPrefix}-features`}
          rows={5}
          placeholder={"Até 10 talhões cadastrados\nCompartilhamento ilimitado"}
          {...register("features")}
        />
        <p className="text-xs text-muted-foreground">Cada linha vira um item com check no card.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-order`}>Ordem na vitrine</Label>
        <Input id={`${idPrefix}-order`} type="number" min={0} {...register("sort_order")} />
      </div>
    </>
  );
}

type PlansTab = "ativos" | "removidos";


export default function AdminPlansPage() {
  const { data: plans, isLoading } = usePlans();
  const createMutation = useCreateAdminPlan();
  const updateMutation = useUpdateAdminPlan();
  const deleteMutation = useDeleteAdminPlan();
  const [filter, setFilter] = useState("");
  const [activeTab, setActiveTab] = useState<PlansTab>("ativos");
  const [createOpen, setCreateOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<Plan | null>(null);

  const createForm = useForm<PlanFormValues>({
    resolver: zodResolver(planFormSchema),
    defaultValues: emptyPlanForm,
  });

  const editForm = useForm<PlanFormValues>({
    resolver: zodResolver(planFormSchema),
    defaultValues: emptyPlanForm,
  });

  const removedCount = useMemo(() => (plans ?? []).filter((p) => !p.is_active).length, [plans]);

  const tabPlans = useMemo(() => {
    const list = plans ?? [];
    if (activeTab === "ativos") return list.filter((p) => p.is_active);
    return list.filter((p) => !p.is_active);
  }, [plans, activeTab]);

  const filteredPlans = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return tabPlans;
    return tabPlans.filter((p) => {
      const statusLabel = p.is_active ? "ativo" : "removido";
      const blob = `${p.name} ${p.plot_quota} ${p.price_brl_monthly} ${statusLabel}`.toLowerCase();
      return blob.includes(q);
    });
  }, [tabPlans, filter]);

  const mutationPending =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const openEdit = (p: Plan) => {
    setEditPlan(p);
    editForm.reset({
      name: p.name,
      slug: p.slug,
      plot_quota: p.plot_quota == null ? "" : String(p.plot_quota),
      timing_template_quota: String(p.timing_template_quota),
      price_brl_monthly: String(Number(p.price_brl_monthly)),
      billing_kind: p.billing_kind ?? "monthly",
      includes_whatsapp: Boolean(p.includes_whatsapp),
      plot_range: p.plot_range ?? "",
      description: p.description ?? "",
      features: featuresToText(p.features),
      sort_order: String(p.sort_order ?? 100),
      is_active: p.is_active,
    });
  };

  const onCreateSubmit = createForm.handleSubmit((values) => {
    createMutation.mutate(
      toPlanWritePayload(values),
      {
        onSuccess: () => {
          toast.success("Plano criado.");
          setCreateOpen(false);
          createForm.reset(emptyPlanForm);
        },
        onError: (e) => toast.error(apiErrorMessage(e, "Não foi possível criar o plano.")),
      },
    );
  });

  const onEditSubmit = editForm.handleSubmit((values) => {
    if (!editPlan) return;
    updateMutation.mutate(
      {
        id: editPlan.id,
        payload: toPlanWritePayload(values),
      },
      {
        onSuccess: () => {
          toast.success("Plano atualizado.");
          setEditPlan(null);
        },
        onError: (e) => toast.error(apiErrorMessage(e, "Não foi possível salvar o plano.")),
      },
    );
  });

  const onRemoveFromActive = (p: Plan) => {
    if (
      !globalThis.confirm(
        `Remover o plano "${p.name}" da listagem ativa? Ele deixará de aparecer para novas contratações; agrônomos já vinculados não são alterados.`,
      )
    ) {
      return;
    }
    updateMutation.mutate(
      { id: p.id, payload: { is_active: false } },
      {
        onSuccess: () => toast.success("Plano removido da listagem ativa."),
        onError: (e) => toast.error(apiErrorMessage(e, "Não foi possível remover o plano.")),
      },
    );
  };

  const onReactivate = (p: Plan) => {
    updateMutation.mutate(
      { id: p.id, payload: { is_active: true } },
      {
        onSuccess: () => toast.success("Plano reativado."),
        onError: (e) => toast.error(apiErrorMessage(e, "Não foi possível reativar o plano.")),
      },
    );
  };

  const onDeletePermanent = (p: Plan) => {
    if (
      !globalThis.confirm(
        `Excluir permanentemente o plano "${p.name}"? Esta ação não pode ser desfeita.`,
      )
    ) {
      return;
    }
    deleteMutation.mutate(p.id, {
      onSuccess: () => toast.success("Plano excluído."),
      onError: (e) => toast.error(apiErrorMessage(e, "Não foi possível excluir o plano.")),
    });
  };

  const activeRows =
    filteredPlans?.map((p) => [
      p.name,
      p.plot_quota == null ? "Ilimitado" : String(p.plot_quota),
      String(p.timing_template_quota),
      `R$ ${Number(p.price_brl_monthly).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês`,
      <StatusBadge key={`st-a-${p.id}`} tone="success">Ativo</StatusBadge>,
      <div key={`a-${p.id}`} className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => openEdit(p)} disabled={mutationPending}>
          Editar
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={deactivateOutlineButtonClass}
          onClick={() => onRemoveFromActive(p)}
          disabled={mutationPending}
        >
          Remover
        </Button>
      </div>,
    ]) ?? [];

  const removedRows =
    filteredPlans?.map((p) => [
      p.name,
      p.plot_quota == null ? "Ilimitado" : String(p.plot_quota),
      String(p.timing_template_quota),
      `R$ ${Number(p.price_brl_monthly).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês`,
      <StatusBadge key={`st-r-${p.id}`} tone="neutral">Removido</StatusBadge>,
      <div key={`r-${p.id}`} className="flex flex-wrap justify-end gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => openEdit(p)} disabled={mutationPending}>
          Editar
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => onReactivate(p)} disabled={mutationPending}>
          Reativar
        </Button>
        <DeletePermanentIconButton disabled={mutationPending} onClick={() => onDeletePermanent(p)} />
      </div>,
    ]) ?? [];

  return (
    <>
      <PageHeader
        icon={<CreditCard className="h-5 w-5" />}
        section="Assinaturas"
        title="Planos"
        description="O que você edita aqui (nome, preço, faixa, descrição e benefícios) aparece na página pública /planos para planos ativos. Remova da listagem ativa ou exclua definitivamente itens sem vínculos."
      />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedTabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v);
            setFilter("");
          }}
          items={[
            { value: "ativos", label: "Ativos" },
            { value: "removidos", label: "Removidos", badgeCount: removedCount },
          ]}
        />
      </div>

      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <AdminListFilter
          value={filter}
          onChange={setFilter}
          placeholder="Filtrar por nome, quota, preço..."
        />
        {activeTab === "ativos" ? (
          <Sheet open={createOpen} onOpenChange={setCreateOpen}>
            <SheetTrigger asChild>
              <Button type="button" variant="clay">
                <Plus className="h-4 w-4" />
                Novo plano
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
              <SheetHeader>
                <SheetTitle>Novo plano</SheetTitle>
              </SheetHeader>
              <form onSubmit={onCreateSubmit} className="space-y-4 px-4 pb-4">
                <div className="space-y-1.5">
                  <Label htmlFor="plan-create-name">Nome</Label>
                  <Input id="plan-create-name" {...createForm.register("name")} />
                  {createForm.formState.errors.name && (
                    <p className="text-xs text-destructive">{createForm.formState.errors.name.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="plan-create-slug">Slug</Label>
                  <Input id="plan-create-slug" {...createForm.register("slug")} />
                  {createForm.formState.errors.slug && (
                    <p className="text-xs text-destructive">{createForm.formState.errors.slug.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="plan-create-kind">Cobrança</Label>
                  <select
                    id="plan-create-kind"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    {...createForm.register("billing_kind")}
                  >
                    <option value="free">Grátis</option>
                    <option value="monthly">Mensal</option>
                    <option value="harvest">12 meses</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="plan-create-quota">Quota de talhões (vazio = ilimitado)</Label>
                  <Input id="plan-create-quota" type="number" min={1} {...createForm.register("plot_quota")} />
                  {createForm.formState.errors.plot_quota && (
                    <p className="text-xs text-destructive">{createForm.formState.errors.plot_quota.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="plan-create-tquota">Quota de modelos</Label>
                  <Input id="plan-create-tquota" type="number" min={1} {...createForm.register("timing_template_quota")} />
                  {createForm.formState.errors.timing_template_quota && (
                    <p className="text-xs text-destructive">{createForm.formState.errors.timing_template_quota.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="plan-create-price">Preço mensal (R$)</Label>
                  <Input id="plan-create-price" type="number" step="0.01" min={0} {...createForm.register("price_brl_monthly")} />
                  {createForm.formState.errors.price_brl_monthly && (
                    <p className="text-xs text-destructive">
                      {createForm.formState.errors.price_brl_monthly.message}
                    </p>
                  )}
                </div>
                <PlanVitrineFields register={createForm.register} idPrefix="plan-create" />
                <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-input bg-background accent-primary"
                    checked={createForm.watch("includes_whatsapp")}
                    onChange={(e) =>
                      createForm.setValue("includes_whatsapp", e.target.checked, {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                  />
                  Inclui WhatsApp
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-input bg-background accent-primary focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                    checked={createForm.watch("is_active")}
                    onChange={(e) =>
                      createForm.setValue("is_active", e.target.checked, { shouldValidate: true, shouldDirty: true })
                    }
                  />
                  Plano ativo
                </label>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Salvando…" : "Criar"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                    Fechar
                  </Button>
                </div>
              </form>
            </SheetContent>
          </Sheet>
        ) : null}
      </div>

      {isLoading ? (
        <TableRowsSkeleton rows={8} columns={5} />
      ) : (
        <DataTable
          headers={["Nome", "Quota de talhões", "Quota de modelos", "Preço", "Status", ""]}
          rows={activeTab === "ativos" ? activeRows : removedRows}
        />
      )}

      <Sheet open={Boolean(editPlan)} onOpenChange={(o) => !o && setEditPlan(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Editar plano</SheetTitle>
          </SheetHeader>
          <form onSubmit={onEditSubmit} className="space-y-4 px-4 pb-4">
            <div className="space-y-1.5">
              <Label htmlFor="plan-edit-name">Nome</Label>
              <Input id="plan-edit-name" {...editForm.register("name")} />
              {editForm.formState.errors.name && (
                <p className="text-xs text-destructive">{editForm.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-edit-slug">Slug</Label>
              <Input id="plan-edit-slug" {...editForm.register("slug")} />
              {editForm.formState.errors.slug && (
                <p className="text-xs text-destructive">{editForm.formState.errors.slug.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-edit-kind">Cobrança</Label>
              <select
                id="plan-edit-kind"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...editForm.register("billing_kind")}
              >
                <option value="free">Grátis</option>
                <option value="monthly">Mensal</option>
                <option value="harvest">12 meses</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-edit-quota">Quota de talhões (vazio = ilimitado)</Label>
              <Input id="plan-edit-quota" type="number" min={1} {...editForm.register("plot_quota")} />
              {editForm.formState.errors.plot_quota && (
                <p className="text-xs text-destructive">{editForm.formState.errors.plot_quota.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-edit-tquota">Quota de modelos</Label>
              <Input id="plan-edit-tquota" type="number" min={1} {...editForm.register("timing_template_quota")} />
              {editForm.formState.errors.timing_template_quota && (
                <p className="text-xs text-destructive">{editForm.formState.errors.timing_template_quota.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-edit-price">Preço mensal (R$)</Label>
              <Input id="plan-edit-price" type="number" step="0.01" min={0} {...editForm.register("price_brl_monthly")} />
              {editForm.formState.errors.price_brl_monthly && (
                <p className="text-xs text-destructive">{editForm.formState.errors.price_brl_monthly.message}</p>
              )}
            </div>
            <PlanVitrineFields register={editForm.register} idPrefix="plan-edit" />
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="size-4 rounded border-input bg-background accent-primary"
                checked={editForm.watch("includes_whatsapp")}
                onChange={(e) =>
                  editForm.setValue("includes_whatsapp", e.target.checked, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
              />
              Inclui WhatsApp
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="size-4 rounded border-input bg-background accent-primary focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                checked={editForm.watch("is_active")}
                onChange={(e) =>
                  editForm.setValue("is_active", e.target.checked, { shouldValidate: true, shouldDirty: true })
                }
              />
              Plano na listagem ativa
            </label>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Salvando…" : "Salvar"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setEditPlan(null)}>
                Fechar
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
