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
import type { GlobalProduct } from "@/lib/api/client";
import {
  DOSE_UNIT_LABELS,
  GLOBAL_DOSE_UNITS,
  GLOBAL_PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
} from "@/lib/catalog-global-options";
import {
  useCreateGlobalProduct,
  useDeleteGlobalProduct,
  useGlobalCatalog,
  useUpdateGlobalProduct,
} from "@/lib/api/hooks";

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

export default function AdminGlobalCatalogPage() {
  const { data, isLoading } = useGlobalCatalog();
  const createMutation = useCreateGlobalProduct();
  const updateMutation = useUpdateGlobalProduct();
  const deleteMutation = useDeleteGlobalProduct();
  const [filter, setFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<GlobalProduct | null>(null);

  const products = data?.data ?? [];

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const blob = `${p.name} ${p.category} ${p.dose_unit} ${p.id} ${p.equivalence_group ?? ""}`.toLowerCase();
      return blob.includes(q);
    });
  }, [products, filter]);

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

  const openEdit = (p: GlobalProduct) => {
    setEditProduct(p);
    editForm.reset({
      name: p.name,
      category: p.category,
      dose_unit: p.dose_unit,
      default_label_url: p.default_label_url ?? "",
      equivalence_group: p.equivalence_group ?? "",
      is_active: p.is_active !== false,
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

  const onEdit = editForm.handleSubmit((values) => {
    if (!editProduct) return;
    updateMutation.mutate(
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

  const onDelete = (p: GlobalProduct) => {
    if (!globalThis.confirm(`Excluir permanentemente o produto "${p.name}"? Esta ação não pode ser desfeita.`)) {
      return;
    }
    deleteMutation.mutate(p.id, {
      onSuccess: () => toast.success("Produto excluído."),
      onError: () => toast.error("Não foi possível excluir."),
    });
  };

  const rows = filtered.map((p) => [
    p.name,
    PRODUCT_CATEGORY_LABELS[p.category as keyof typeof PRODUCT_CATEGORY_LABELS] ?? p.category,
    DOSE_UNIT_LABELS[p.dose_unit as keyof typeof DOSE_UNIT_LABELS] ?? p.dose_unit,
    p.is_active === false ? "Inativo" : "Ativo",
    <div key={`a-${p.id}`} className="flex flex-wrap justify-end gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => openEdit(p)}>
        Editar
      </Button>
      <Button type="button" variant="destructive" size="sm" onClick={() => onDelete(p)} disabled={deleteMutation.isPending}>
        Excluir
      </Button>
    </div>,
  ]);

  const selectClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <>
      <PageHeader
        title="Produtos"
        description="Produtos de referência administrados pela plataforma. Agrônomos podem clonar para o catálogo local."
      />

      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <AdminListFilter value={filter} onChange={setFilter} placeholder="Filtrar por nome, categoria, unidade ou ID..." />
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
              <SheetTitle>Novo produto</SheetTitle>
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

      {isLoading ? (
        <TableRowsSkeleton rows={10} columns={5} />
      ) : (
        <DataTable headers={["Nome", "Categoria", "Unidade", "Status", "Ações"]} rows={rows} />
      )}

      <Sheet open={Boolean(editProduct)} onOpenChange={(o) => !o && setEditProduct(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Editar produto</SheetTitle>
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
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setEditProduct(null)}>
                Fechar
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
