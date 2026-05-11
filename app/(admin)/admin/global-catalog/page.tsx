"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { PageHeader } from "@/components/domain/page-header";
import { SegmentedTabs } from "@/components/domain/segmented-tabs";
import { DeletePermanentIconButton } from "@/components/domain/delete-permanent-icon-button";
import { TableRowsSkeleton } from "@/components/domain/page-skeletons";
import { AdminListFilter } from "@/components/domain/admin-list-filter";
import { DataTable } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { AdminDeactivatedCatalogEntry, AdminPlatformActiveEntry, GlobalProduct } from "@/lib/api/client";
import {
  DOSE_UNIT_LABELS,
  GLOBAL_DOSE_UNITS,
  GLOBAL_PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
} from "@/lib/catalog-global-options";
import {
  useCreateGlobalProduct,
  useDeleteGlobalProduct,
  useDeleteLocalProductAdmin,
  useAdminPlatformActiveCatalog,
  useAdminDeactivatedCatalog,
  useUpdateGlobalProduct,
  useUpdateLocalProduct,
} from "@/lib/api/hooks";
import { deactivateOutlineButtonClass } from "@/lib/action-button-styles";

const productSchema = z
  .object({
    name: z.string().min(1, "Nome obrigatório"),
    category: z.string().min(1),
    dose_unit: z.string().min(1),
    default_label_url: z.string().optional(),
    equivalence_group: z.string().optional(),
    is_active: z.boolean(),
  })
  .refine((d) => (GLOBAL_PRODUCT_CATEGORIES as readonly string[]).includes(d.category), {
    message: "Categoria inválida",
    path: ["category"],
  })
  .refine((d) => (GLOBAL_DOSE_UNITS as readonly string[]).includes(d.dose_unit), {
    message: "Unidade inválida",
    path: ["dose_unit"],
  });

type ProductFormValues = z.infer<typeof productSchema>;

const customProductSchema = z
  .object({
    name: z.string().min(1, "Nome obrigatório"),
    category: z.string().min(1),
    dose_unit: z.string().min(1),
    price_brl: z.string().optional(),
    label_url: z.string().optional(),
    is_active: z.boolean(),
  })
  .refine((d) => (GLOBAL_PRODUCT_CATEGORIES as readonly string[]).includes(d.category), {
    message: "Categoria inválida",
    path: ["category"],
  })
  .refine((d) => (GLOBAL_DOSE_UNITS as readonly string[]).includes(d.dose_unit), {
    message: "Unidade inválida",
    path: ["dose_unit"],
  });

type CustomProductFormValues = z.infer<typeof customProductSchema>;

const DOSE_UNITS: Record<string, string> = {
  L: "L (Litro)",
  KG: "kg (Quilograma)",
  G: "g (Grama)",
  ML: "mL (Mililitro)",
  DOSE: "Dose",
};

function AdminProductRowActions(props: {
  onEdit: () => void;
  onDeactivate: () => void;
  disableActions: boolean;
  actionKey: string;
}) {
  return (
    <div key={props.actionKey} className="flex flex-wrap justify-end gap-2">
      <Button type="button" variant="outline" size="sm" onClick={props.onEdit} disabled={props.disableActions}>
        Editar
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={deactivateOutlineButtonClass}
        onClick={props.onDeactivate}
        disabled={props.disableActions}
      >
        Desativar
      </Button>
    </div>
  );
}

/** Coluna Origem: curta — oficial vs. só nome do consultor (tooltip se truncar). */
function OriginCell({ row }: { row: AdminPlatformActiveEntry }) {
  if (row.entry_type === "GLOBAL") {
    return <span className="text-muted-foreground">Plataforma</span>;
  }
  const name = row.owner_name?.trim();
  if (!name) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className="block max-w-[10rem] truncate sm:max-w-[14rem]" title={name}>
      {name}
    </span>
  );
}

export default function AdminGlobalCatalogPage() {
  const { data: platformRes, isLoading: platformLoading } = useAdminPlatformActiveCatalog();
  const { data: deactivatedRes, isLoading: deactivatedLoading } = useAdminDeactivatedCatalog();
  const createMutation = useCreateGlobalProduct();
  const updateGlobalMutation = useUpdateGlobalProduct();
  const updateLocalMutation = useUpdateLocalProduct();
  const deleteGlobalMutation = useDeleteGlobalProduct();
  const deleteLocalMutation = useDeleteLocalProductAdmin();
  const [filter, setFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<GlobalProduct | null>(null);
  const [editCustomRow, setEditCustomRow] = useState<AdminPlatformActiveEntry | null>(null);
  const [activeTab, setActiveTab] = useState<"global" | "customizados" | "desativados">("global");

  const platformRows = platformRes?.data ?? [];

  const filteredPlatform = useMemo(() => {
    if (activeTab !== "global") return platformRows;
    const q = filter.trim().toLowerCase();
    if (!q) return platformRows;
    return platformRows.filter((p) => {
      const originSearch =
        p.entry_type === "GLOBAL"
          ? "plataforma oficial global"
          : `${p.owner_name ?? ""} ${p.owner_agronomist_id ?? ""}`.trim().toLowerCase();
      const blob = `${p.name} ${p.category} ${p.dose_unit} ${originSearch}`.toLowerCase();
      return blob.includes(q);
    });
  }, [platformRows, filter, activeTab]);

  const customizedRows = useMemo(() => platformRows.filter((p) => p.entry_type === "CUSTOM"), [platformRows]);

  const createForm = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      category: "OTHER",
      dose_unit: "L",
      default_label_url: "",
      equivalence_group: "",
      is_active: true,
    },
  });

  const editForm = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      category: "OTHER",
      dose_unit: "L",
      default_label_url: "",
      equivalence_group: "",
      is_active: true,
    },
  });

  const customEditForm = useForm<CustomProductFormValues>({
    resolver: zodResolver(customProductSchema),
    defaultValues: {
      name: "",
      category: "OTHER",
      dose_unit: "L",
      price_brl: "",
      label_url: "",
      is_active: true,
    },
  });

  const mutationPending =
    createMutation.isPending ||
    updateGlobalMutation.isPending ||
    updateLocalMutation.isPending ||
    deleteGlobalMutation.isPending ||
    deleteLocalMutation.isPending;

  const openEditFromPlatform = (row: AdminPlatformActiveEntry) => {
    if (row.entry_type !== "GLOBAL" || !row.global_product_id) return;
    const gp: GlobalProduct = {
      id: row.global_product_id,
      name: row.name,
      category: row.category,
      dose_unit: row.dose_unit,
      default_label_url: row.default_label_url ?? row.label_url ?? null,
      equivalence_group: row.equivalence_group ?? null,
      is_active: row.is_active !== false,
    };
    setEditProduct(gp);
    editForm.reset({
      name: gp.name,
      category: gp.category,
      dose_unit: gp.dose_unit,
      default_label_url: gp.default_label_url ?? "",
      equivalence_group: gp.equivalence_group ?? "",
      is_active: gp.is_active !== false,
    });
  };

  const openEditCustom = (row: AdminPlatformActiveEntry) => {
    if (row.entry_type !== "CUSTOM" || !row.local_product_id) return;
    setEditCustomRow(row);
    customEditForm.reset({
      name: row.name,
      category: row.category,
      dose_unit: row.dose_unit,
      price_brl: row.price_brl != null ? String(row.price_brl) : "",
      label_url: row.label_url?.trim() ? row.label_url : "",
      is_active: row.is_active !== false,
    });
  };

  const payloadFromForm = (v: ProductFormValues) => ({
    name: v.name,
    category: v.category,
    dose_unit: v.dose_unit,
    default_label_url: v.default_label_url?.trim() ? v.default_label_url.trim() : null,
    equivalence_group: v.equivalence_group?.trim() ? v.equivalence_group.trim() : null,
    is_active: v.is_active,
  });

  const onCreate = createForm.handleSubmit((values) => {
    createMutation.mutate(payloadFromForm(values), {
      onSuccess: () => {
        toast.success("Produto criado.");
        setCreateOpen(false);
        createForm.reset();
      },
      onError: () => toast.error("Não foi possível criar o produto."),
    });
  });

  const onEditGlobal = editForm.handleSubmit((values) => {
    if (!editProduct) return;
    updateGlobalMutation.mutate(
      { id: editProduct.id, payload: payloadFromForm(values) },
      {
        onSuccess: () => {
          toast.success("Produto atualizado.");
          setEditProduct(null);
        },
        onError: () => toast.error("Não foi possível salvar."),
      },
    );
  });

  const onEditCustom = customEditForm.handleSubmit((values) => {
    if (!editCustomRow?.local_product_id) return;
    const priceTrim = values.price_brl?.trim() ?? "";
    updateLocalMutation.mutate(
      {
        id: editCustomRow.local_product_id,
        name: values.name,
        category: values.category,
        dose_unit: values.dose_unit,
        price_brl: priceTrim ? priceTrim.replace(",", ".") : undefined,
        label_url: values.label_url?.trim() ? values.label_url.trim() : undefined,
        is_active: values.is_active,
      },
      {
        onSuccess: () => {
          toast.success("Produto atualizado.");
          setEditCustomRow(null);
        },
        onError: () => toast.error("Não foi possível salvar."),
      },
    );
  });

  const onDeactivateGlobal = (row: AdminPlatformActiveEntry) => {
    if (!row.global_product_id) return;
    if (!globalThis.confirm(`Desativar o produto global "${row.name}"? Ele deixará de aparecer no catálogo ativo.`)) return;
    updateGlobalMutation.mutate(
      { id: row.global_product_id, payload: { is_active: false } },
      {
        onSuccess: () => toast.success("Produto desativado."),
        onError: () => toast.error("Não foi possível desativar."),
      },
    );
  };

  const onDeactivateCustom = (row: AdminPlatformActiveEntry) => {
    if (!row.local_product_id) return;
    if (!globalThis.confirm(`Desativar o produto customizado "${row.name}"?`)) return;
    updateLocalMutation.mutate(
      { id: row.local_product_id, is_active: false },
      {
        onSuccess: () => toast.success("Produto desativado."),
        onError: () => toast.error("Não foi possível desativar."),
      },
    );
  };

  const onDeleteDeactivated = (row: AdminDeactivatedCatalogEntry) => {
    const label = row.entry_type === "GLOBAL_INACTIVE" ? "produto global" : "produto customizado";
    if (!globalThis.confirm(`Excluir permanentemente este ${label} "${row.name}"? Esta ação não pode ser desfeita.`)) {
      return;
    }
    if (row.entry_type === "GLOBAL_INACTIVE" && row.global_product_id) {
      deleteGlobalMutation.mutate(row.global_product_id, {
        onSuccess: () => toast.success("Produto excluído."),
        onError: () => toast.error("Não foi possível excluir."),
      });
      return;
    }
    if (row.entry_type === "CUSTOM_INACTIVE" && row.local_product_id) {
      deleteLocalMutation.mutate(row.local_product_id, {
        onSuccess: () => toast.success("Produto excluído."),
        onError: () => toast.error("Não foi possível excluir."),
      });
    }
  };

  const onReactivateDeactivated = (row: AdminDeactivatedCatalogEntry) => {
    if (row.entry_type === "GLOBAL_INACTIVE" && row.global_product_id) {
      updateGlobalMutation.mutate(
        { id: row.global_product_id, payload: { is_active: true } },
        {
          onSuccess: () => toast.success("Produto global reativado."),
          onError: () => toast.error("Não foi possível reativar."),
        },
      );
      return;
    }
    if (row.entry_type === "CUSTOM_INACTIVE" && row.local_product_id) {
      updateLocalMutation.mutate(
        { id: row.local_product_id, is_active: true },
        {
          onSuccess: () => toast.success("Produto reativado."),
          onError: () => toast.error("Não foi possível reativar."),
        },
      );
    }
  };

  const globalTableRows = filteredPlatform.map((p) => {
    const origin = <OriginCell key={`o-${p.entry_type}-${p.global_product_id ?? p.local_product_id}`} row={p} />;

    const actions =
      p.entry_type === "GLOBAL" && p.global_product_id ? (
        <AdminProductRowActions
          actionKey={`g-${p.global_product_id}`}
          onEdit={() => openEditFromPlatform(p)}
          onDeactivate={() => onDeactivateGlobal(p)}
          disableActions={mutationPending}
        />
      ) : p.entry_type === "CUSTOM" && p.local_product_id ? (
        <AdminProductRowActions
          actionKey={`c-${p.local_product_id}`}
          onEdit={() => openEditCustom(p)}
          onDeactivate={() => onDeactivateCustom(p)}
          disableActions={mutationPending}
        />
      ) : (
        <span key={`e-${p.name}`} className="text-xs text-muted-foreground">
          —
        </span>
      );

    return [
      p.name,
      PRODUCT_CATEGORY_LABELS[p.category as keyof typeof PRODUCT_CATEGORY_LABELS] ?? p.category,
      DOSE_UNIT_LABELS[p.dose_unit as keyof typeof DOSE_UNIT_LABELS] ?? p.dose_unit,
      origin,
      actions,
    ];
  });

  const customizedTableRows = customizedRows.map((p) => {
    const owner = p.owner_name?.trim();
    const agronomistCell = owner ? (
      <span className="block max-w-[10rem] truncate sm:max-w-[14rem]" title={owner}>
        {owner}
      </span>
    ) : (
      "—"
    );
    return [
      p.name,
      PRODUCT_CATEGORY_LABELS[p.category as keyof typeof PRODUCT_CATEGORY_LABELS] ?? p.category,
      DOSE_UNITS[p.dose_unit as keyof typeof DOSE_UNITS]?.split(" ")[0] ?? p.dose_unit,
      p.price_brl ? `R$ ${parseFloat(String(p.price_brl)).toFixed(2)}` : "-",
      agronomistCell,
      p.local_product_id ? (
        <AdminProductRowActions
          actionKey={`ct-${p.local_product_id}`}
          onEdit={() => openEditCustom(p)}
          onDeactivate={() => onDeactivateCustom(p)}
          disableActions={mutationPending}
        />
      ) : (
        "—"
      ),
    ];
  });

  const inactiveProducts = deactivatedRes?.data ?? [];
  const inactiveRows = inactiveProducts.map((p) => [
    p.name,
    PRODUCT_CATEGORY_LABELS[p.category as keyof typeof PRODUCT_CATEGORY_LABELS] ?? p.category,
    DOSE_UNIT_LABELS[p.dose_unit as keyof typeof DOSE_UNIT_LABELS] ?? p.dose_unit,
    p.entry_type === "GLOBAL_INACTIVE" ? (
      <span className="text-muted-foreground">Plataforma</span>
    ) : p.agronomist_name?.trim() ? (
      <span className="block max-w-[10rem] truncate sm:max-w-[14rem]" title={p.agronomist_name.trim()}>
        {p.agronomist_name.trim()}
      </span>
    ) : (
      "—"
    ),
    <div key={`ina-${p.entry_type}-${p.global_product_id ?? p.local_product_id}`} className="flex flex-wrap justify-end gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onReactivateDeactivated(p)}
        disabled={mutationPending}
      >
        Reativar
      </Button>
      <DeletePermanentIconButton
        disabled={mutationPending}
        onClick={() => onDeleteDeactivated(p)}
      />
    </div>,
  ]);

  const selectClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <>
      <PageHeader
        title="Produtos"
        description="Como administrador, você pode editar e desativar produtos ativos; a exclusão definitiva fica na aba Desativados."
      />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedTabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v);
            if (v !== "global") setFilter("");
          }}
          items={[
            { value: "global", label: "Catálogo Global" },
            { value: "customizados", label: "Customizados" },
            { value: "desativados", label: "Desativados", badgeCount: inactiveProducts.length },
          ]}
        />
      </div>

      {activeTab === "global" && (
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <AdminListFilter value={filter} onChange={setFilter} placeholder="Filtrar por nome, categoria, unidade ou origem..." />
          <Sheet
            open={createOpen}
            onOpenChange={(open) => {
              setCreateOpen(open);
              if (open) {
                createForm.reset({
                  name: "",
                  category: "OTHER",
                  dose_unit: "L",
                  default_label_url: "",
                  equivalence_group: "",
                  is_active: true,
                });
              }
            }}
          >
            <SheetTrigger asChild>
              <Button type="button">Novo produto</Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-md">
              <SheetHeader>
                <SheetTitle>Novo produto global</SheetTitle>
              </SheetHeader>
              <form onSubmit={onCreate} className="mt-6 space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Nome</label>
                  <Input {...createForm.register("name")} />
                  {createForm.formState.errors.name && (
                    <p className="mt-1 text-xs text-red-600">{createForm.formState.errors.name.message}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Categoria</label>
                  <select {...createForm.register("category")} className={selectClass}>
                    {GLOBAL_PRODUCT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {PRODUCT_CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Unidade de dose</label>
                  <select {...createForm.register("dose_unit")} className={selectClass}>
                    {GLOBAL_DOSE_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {DOSE_UNIT_LABELS[u]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">URL do rótulo (opcional)</label>
                  <Input {...createForm.register("default_label_url")} placeholder="https://..." />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Grupo de equivalência (opcional)</label>
                  <Input {...createForm.register("equivalence_group")} />
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
                  Ativo no catálogo
                </label>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Salvando..." : "Criar"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
                    Fechar
                  </Button>
                </div>
              </form>
            </SheetContent>
          </Sheet>
        </div>
      )}

      {activeTab === "global" && (
        <>
          {platformLoading ? (
            <TableRowsSkeleton rows={10} columns={5} />
          ) : (
            <DataTable headers={["Nome", "Categoria", "Unidade", "Origem", "Ações"]} rows={globalTableRows} />
          )}
        </>
      )}

      {activeTab === "customizados" && (
        <>
          {platformLoading ? (
            <TableRowsSkeleton rows={10} columns={6} />
          ) : customizedRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">Nenhum produto customizado ativo</p>
          ) : (
            <DataTable
              headers={["Nome", "Categoria", "Unidade", "Preço", "Agrônomo", "Ações"]}
              rows={customizedTableRows}
            />
          )}
        </>
      )}

      {activeTab === "desativados" && (
        <>
          {deactivatedLoading ? (
            <TableRowsSkeleton rows={10} columns={5} />
          ) : inactiveProducts.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">Nenhum produto desativado</p>
          ) : (
            <DataTable
              headers={["Nome", "Categoria", "Unidade", "Origem", "Ações"]}
              rows={inactiveRows}
            />
          )}
        </>
      )}

      <Sheet open={Boolean(editProduct)} onOpenChange={(o) => !o && setEditProduct(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Editar produto global</SheetTitle>
          </SheetHeader>
          <form onSubmit={onEditGlobal} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">Nome</label>
              <Input {...editForm.register("name")} />
              {editForm.formState.errors.name && (
                <p className="mt-1 text-xs text-red-600">{editForm.formState.errors.name.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">Categoria</label>
              <select {...editForm.register("category")} className={selectClass}>
                {GLOBAL_PRODUCT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {PRODUCT_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">Unidade de dose</label>
              <select {...editForm.register("dose_unit")} className={selectClass}>
                {GLOBAL_DOSE_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {DOSE_UNIT_LABELS[u]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">URL do rótulo (opcional)</label>
              <Input {...editForm.register("default_label_url")} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">Grupo de equivalência (opcional)</label>
              <Input {...editForm.register("equivalence_group")} />
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
              Ativo no catálogo
            </label>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={updateGlobalMutation.isPending}>
                {updateGlobalMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setEditProduct(null)}>
                Fechar
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet open={Boolean(editCustomRow)} onOpenChange={(o) => !o && setEditCustomRow(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Editar produto customizado</SheetTitle>
            {editCustomRow?.owner_name ? (
              <p className="text-sm text-muted-foreground">Agrônomo: {editCustomRow.owner_name}</p>
            ) : null}
          </SheetHeader>
          <form onSubmit={onEditCustom} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">Nome</label>
              <Input {...customEditForm.register("name")} />
              {customEditForm.formState.errors.name && (
                <p className="mt-1 text-xs text-red-600">{customEditForm.formState.errors.name.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">Categoria</label>
              <select {...customEditForm.register("category")} className={selectClass}>
                {GLOBAL_PRODUCT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {PRODUCT_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">Unidade de dose</label>
              <select {...customEditForm.register("dose_unit")} className={selectClass}>
                {GLOBAL_DOSE_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {DOSE_UNIT_LABELS[u]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">Preço (BRL)</label>
              <Input {...customEditForm.register("price_brl")} placeholder="0,00" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">URL do rótulo (opcional)</label>
              <Input {...customEditForm.register("label_url")} placeholder="https://..." />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="rounded border-zinc-300"
                checked={customEditForm.watch("is_active")}
                onChange={(e) =>
                  customEditForm.setValue("is_active", e.target.checked, { shouldValidate: true, shouldDirty: true })
                }
              />
              Ativo no catálogo
            </label>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={updateLocalMutation.isPending}>
                {updateLocalMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setEditCustomRow(null)}>
                Fechar
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
