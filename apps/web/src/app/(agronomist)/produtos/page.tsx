"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Package } from "lucide-react";

import { PageHeader } from "@/components/domain/page-header";
import { PaginationBar } from "@recomenda/ui/patterns/pagination-bar";
import { SegmentedTabs } from "@/components/domain/segmented-tabs";
import { TableRowsSkeleton } from "@/components/domain/page-skeletons";
import { TruncatedNameCell, DataTable } from "@recomenda/ui/patterns/data-table";
import { Button } from "@recomenda/ui/primitives/button";
import { Input } from "@recomenda/ui/primitives/input";
import { Label } from "@recomenda/ui/primitives/label";
import { Select } from "@recomenda/ui/forms/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@recomenda/ui/primitives/sheet";
import {
  useClonePeerLocalProduct,
  useCreateLocalProduct,
  useInactiveLocalCatalog,
  usePlatformCatalog,
  useUpdateLocalProduct,
} from "@recomenda/api-hooks";
import {
  deactivateOutlineButtonClass,
  DOSE_UNIT_LABELS,
  GLOBAL_DOSE_UNITS,
  GLOBAL_PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
} from "@recomenda/utils";
import type { PlatformCatalogEntry } from "@recomenda/api";

const CATALOG_PAGE_SIZE = 15;

const createSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  category: z.string().optional(),
  label_url: z.string().optional(),
});

const editSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  category: z.string().optional(),
  dose_unit: z.string().optional(),
  price_brl: z.string().optional(),
  price_usd: z.string().optional(),
  label_url: z.string().optional(),
});

type CreateFormValues = z.infer<typeof createSchema>;
type EditFormValues = z.infer<typeof editSchema>;

function matchesFilters(
  row: { name: string; category: string; dose_unit: string },
  f: { name: string; category: string; doseUnit: string },
): boolean {
  if (f.category && row.category !== f.category) return false;
  if (f.doseUnit && row.dose_unit !== f.doseUnit) return false;
  const q = f.name.trim().toLowerCase();
  if (q && !row.name.toLowerCase().includes(q)) return false;
  return true;
}

export default function CatalogPage() {
  const { data: platformRes, isLoading: platformLoading } =
    usePlatformCatalog();
  const { data: inactiveData, isLoading: inactiveLoading } =
    useInactiveLocalCatalog();
  const createProduct = useCreateLocalProduct();
  const updateProduct = useUpdateLocalProduct();
  const clonePeer = useClonePeerLocalProduct();

  const [openCreate, setOpenCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "global" | "customizados" | "inativos"
  >("global");

  const [filterName, setFilterName] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterDoseUnit, setFilterDoseUnit] = useState("");

  const [globalPage, setGlobalPage] = useState(1);
  const [customPage, setCustomPage] = useState(1);
  const [inactivePage, setInactivePage] = useState(1);

  const createForm = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", category: "", label_url: "" },
  });

  const editForm = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: "", category: "" },
  });

  const onCreateSubmit = createForm.handleSubmit((values) => {
    createProduct.mutate(
      { ...values, dose_unit: "DOSE" },
      {
        onSuccess: () => {
          setOpenCreate(false);
          createForm.reset();
          toast.success("Produto adicionado ao catálogo.");
        },
        onError: () => toast.error("Não foi possível criar o produto."),
      },
    );
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

  const platformRows = (platformRes?.data ?? []) as PlatformCatalogEntry[];
  const inactiveProducts = (inactiveData?.data ?? []) as Array<{
    id: string;
    name: string;
    category?: string;
    dose_unit?: string;
    price_brl?: string | null;
  }>;

  const globalEntries = useMemo(
    () => platformRows.filter((r) => r.entry_type === "GLOBAL"),
    [platformRows],
  );
  const customEntries = useMemo(
    () =>
      platformRows.filter(
        (r) => r.entry_type === "OWN_CUSTOM" || r.entry_type === "PEER_CUSTOM",
      ),
    [platformRows],
  );

  const filteredGlobal = useMemo(
    () =>
      globalEntries.filter((p) =>
        matchesFilters(p, {
          name: filterName,
          category: filterCategory,
          doseUnit: filterDoseUnit,
        }),
      ),
    [globalEntries, filterName, filterCategory, filterDoseUnit],
  );
  const filteredCustom = useMemo(
    () =>
      customEntries.filter((p) =>
        matchesFilters(p, {
          name: filterName,
          category: filterCategory,
          doseUnit: filterDoseUnit,
        }),
      ),
    [customEntries, filterName, filterCategory, filterDoseUnit],
  );
  const filteredInactive = useMemo(
    () =>
      inactiveProducts.filter((p) =>
        matchesFilters(
          {
            name: p.name,
            category: p.category ?? "",
            dose_unit: p.dose_unit ?? "",
          },
          {
            name: filterName,
            category: filterCategory,
            doseUnit: filterDoseUnit,
          },
        ),
      ),
    [inactiveProducts, filterName, filterCategory, filterDoseUnit],
  );

  useEffect(() => {
    setGlobalPage(1);
    setCustomPage(1);
    setInactivePage(1);
  }, [filterName, filterCategory, filterDoseUnit, activeTab]);

  const globalTotalPages = Math.max(
    1,
    Math.ceil(filteredGlobal.length / CATALOG_PAGE_SIZE),
  );
  const customTotalPages = Math.max(
    1,
    Math.ceil(filteredCustom.length / CATALOG_PAGE_SIZE),
  );
  const inactiveTotalPages = Math.max(
    1,
    Math.ceil(filteredInactive.length / CATALOG_PAGE_SIZE),
  );

  useEffect(
    () => setGlobalPage((p) => Math.min(p, globalTotalPages)),
    [globalTotalPages],
  );
  useEffect(
    () => setCustomPage((p) => Math.min(p, customTotalPages)),
    [customTotalPages],
  );
  useEffect(
    () => setInactivePage((p) => Math.min(p, inactiveTotalPages)),
    [inactiveTotalPages],
  );

  const paginatedGlobal = filteredGlobal.slice(
    (globalPage - 1) * CATALOG_PAGE_SIZE,
    globalPage * CATALOG_PAGE_SIZE,
  );
  const paginatedCustom = filteredCustom.slice(
    (customPage - 1) * CATALOG_PAGE_SIZE,
    customPage * CATALOG_PAGE_SIZE,
  );
  const paginatedInactive = filteredInactive.slice(
    (inactivePage - 1) * CATALOG_PAGE_SIZE,
    inactivePage * CATALOG_PAGE_SIZE,
  );

  const openEdit = (row: PlatformCatalogEntry) => {
    if (!row.local_product_id) return;
    setEditingId(row.local_product_id);
    editForm.setValue("name", row.name);
    editForm.setValue("category", row.category ?? "");
    editForm.setValue("dose_unit", row.dose_unit ?? "");
    editForm.setValue(
      "price_brl",
      row.price_brl != null ? String(row.price_brl) : "",
    );
    editForm.setValue(
      "price_usd",
      (row as { price_usd?: string | number | null }).price_usd != null
        ? String((row as { price_usd?: string | number | null }).price_usd)
        : "",
    );
    editForm.setValue("label_url", row.label_url ?? "");
  };

  const renderActions = (row: PlatformCatalogEntry) => (
    <div className="flex flex-wrap justify-end gap-2">
      {row.can_clone_to_my_catalog && row.peer_local_product_id ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={clonePeer.isPending}
          onClick={() =>
            clonePeer.mutate(row.peer_local_product_id!, {
              onSuccess: () =>
                toast.success("Produto copiado para o seu catálogo."),
              onError: () =>
                toast.error("Não foi possível adicionar o produto."),
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
          onClick={() => openEdit(row)}
        >
          Editar
        </Button>
      ) : null}
      {row.can_deactivate && row.local_product_id ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={deactivateOutlineButtonClass}
          disabled={updateProduct.isPending}
          onClick={() =>
            updateProduct.mutate(
              { id: row.local_product_id!, is_active: false },
              {
                onSuccess: () => toast.success("Produto desativado."),
                onError: () => toast.error("Não foi possível desativar."),
              },
            )
          }
        >
          Desativar
        </Button>
      ) : null}
    </div>
  );

  const globalTableRows = paginatedGlobal.map((p) => [
    <TruncatedNameCell
      key={`g-${p.global_product_id ?? p.name}`}
      name={p.name}
    />,
    PRODUCT_CATEGORY_LABELS[
      p.category as keyof typeof PRODUCT_CATEGORY_LABELS
    ] ?? p.category,
    DOSE_UNIT_LABELS[p.dose_unit as keyof typeof DOSE_UNIT_LABELS] ??
      p.dose_unit,
    p.price_brl ? `R$ ${parseFloat(String(p.price_brl)).toFixed(2)}` : "—",
    renderActions(p),
  ]);

  const customTableRows = paginatedCustom.map((p) => {
    const owner = p.owner_name?.trim();
    const ownerCell =
      p.entry_type === "OWN_CUSTOM" ? (
        <span className="text-muted-foreground">Você</span>
      ) : owner ? (
        <span
          className="block max-w-[10rem] truncate sm:max-w-[14rem]"
          title={owner}
        >
          {owner}
        </span>
      ) : (
        "—"
      );
    return [
      <TruncatedNameCell
        key={`c-${p.local_product_id ?? p.peer_local_product_id ?? p.name}`}
        name={p.name}
      />,
      PRODUCT_CATEGORY_LABELS[
        p.category as keyof typeof PRODUCT_CATEGORY_LABELS
      ] ?? p.category,
      DOSE_UNIT_LABELS[p.dose_unit as keyof typeof DOSE_UNIT_LABELS] ??
        p.dose_unit,
      p.price_brl ? `R$ ${parseFloat(String(p.price_brl)).toFixed(2)}` : "—",
      ownerCell,
      renderActions(p),
    ];
  });

  const inactiveTableRows = paginatedInactive.map((product) => [
    <TruncatedNameCell key={`i-${product.id}`} name={product.name} />,
    product.category
      ? (PRODUCT_CATEGORY_LABELS[
          product.category as keyof typeof PRODUCT_CATEGORY_LABELS
        ] ?? product.category)
      : "—",
    product.dose_unit
      ? (DOSE_UNIT_LABELS[product.dose_unit as keyof typeof DOSE_UNIT_LABELS] ??
        product.dose_unit)
      : "—",
    product.price_brl
      ? `R$ ${parseFloat(String(product.price_brl)).toFixed(2)}`
      : "—",
    <div key={`ia-${product.id}`} className="flex flex-wrap justify-end gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={updateProduct.isPending}
        onClick={() =>
          updateProduct.mutate(
            { id: product.id, is_active: true },
            {
              onSuccess: () => toast.success("Produto reativado."),
              onError: () => toast.error("Não foi possível reativar."),
            },
          )
        }
      >
        Reativar
      </Button>
    </div>,
  ]);

  const hasActiveFilters = Boolean(
    filterName.trim() || filterCategory || filterDoseUnit,
  );

  return (
    <>
      <PageHeader
        icon={<Package className="h-5 w-5" />}
        title="Produtos"
        description="Catálogo da plataforma e seus produtos customizados. Edite ou desative apenas o que você criou; copie itens de outros agrônomos para o seu catálogo."
        action={
          <Sheet open={openCreate} onOpenChange={setOpenCreate}>
            <SheetTrigger asChild>
              <Button type="button" variant="clay">
                <Plus className="h-4 w-4" />
                Novo produto
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:w-96">
              <SheetHeader>
                <SheetTitle>Novo produto</SheetTitle>
              </SheetHeader>
              <form onSubmit={onCreateSubmit} className="space-y-4 px-4 pb-4">
                <div className="space-y-1.5">
                  <Label htmlFor="catalog-name">Nome</Label>
                  <Input
                    id="catalog-name"
                    {...createForm.register("name")}
                    placeholder="Ex.: Produto XYZ"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="catalog-category">Categoria</Label>
                  <Select
                    id="catalog-category"
                    {...createForm.register("category")}
                    value={createForm.watch("category") ?? ""}
                    placeholder="Selecionar…"
                    filterLabel="Categoria"
                    options={GLOBAL_PRODUCT_CATEGORIES.map((c) => ({
                      value: c,
                      label: PRODUCT_CATEGORY_LABELS[c],
                    }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="catalog-label">Bulário (opcional)</Label>
                  <Input
                    id="catalog-label"
                    {...createForm.register("label_url")}
                    type="url"
                    placeholder="Link da bula ou rótulo"
                  />
                  <p className="text-xs text-muted-foreground">
                    PDF ou link externo. A unidade de dose é definida ao montar
                    a lista de compra.
                  </p>
                </div>
                <Button
                  type="submit"
                  disabled={createProduct.isPending}
                  className="w-full"
                >
                  {createProduct.isPending ? "Adicionando…" : "Adicionar"}
                </Button>
              </form>
            </SheetContent>
          </Sheet>
        }
      />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedTabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v);
            setFilterName("");
            setFilterCategory("");
            setFilterDoseUnit("");
          }}
          items={[
            { value: "global", label: "Catálogo Global" },
            {
              value: "customizados",
              label: "Customizados",
              badgeCount: customEntries.length,
            },
            {
              value: "inativos",
              label: "Removidos",
              badgeCount: inactiveProducts.length,
            },
          ]}
        />
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5 shadow-sm sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-0 flex-1 sm:min-w-[12rem] sm:max-w-xs">
          <label className="mb-1 block text-xs font-medium text-foreground">
            Nome
          </label>
          <Input
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            placeholder="Buscar por nome…"
          />
        </div>
        <div className="w-full min-w-[10rem] sm:w-44">
          <label className="mb-1 block text-xs font-medium text-foreground">
            Categoria
          </label>
          <Select
            value={filterCategory}
            onValueChange={setFilterCategory}
            placeholder="Todas"
            options={GLOBAL_PRODUCT_CATEGORIES.map((c) => ({
              value: c,
              label: PRODUCT_CATEGORY_LABELS[c],
            }))}
          />
        </div>
        <div className="w-full min-w-[10rem] sm:w-44">
          <label className="mb-1 block text-xs font-medium text-foreground">
            Unidade de dose
          </label>
          <Select
            value={filterDoseUnit}
            onValueChange={setFilterDoseUnit}
            placeholder="Todas"
            options={GLOBAL_DOSE_UNITS.map((u) => ({
              value: u,
              label: DOSE_UNIT_LABELS[u],
            }))}
          />
        </div>
        {hasActiveFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 self-end sm:self-auto"
            onClick={() => {
              setFilterName("");
              setFilterCategory("");
              setFilterDoseUnit("");
            }}
          >
            Limpar filtros
          </Button>
        ) : null}
      </div>

      {activeTab === "global" && (
        <>
          {platformLoading ? (
            <TableRowsSkeleton rows={10} columns={5} />
          ) : globalEntries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum produto no catálogo da plataforma.
            </p>
          ) : filteredGlobal.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum resultado para o filtro.
            </p>
          ) : (
            <DataTable
              headers={["Nome", "Categoria", "Unidade", "Preço", "Ações"]}
              rows={globalTableRows}
              columnCellClassNames={[
                "max-w-0 min-w-0",
                "whitespace-nowrap",
                "whitespace-nowrap",
                "whitespace-nowrap",
                "whitespace-nowrap",
              ]}
              footer={
                <PaginationBar
                  page={globalPage}
                  pageSize={CATALOG_PAGE_SIZE}
                  total={filteredGlobal.length}
                  onPageChange={setGlobalPage}
                />
              }
            />
          )}
        </>
      )}

      {activeTab === "customizados" && (
        <>
          {platformLoading ? (
            <TableRowsSkeleton rows={10} columns={6} />
          ) : customEntries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum produto customizado ainda.
            </p>
          ) : filteredCustom.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum resultado para o filtro.
            </p>
          ) : (
            <DataTable
              headers={[
                "Nome",
                "Categoria",
                "Unidade",
                "Preço",
                "Criado por",
                "Ações",
              ]}
              rows={customTableRows}
              columnCellClassNames={[
                "max-w-0 min-w-0",
                "whitespace-nowrap",
                "whitespace-nowrap",
                "whitespace-nowrap",
                "max-w-0 min-w-0",
                "whitespace-nowrap",
              ]}
              footer={
                <PaginationBar
                  page={customPage}
                  pageSize={CATALOG_PAGE_SIZE}
                  total={filteredCustom.length}
                  onPageChange={setCustomPage}
                />
              }
            />
          )}
        </>
      )}

      {activeTab === "inativos" && (
        <>
          {inactiveLoading ? (
            <TableRowsSkeleton rows={10} columns={5} />
          ) : inactiveProducts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum produto removido.
            </p>
          ) : filteredInactive.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum resultado para o filtro.
            </p>
          ) : (
            <DataTable
              headers={["Nome", "Categoria", "Unidade", "Preço", "Ações"]}
              rows={inactiveTableRows}
              columnCellClassNames={[
                "max-w-0 min-w-0",
                "whitespace-nowrap",
                "whitespace-nowrap",
                "whitespace-nowrap",
                "whitespace-nowrap",
              ]}
              footer={
                <PaginationBar
                  page={inactivePage}
                  pageSize={CATALOG_PAGE_SIZE}
                  total={filteredInactive.length}
                  onPageChange={setInactivePage}
                />
              }
            />
          )}
        </>
      )}

      {editingId && (
        <Sheet
          open={editingId !== null}
          onOpenChange={() => setEditingId(null)}
        >
          <SheetContent side="right" className="w-full sm:w-96 overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Editar produto</SheetTitle>
            </SheetHeader>
            <form onSubmit={onEditSubmit} className="space-y-4 px-4 pb-6">
              <div className="space-y-1.5">
                <Label htmlFor="catalog-edit-name">Nome</Label>
                <Input
                  id="catalog-edit-name"
                  {...editForm.register("name")}
                  placeholder="Nome do produto"
                />
                {editForm.formState.errors.name && (
                  <p className="text-xs text-destructive">
                    {editForm.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="catalog-edit-category">Categoria</Label>
                <Select
                  id="catalog-edit-category"
                  {...editForm.register("category")}
                  value={editForm.watch("category") ?? ""}
                  placeholder="Selecionar…"
                  filterLabel="Categoria"
                  options={GLOBAL_PRODUCT_CATEGORIES.map((c) => ({
                    value: c,
                    label: PRODUCT_CATEGORY_LABELS[c],
                  }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="catalog-edit-unit">Unidade de dose</Label>
                <Select
                  id="catalog-edit-unit"
                  {...editForm.register("dose_unit")}
                  value={editForm.watch("dose_unit") ?? ""}
                  placeholder="Selecionar…"
                  filterLabel="Unidade de dose"
                  options={GLOBAL_DOSE_UNITS.map((u) => ({
                    value: u,
                    label: DOSE_UNIT_LABELS[u],
                  }))}
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="catalog-edit-price">Preço (BRL)</Label>
                  <Input
                    id="catalog-edit-price"
                    {...editForm.register("price_brl")}
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="catalog-edit-price-usd">Preço (USD)</Label>
                  <Input
                    id="catalog-edit-price-usd"
                    {...editForm.register("price_usd")}
                    type="number"
                    step="0.0001"
                    placeholder="0.00"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Usado pelo Plano de Custo com a cotação do dólar.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="catalog-edit-label">URL do rótulo</Label>
                <Input
                  id="catalog-edit-label"
                  {...editForm.register("label_url")}
                  type="url"
                  placeholder="https://exemplo.com/rotulo.jpg"
                />
              </div>

              <Button
                type="submit"
                disabled={updateProduct.isPending}
                className="w-full"
              >
                {updateProduct.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
