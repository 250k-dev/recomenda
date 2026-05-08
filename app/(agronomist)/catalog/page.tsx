"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageHeader } from "@/components/domain/page-header";
import { TableRowsSkeleton, ToolbarSkeleton } from "@/components/domain/page-skeletons";
import { DataTable } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useLocalCatalog, useCreateLocalProduct, useUpdateLocalProduct } from "@/lib/api/hooks";

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
  const { data: localData, isLoading: localLoading } = useLocalCatalog();
  const createProduct = useCreateLocalProduct();
  const updateProduct = useUpdateLocalProduct();

  const [openCreate, setOpenCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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
      },
    });
  });

  const onEditSubmit = editForm.handleSubmit((values) => {
    if (editingId) {
      updateProduct.mutate({ id: editingId, ...values }, {
        onSuccess: () => {
          setEditingId(null);
          editForm.reset();
        },
      });
    }
  });

  const localProducts = localData?.data ?? [];

  const localRows = localProducts.map((product) => [
    <div key={`name-${product.id}`} className="font-medium">{product.name}</div>,
    product.category ? (CATEGORIES[product.category] ?? product.category) : "-",
    product.dose_unit ? (DOSE_UNITS[product.dose_unit]?.split(" ")[0] ?? product.dose_unit) : "-",
    product.price_brl ? `R$ ${parseFloat(product.price_brl).toFixed(2)}` : "-",
    <Button
      key={`edit-${product.id}`}
      variant="outline"
      size="sm"
      className="h-7 px-2 text-xs"
      onClick={() => {
        setEditingId(product.id);
        editForm.setValue("name", product.name);
        editForm.setValue("category", product.category ?? "");
        editForm.setValue("dose_unit", product.dose_unit ?? "");
        editForm.setValue("price_brl", product.price_brl ?? "");
        editForm.setValue("label_url", product.label_url ?? "");
      }}
    >
      Editar
    </Button>,
  ]);

  return (
    <>
      <PageHeader
        title="Catálogo local"
        description="Todos os produtos ativos do catálogo global entram aqui automaticamente. Use adicionar para incluir produtos exclusivos do seu escritório."
      />

      <div className="mb-6 flex gap-2">
        <Sheet open={openCreate} onOpenChange={setOpenCreate}>
          <SheetTrigger asChild>
            <Button>Adicionar produto</Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:w-96">
            <SheetHeader>
              <SheetTitle>Adicionar produto</SheetTitle>
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
                    <option key={value} value={value}>{label}</option>
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
                    <option key={value} value={value}>{label}</option>
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
                    <option key={value} value={value}>{label}</option>
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
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">Preço (BRL)</label>
                <Input
                  {...editForm.register("price_brl")}
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">URL do rótulo</label>
                <Input
                  {...editForm.register("label_url")}
                  type="url"
                  placeholder="https://exemplo.com/rotulo.jpg"
                />
              </div>

              <Button type="submit" disabled={updateProduct.isPending} className="w-full">
                {updateProduct.isPending ? "Salvando..." : "Salvar alterações"}
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      )}

      {localLoading ? (
        <>
          <ToolbarSkeleton />
          <TableRowsSkeleton rows={10} columns={5} />
        </>
      ) : localProducts.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-500">Nenhum produto no seu catálogo local</p>
      ) : (
        <DataTable headers={["Nome", "Categoria", "Unidade", "Preço", "Ações"]} rows={localRows} />
      )}
    </>
  );
}
