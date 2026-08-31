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
import {
  FORMULATION_MIX_OPTIONS,
  formulationEquivalenceGroup,
  formulationShortLabel,
  resolveFormulationKey,
  type FormulationKey,
} from "@recomenda/domain/recommendations/formulation-mix-order";

const CATALOG_PAGE_SIZE = 15;

const FORMULATION_SELECT_OPTIONS = FORMULATION_MIX_OPTIONS.map((o) => ({
  value: o.key,
  label: o.label,
}));

function formulationCellLabel(equivalenceGroup: string | null | undefined): string {
  return formulationShortLabel(resolveFormulationKey(equivalenceGroup));
}

const createSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  category: z.string().optional(),
  label_url: z.string().optional(),
  formulation_key: z.string().optional(),
});

const editSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  category: z.string().optional(),
  dose_unit: z.string().optional(),
  price_brl: z.string().optional(),
  price_usd: z.string().optional(),
  label_url: z.string().optional(),
  formulation_key: z.string().optional(),
  // Registro no MAPA: vem preenchido do AGROFIT (`npm run import:agrofit`);
  // editável à mão para o que a base não cobre.
  manufacturer: z.string().optional(),
  mapa_registration: z.string().optional(),
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
  /** Busca do "usar registro de outro produto" (ver `registryOptions`). */
  const [registryQuery, setRegistryQuery] = useState("");
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
    defaultValues: {
      name: "",
      category: "",
      label_url: "",
      formulation_key: "",
    },
  });

  const editForm = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: "", category: "", formulation_key: "" },
  });

  const onCreateSubmit = createForm.handleSubmit((values) => {
    const key = (values.formulation_key || "") as FormulationKey | "";
    createProduct.mutate(
      {
        name: values.name,
        category: values.category,
        label_url: values.label_url,
        dose_unit: "DOSE",
        equivalence_group: key
          ? formulationEquivalenceGroup(key)
          : null,
      },
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
      const key = (values.formulation_key || "") as FormulationKey | "";
      updateProduct.mutate(
        {
          id: editingId,
          name: values.name,
          category: values.category,
          dose_unit: values.dose_unit,
          price_brl: values.price_brl,
          price_usd: values.price_usd,
          label_url: values.label_url,
          equivalence_group: key
            ? formulationEquivalenceGroup(key)
            : null,
          // String vazia vira null: campo em branco significa "sem registro"
          // (adjuvante, fertilizante), não texto vazio.
          manufacturer: values.manufacturer?.trim() || null,
          mapa_registration: values.mapa_registration?.trim() || null,
        },
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

  const handleFormulationChange = (
    localProductId: string,
    key: string,
  ) => {
    const formulationKey = (key || "OTHER") as FormulationKey;
    updateProduct.mutate(
      {
        id: localProductId,
        equivalence_group: formulationEquivalenceGroup(
          formulationKey === "OTHER" ? null : formulationKey,
        ),
      },
      {
        onSuccess: () => toast.success("Tipo de formulação atualizado."),
        onError: () =>
          toast.error("Não foi possível atualizar a formulação."),
      },
    );
  };

  // Memoizado: `?? []` cria um array novo a cada render e faz todos os memos
  // que dependem dele recalcularem sempre.
  const platformRows = useMemo(
    () => (platformRes?.data ?? []) as PlatformCatalogEntry[],
    [platformRes],
  );

  /**
   * Produtos do catálogo que já têm registro do MAPA — fonte para copiar num
   * produto de nome livre que o import não achou (ex.: "Glufosinato 800 WG -
   * Rainbow", que no AGROFIT existe sob a marca comercial).
   */
  const registryOptions = useMemo(() => {
    const q = registryQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    const seen = new Set<string>();
    const out: Array<{ name: string; manufacturer: string; registration: string }> = [];
    for (const row of platformRows) {
      if (!row.manufacturer || !row.mapa_registration) continue;
      if (!row.name.toLowerCase().includes(q)) continue;
      const key = `${row.manufacturer}|${row.mapa_registration}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        name: row.name,
        manufacturer: row.manufacturer,
        registration: row.mapa_registration,
      });
      if (out.length >= 8) break;
    }
    return out;
  }, [platformRows, registryQuery]);
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
    editForm.setValue("manufacturer", row.manufacturer ?? "");
    editForm.setValue("mapa_registration", row.mapa_registration ?? "");
    setRegistryQuery("");
    const formKey = resolveFormulationKey(row.equivalence_group);
    editForm.setValue(
      "formulation_key",
      formKey === "OTHER" ? "" : formKey,
    );
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
    <span
      key={`gf-${p.global_product_id ?? p.name}`}
      className="font-semibold tracking-wide text-muted-foreground"
      title={p.equivalence_group ?? undefined}
    >
      {formulationCellLabel(p.equivalence_group)}
    </span>,
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
    const formKey = resolveFormulationKey(p.equivalence_group);
    const canEditFormulation =
      p.can_edit && Boolean(p.local_product_id) && p.entry_type === "OWN_CUSTOM";
    const formulationCell = canEditFormulation ? (
      <Select
        key={`cf-${p.local_product_id}`}
        value={formKey === "OTHER" ? "" : formKey}
        onValueChange={(v) =>
          handleFormulationChange(p.local_product_id!, v)
        }
        placeholder="—"
        filterLabel="Formulação"
        options={FORMULATION_SELECT_OPTIONS}
        className="min-w-[7rem] max-w-[11rem]"
        disabled={updateProduct.isPending}
      />
    ) : (
      <span
        key={`cf-${p.local_product_id ?? p.peer_local_product_id ?? p.name}`}
        className="font-semibold tracking-wide text-muted-foreground"
        title={p.equivalence_group ?? undefined}
      >
        {formulationCellLabel(p.equivalence_group)}
      </span>
    );
    return [
      <TruncatedNameCell
        key={`c-${p.local_product_id ?? p.peer_local_product_id ?? p.name}`}
        name={p.name}
      />,
      PRODUCT_CATEGORY_LABELS[
        p.category as keyof typeof PRODUCT_CATEGORY_LABELS
      ] ?? p.category,
      formulationCell,
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
                  <Label htmlFor="catalog-formulation">Tipo de formulação</Label>
                  <Select
                    id="catalog-formulation"
                    value={createForm.watch("formulation_key") ?? ""}
                    onValueChange={(v) =>
                      createForm.setValue("formulation_key", v)
                    }
                    placeholder="Selecionar…"
                    filterLabel="Formulação"
                    options={FORMULATION_SELECT_OPTIONS}
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
            <TableRowsSkeleton rows={10} columns={6} />
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
              headers={[
                "Nome",
                "Categoria",
                "Formulação",
                "Unidade",
                "Preço",
                "Ações",
              ]}
              rows={globalTableRows}
              columnCellClassNames={[
                "max-w-0 min-w-0",
                "whitespace-nowrap",
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
            <TableRowsSkeleton rows={10} columns={7} />
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
                "Formulação",
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
                <Label htmlFor="catalog-edit-formulation">
                  Tipo de formulação
                </Label>
                <Select
                  id="catalog-edit-formulation"
                  value={editForm.watch("formulation_key") ?? ""}
                  onValueChange={(v) =>
                    editForm.setValue("formulation_key", v)
                  }
                  placeholder="Selecionar…"
                  filterLabel="Formulação"
                  options={FORMULATION_SELECT_OPTIONS}
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

              <div className="rounded-lg border border-border bg-surface-2 p-3">
                <p className="text-xs font-semibold text-text-strong">
                  Registro no MAPA
                </p>
                <p className="mt-0.5 mb-2.5 text-[11px] leading-snug text-muted-foreground">
                  Preenchido automaticamente pela base do AGROFIT. Adjuvante,
                  fertilizante, foliar e semente não têm registro — deixe em branco.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="catalog-edit-manufacturer">Empresa</Label>
                  <Input
                    id="catalog-edit-manufacturer"
                    {...editForm.register("manufacturer")}
                    placeholder="Ex.: Syngenta Proteção de Cultivos Ltda."
                  />
                </div>
                <div className="mt-2.5 space-y-1.5">
                  <Label htmlFor="catalog-edit-registration">Nº de registro</Label>
                  <Input
                    id="catalog-edit-registration"
                    {...editForm.register("mapa_registration")}
                    placeholder="Ex.: 8499"
                  />
                </div>

                <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                  <Label htmlFor="catalog-edit-registry-search">
                    Copiar de outro produto
                  </Label>
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Para genérico cadastrado com nome próprio: busque a marca
                    comercial e traga empresa e registro dela.
                  </p>
                  <Input
                    id="catalog-edit-registry-search"
                    value={registryQuery}
                    onChange={(e) => setRegistryQuery(e.target.value)}
                    placeholder="Buscar por nome do produto…"
                  />
                  {registryQuery.trim().length >= 2 ? (
                    registryOptions.length > 0 ? (
                      <ul className="mt-1 flex flex-col gap-1">
                        {registryOptions.map((opt) => (
                          <li key={`${opt.manufacturer}-${opt.registration}`}>
                            <button
                              type="button"
                              className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-left text-[12px] hover:border-primary/40 hover:bg-primary/5"
                              onClick={() => {
                                editForm.setValue("manufacturer", opt.manufacturer);
                                editForm.setValue(
                                  "mapa_registration",
                                  opt.registration,
                                );
                                setRegistryQuery("");
                                toast.success(
                                  `Registro de ${opt.name} copiado. Confira e salve.`,
                                );
                              }}
                            >
                              <span className="block font-medium text-text-strong">
                                {opt.name}
                              </span>
                              <span className="block text-muted-foreground">
                                {opt.manufacturer} · reg. {opt.registration}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        Nenhum produto com registro para essa busca.
                      </p>
                    )
                  ) : null}
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
