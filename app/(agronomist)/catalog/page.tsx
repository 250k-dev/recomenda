"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { PageHeader } from "@/components/domain/page-header";
import { TableRowsSkeleton, ToolbarSkeleton } from "@/components/domain/page-skeletons";
import { DataTable } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SegmentedTabs } from "@/components/domain/segmented-tabs";
import {
  useClonePeerLocalProduct,
  useCreateLocalProduct,
  useInactiveLocalCatalog,
  usePlatformCatalog,
  useUpdateLocalProduct,
} from "@/lib/api/hooks";
import { PRODUCT_CATEGORY_LABELS } from "@/lib/catalog-global-options";
import { deactivateOutlineButtonClass } from "@/lib/action-button-styles";
import { cn } from "@/lib/utils";

const createSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  category: z.string().optional(),
  dose_unit: z.string().optional(),
});

const editSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  category: z.string().optional(),
  dose_unit: z.string().optional(),
  price_brl: z.string().optional(),
  label_url: z.string().optional(),
});

type CreateFormValues = z.infer<typeof createSchema>;
type EditFormValues = z.infer<typeof editSchema>;

const CATEGORIES: Record<string, string> = {
  HERBICIDE: "Herbicida",
  FUNGICIDE: "Fungicida",
  INSECTICIDE: "Inseticida",
  ADJUVANT: "Adjuvante",
  BIOLOGICAL: "Biológico",
  FOLIAR: "Foliar",
  SEED_TREATMENT: "Tratamento de sementes",
  FERTILIZER: "Fertilizante",
  OTHER: "Outro",
};

const DOSE_UNITS: Record<string, string> = {
  L: "L (Litro)",
  KG: "kg (Quilograma)",
  G: "g (Grama)",
  ML: "mL (Mililitro)",
  DOSE: "Dose",
};

export default function CatalogPage() {
  const { data: platformRes, isLoading: platformLoading } = usePlatformCatalog();
  const { data: inactiveData, isLoading: inactiveLoading } = useInactiveLocalCatalog();
  const createProduct = useCreateLocalProduct();
  const updateProduct = useUpdateLocalProduct();
  const clonePeer = useClonePeerLocalProduct();

  const [openCreate, setOpenCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"global" | "inativos">("global");

  const createForm = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", category: "", dose_unit: "" },
  });

  const editForm = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: "", category: "" },
  });

  const onCreateSubmit = createForm.handleSubmit((values) => {
    createProduct.mutate(values, {
      onSuccess: () => {
        setOpenCreate(false);
        createForm.reset();
        toast.success("Produto adicionado ao catálogo.");
      },
      onError: () => toast.error("Não foi possível criar o produto."),
    });
  });

  const onEditSubmit = editForm.handleSubmit((values) => {
    if (editingId) {
      updateProduct.mutate(
        { id: editingId, ...values },
        {
          onSuccess: () => {
            setEditingId(null);
            editForm.reset();
            toast.success("Produto atualizado.");
          },
          onError: () => toast.error("Não foi possível salvar."),
        },
      );
    }
  });

  const platformRows = platformRes?.data ?? [];
  const inactiveProducts = inactiveData?.data ?? [];

  const globalRows = platformRows.map((row) => {
    const cat =
      PRODUCT_CATEGORY_LABELS[row.category as keyof typeof PRODUCT_CATEGORY_LABELS] ??
      CATEGORIES[row.category] ??
      row.category;
    const unit = DOSE_UNITS[row.dose_unit]?.split(" ")[0] ?? row.dose_unit;
    const price = row.price_brl ? `R$ ${parseFloat(String(row.price_brl)).toFixed(2)}` : "—";

    const actions = (
      <div key={`act-${row.entry_type}-${row.local_product_id ?? row.peer_local_product_id}`} className="flex flex-wrap justify-end gap-1">
        {row.can_clone_to_my_catalog && row.peer_local_product_id ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={clonePeer.isPending}
            onClick={() =>
              clonePeer.mutate(row.peer_local_product_id!, {
                onSuccess: () => toast.success("Produto copiado para o seu catálogo."),
                onError: () => toast.error("Não foi possível adicionar o produto."),
              })
            }
          >
            Usar no meu catálogo
          </Button>
        ) : null}
        {row.can_edit && row.local_product_id ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => {
              setEditingId(row.local_product_id!);
              editForm.setValue("name", row.name);
              editForm.setValue("category", row.category ?? "");
              editForm.setValue("dose_unit", row.dose_unit ?? "");
              editForm.setValue("price_brl", row.price_brl != null ? String(row.price_brl) : "");
              editForm.setValue("label_url", row.label_url ?? "");
            }}
          >
            Editar
          </Button>
        ) : null}
        {row.can_deactivate && row.local_product_id ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(deactivateOutlineButtonClass, "h-7 px-2 text-xs")}
            onClick={() => {
              updateProduct.mutate(
                { id: row.local_product_id!, is_active: false },
                {
                  onSuccess: () => toast.success("Produto desativado."),
                  onError: () => toast.error("Não foi possível desativar."),
                },
              );
            }}
            disabled={updateProduct.isPending}
          >
            Desativar
          </Button>
        ) : null}
      </div>
    );

    return [
      <div key={`n-${row.local_product_id ?? row.peer_local_product_id ?? row.global_product_id}`} className="font-medium">
        {row.name}
      </div>,
      cat,
      unit,
      price,
      actions,
    ];
  });

  const inactiveRows = inactiveProducts.map((product: { id: string; name: string; category?: string; dose_unit?: string; price_brl?: string | null }) => [
    <div key={`name-${product.id}`} className="font-medium">
      {product.name}
    </div>,
    product.category ? (CATEGORIES[product.category] ?? product.category) : "-",
    product.dose_unit ? (DOSE_UNITS[product.dose_unit]?.split(" ")[0] ?? product.dose_unit) : "-",
    product.price_brl ? `R$ ${parseFloat(String(product.price_brl)).toFixed(2)}` : "-",
    <Button
      key={`reactivate-${product.id}`}
      variant="outline"
      size="sm"
      className="h-7 px-2 text-xs"
      onClick={() => {
        updateProduct.mutate(
          { id: product.id, is_active: true },
          {
            onSuccess: () => toast.success("Produto reativado."),
            onError: () => toast.error("Não foi possível reativar."),
          },
        );
      }}
      disabled={updateProduct.isPending}
    >
      Reativar
    </Button>,
  ]);

  return (
    <>
      <PageHeader
        title="Produtos"
        description="Catálogo global reúne produtos da plataforma e customizados de todos os agrônomos. Você só edita ou desativa produtos que criou; copie itens de outros para o seu catálogo quando precisar."
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <Sheet open={openCreate} onOpenChange={setOpenCreate}>
          <SheetTrigger asChild>
            <Button type="button">Adicionar produto</Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:w-96">
            <SheetHeader>
              <SheetTitle>Adicionar produto customizado</SheetTitle>
            </SheetHeader>
            <form onSubmit={onCreateSubmit} className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Nome</label>
                <Input {...createForm.register("name")} placeholder="Ex: Produto XYZ" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Categoria</label>
                <select
                  {...createForm.register("category")}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Selecionar...</option>
                  {Object.entries(CATEGORIES).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Unidade de dose</label>
                <select
                  {...createForm.register("dose_unit")}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Selecionar...</option>
                  {Object.entries(DOSE_UNITS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" disabled={createProduct.isPending} className="w-full">
                {createProduct.isPending ? "Adicionando..." : "Adicionar"}
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <SegmentedTabs
          value={activeTab}
          onValueChange={setActiveTab}
          items={[
            { value: "global", label: "Catálogo global" },
            { value: "inativos", label: "Desativados", badgeCount: inactiveProducts.length },
          ]}
        />
      </div>

      {activeTab === "global" && (
        <>
          {platformLoading ? (
            <>
              <ToolbarSkeleton />
              <TableRowsSkeleton rows={10} columns={5} />
            </>
          ) : globalRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">Nenhum produto no catálogo</p>
          ) : (
            <DataTable
              headers={["Nome", "Categoria", "Unidade", "Preço", "Ações"]}
              rows={globalRows}
            />
          )}
        </>
      )}

      {activeTab === "inativos" && (
        <>
          {inactiveLoading ? (
            <>
              <ToolbarSkeleton />
              <TableRowsSkeleton rows={10} columns={5} />
            </>
          ) : inactiveProducts.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">Nenhum produto customizado desativado</p>
          ) : (
            <DataTable headers={["Nome", "Categoria", "Unidade", "Preço", "Ações"]} rows={inactiveRows} />
          )}
        </>
      )}

      {editingId && (
        <Sheet open={editingId !== null} onOpenChange={() => setEditingId(null)}>
          <SheetContent side="right" className="w-full sm:w-96 overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Editar produto</SheetTitle>
            </SheetHeader>
            <form onSubmit={onEditSubmit} className="mt-6 space-y-4 pb-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">Nome</label>
                <Input {...editForm.register("name")} placeholder="Nome do produto" />
                {editForm.formState.errors.name && (
                  <p className="mt-1 text-xs text-red-600">{editForm.formState.errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">Categoria</label>
                <select
                  {...editForm.register("category")}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Selecionar...</option>
                  {Object.entries(CATEGORIES).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">Unidade de dose</label>
                <select
                  {...editForm.register("dose_unit")}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Selecionar...</option>
                  {Object.entries(DOSE_UNITS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">Preço (BRL)</label>
                <Input {...editForm.register("price_brl")} type="number" step="0.01" placeholder="0.00" />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">URL do rótulo</label>
                <Input {...editForm.register("label_url")} type="url" placeholder="https://exemplo.com/rotulo.jpg" />
              </div>

              <Button type="submit" disabled={updateProduct.isPending} className="w-full">
                {updateProduct.isPending ? "Salvando..." : "Salvar alterações"}
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
