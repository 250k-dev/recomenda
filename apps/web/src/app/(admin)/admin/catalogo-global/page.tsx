"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { PageHeader } from "@/components/domain/page-header";
import { PaginationBar } from "@recomenda/ui/pagination-bar";
import { Package, Plus } from "lucide-react";
import { SegmentedTabs } from "@/components/domain/segmented-tabs";
import { DeletePermanentIconButton } from "@/components/domain/delete-permanent-icon-button";
import { TableRowsSkeleton } from "@/components/domain/page-skeletons";
import { AdminCatalogNameCell, DataTable } from "@recomenda/ui/data-table";
import { Button } from "@recomenda/ui/button";
import { Input } from "@recomenda/ui/input";
import { Select, SearchableSelect } from "@recomenda/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@recomenda/ui/sheet";
import type { AdminDeactivatedCatalogEntry, AdminPlatformActiveEntry, GlobalCatalogImportResult, GlobalProduct } from "@recomenda/api";
import { apiErrorMessage } from "@recomenda/api/api-error";
import {
  deactivateOutlineButtonClass,
  DOSE_UNIT_LABELS,
  GLOBAL_DOSE_UNITS,
  GLOBAL_PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
} from "@recomenda/utils";
import {
  useCreateGlobalProduct,
  useDeleteGlobalProduct,
  useDeleteLocalProductAdmin,
  useImportGlobalCatalog,
  useAdminPlatformActiveCatalog,
  useAdminDeactivatedCatalog,
  useGlobalCatalog,
  useUpdateGlobalProduct,
  useUpdateLocalProduct,
  useResolveCustomLink,
  usePromoteCustomToGlobal,
} from "@recomenda/api-hooks";

const CATALOG_PAGE_SIZE = 15;

/** Filtro de origem: alinhado à coluna Origem (Plataforma vs. produto customizado do consultor). */
type CatalogOriginFilterValue = "" | "platform" | "custom";

function originMatchesFilter(
  entryType: AdminPlatformActiveEntry["entry_type"] | AdminDeactivatedCatalogEntry["entry_type"],
  origin: CatalogOriginFilterValue,
): boolean {
  if (!origin) return true;
  if (origin === "platform") {
    return entryType === "GLOBAL" || entryType === "GLOBAL_INACTIVE";
  }
  return entryType === "CUSTOM" || entryType === "CUSTOM_INACTIVE";
}

function matchesCatalogListFilters(
  row: {
    name: string;
    category: string;
    dose_unit: string;
    entry_type: AdminPlatformActiveEntry["entry_type"] | AdminDeactivatedCatalogEntry["entry_type"];
  },
  filters: { name: string; category: string; doseUnit: string; origin: CatalogOriginFilterValue },
): boolean {
  if (!originMatchesFilter(row.entry_type, filters.origin)) return false;
  if (filters.category && row.category !== filters.category) return false;
  if (filters.doseUnit && row.dose_unit !== filters.doseUnit) return false;
  const q = filters.name.trim().toLowerCase();
  if (q && !row.name.toLowerCase().includes(q)) return false;
  return true;
}


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
  T_HA: "t/ha (Tonelada/ha)",
  BAG: "bag (5M sementes)",
  SACA: "sacos (60k sementes)",
};

function downloadProdutosPlataformaTemplate() {
  const csv = "MARCA,DOSAGEM,TIPO,CLASSE\n";
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo_produtos_plataforma.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function catalogImportApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (isAxiosError(error)) {
    const payload = error.response?.data as { error?: { message?: string } } | undefined;
    if (typeof payload?.error?.message === "string") return payload.error.message;
  }
  return fallback;
}

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

function normalizeForMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

/** Sugere o produto global mais parecido com o nome digitado pelo agrônomo. */
function suggestGlobalId(name: string, globals: GlobalProduct[]): string {
  const target = normalizeForMatch(name);
  if (!target) return "";
  const targetTokens = new Set(target.split(/\s+/).filter(Boolean));
  let best = "";
  let bestScore = 0;
  for (const g of globals) {
    const gn = normalizeForMatch(g.name);
    let score = 0;
    if (gn === target) score = 100;
    else if (gn.startsWith(target) || target.startsWith(gn)) score = 80;
    else if (gn.includes(target) || target.includes(gn)) score = 60;
    else {
      const overlap = gn.split(/\s+/).filter((t) => targetTokens.has(t)).length;
      score = overlap > 0 ? 30 + overlap : 0;
    }
    if (score > bestScore) {
      bestScore = score;
      best = g.id;
    }
  }
  // Só pré-seleciona quando há similaridade razoável; senão deixa o admin buscar.
  return bestScore >= 60 ? best : "";
}

export default function AdminGlobalCatalogPage() {
  const { data: platformRes, isLoading: platformLoading } = useAdminPlatformActiveCatalog();
  const { data: deactivatedRes, isLoading: deactivatedLoading } = useAdminDeactivatedCatalog();
  const { data: globalCatalogRes } = useGlobalCatalog();
  const createMutation = useCreateGlobalProduct();
  const updateGlobalMutation = useUpdateGlobalProduct();
  const updateLocalMutation = useUpdateLocalProduct();
  const resolveLinkMutation = useResolveCustomLink();
  const promoteMutation = usePromoteCustomToGlobal();
  const deleteGlobalMutation = useDeleteGlobalProduct();
  const deleteLocalMutation = useDeleteLocalProductAdmin();
  const importMutation = useImportGlobalCatalog();
  const [filterName, setFilterName] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterDoseUnit, setFilterDoseUnit] = useState("");
  const [filterOrigin, setFilterOrigin] = useState<CatalogOriginFilterValue>("");
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importResult, setImportResult] = useState<GlobalCatalogImportResult | null>(null);
  const [editProduct, setEditProduct] = useState<GlobalProduct | null>(null);
  const [editCustomRow, setEditCustomRow] = useState<AdminPlatformActiveEntry | null>(null);
  const [activeTab, setActiveTab] = useState<"global" | "customizados" | "desativados">("global");
  const [globalPage, setGlobalPage] = useState(1);
  const [customPage, setCustomPage] = useState(1);
  const [inactivePage, setInactivePage] = useState(1);
  const [linking, setLinking] = useState<{ id: string; name: string } | null>(null);
  const [selectedGlobalId, setSelectedGlobalId] = useState("");
  const [promoteRow, setPromoteRow] = useState<AdminPlatformActiveEntry | null>(null);

  const globalProducts = globalCatalogRes?.data ?? [];
  const platformRows = platformRes?.data ?? [];
  const selectedGlobalProduct = globalProducts.find((g) => g.id === selectedGlobalId);

  const filteredGlobalRows = useMemo(() => {
    const f = { name: filterName, category: filterCategory, doseUnit: filterDoseUnit, origin: filterOrigin };
    return platformRows.filter((p) => matchesCatalogListFilters(p, f));
  }, [platformRows, filterName, filterCategory, filterDoseUnit, filterOrigin]);

  useEffect(() => {
    setGlobalPage(1);
    setCustomPage(1);
    setInactivePage(1);
  }, [filterName, filterCategory, filterDoseUnit, filterOrigin, activeTab]);

  const globalTotalPages = Math.max(1, Math.ceil(filteredGlobalRows.length / CATALOG_PAGE_SIZE));
  useEffect(() => {
    setGlobalPage((p) => Math.min(p, globalTotalPages));
  }, [globalTotalPages]);

  const globalSafePage = Math.min(globalPage, globalTotalPages);
  const paginatedGlobalRows = useMemo(() => {
    const start = (globalSafePage - 1) * CATALOG_PAGE_SIZE;
    return filteredGlobalRows.slice(start, start + CATALOG_PAGE_SIZE);
  }, [filteredGlobalRows, globalSafePage]);

  const customizedRows = useMemo(() => platformRows.filter((p) => p.entry_type === "CUSTOM"), [platformRows]);

  const inactiveProducts = deactivatedRes?.data ?? [];

  const filteredCustomRows = useMemo(() => {
    const f = { name: filterName, category: filterCategory, doseUnit: filterDoseUnit, origin: filterOrigin };
    return customizedRows.filter((p) => matchesCatalogListFilters(p, f));
  }, [customizedRows, filterName, filterCategory, filterDoseUnit, filterOrigin]);

  const filteredInactiveProducts = useMemo(() => {
    const f = { name: filterName, category: filterCategory, doseUnit: filterDoseUnit, origin: filterOrigin };
    return inactiveProducts.filter((p) => matchesCatalogListFilters(p, f));
  }, [inactiveProducts, filterName, filterCategory, filterDoseUnit, filterOrigin]);

  const customTotalPages = Math.max(1, Math.ceil(filteredCustomRows.length / CATALOG_PAGE_SIZE));
  useEffect(() => {
    setCustomPage((p) => Math.min(p, customTotalPages));
  }, [customTotalPages]);

  const inactiveTotalPages = Math.max(1, Math.ceil(filteredInactiveProducts.length / CATALOG_PAGE_SIZE));
  useEffect(() => {
    setInactivePage((p) => Math.min(p, inactiveTotalPages));
  }, [inactiveTotalPages]);

  const customSafePage = Math.min(customPage, customTotalPages);
  const paginatedCustomRows = useMemo(() => {
    const start = (customSafePage - 1) * CATALOG_PAGE_SIZE;
    return filteredCustomRows.slice(start, start + CATALOG_PAGE_SIZE);
  }, [filteredCustomRows, customSafePage]);

  const inactiveSafePage = Math.min(inactivePage, inactiveTotalPages);
  const paginatedInactiveRows = useMemo(() => {
    const start = (inactiveSafePage - 1) * CATALOG_PAGE_SIZE;
    return filteredInactiveProducts.slice(start, start + CATALOG_PAGE_SIZE);
  }, [filteredInactiveProducts, inactiveSafePage]);

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

  const promoteForm = useForm<ProductFormValues>({
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

  const mutationPending =
    createMutation.isPending ||
    importMutation.isPending ||
    updateGlobalMutation.isPending ||
    updateLocalMutation.isPending ||
    resolveLinkMutation.isPending ||
    promoteMutation.isPending ||
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

  const onPickImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    importMutation.mutate(file, {
      onSuccess: (res) => {
        setImportResult(res);
        toast.success(
          `Importação concluída: ${res.created} criados, ${res.skipped} ignorados, ${res.failed} falhas.`,
        );
      },
      onError: (err) => {
        setImportResult(null);
        toast.error(catalogImportApiErrorMessage(err, "Não foi possível importar o arquivo."));
      },
    });
  };

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

  const openLink = (row: AdminPlatformActiveEntry) => {
    if (!row.local_product_id) return;
    setLinking({ id: row.local_product_id, name: row.name });
    // Pré-seleciona o global mais parecido para o admin só confirmar.
    setSelectedGlobalId(suggestGlobalId(row.name, globalProducts));
  };

  const saveGlobalLink = () => {
    if (!linking || !selectedGlobalId) return;
    resolveLinkMutation.mutate(
      { id: linking.id, globalProductId: selectedGlobalId },
      {
        onSuccess: () => {
          toast.success("Produto vinculado ao catálogo global.");
          setLinking(null);
          setSelectedGlobalId("");
        },
        onError: (e) => toast.error(apiErrorMessage(e, "Não foi possível vincular.")),
      },
    );
  };

  const openPromote = (row: AdminPlatformActiveEntry) => {
    if (!row.local_product_id) return;
    setPromoteRow(row);
    promoteForm.reset({
      name: row.name,
      category: row.category,
      dose_unit: row.dose_unit,
      default_label_url: row.label_url?.trim() ? row.label_url : "",
      equivalence_group: row.equivalence_group ?? "",
      is_active: true,
    });
  };

  const onPromote = promoteForm.handleSubmit((values) => {
    if (!promoteRow?.local_product_id) return;
    promoteMutation.mutate(
      {
        id: promoteRow.local_product_id,
        payload: {
          name: values.name,
          category: values.category,
          dose_unit: values.dose_unit,
          default_label_url: values.default_label_url?.trim() ? values.default_label_url.trim() : null,
          equivalence_group: values.equivalence_group?.trim() ? values.equivalence_group.trim() : null,
        },
      },
      {
        onSuccess: () => {
          toast.success("Produto cadastrado no catálogo global.");
          setPromoteRow(null);
        },
        onError: (e) => toast.error(apiErrorMessage(e, "Não foi possível cadastrar o produto.")),
      },
    );
  });

  const renderCustomVinculo = (row: AdminPlatformActiveEntry) => {
    if (!row.local_product_id) return <span className="text-xs text-muted-foreground">—</span>;

    if (row.global_product_id) {
      const linkedName = row.linked_global_name?.trim() || "Produto global";
      return (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded bg-success-soft px-1.5 py-0.5 text-[11px] font-medium text-success-strong">
            Vinculado
          </span>
          <span className="text-xs text-muted-foreground">→ {linkedName}</span>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-1.5">
        <Button size="sm" variant="outline" disabled={mutationPending} onClick={() => openLink(row)}>
          Vincular
        </Button>
        <Button size="sm" variant="outline" disabled={mutationPending} onClick={() => openPromote(row)}>
          Cadastrar produto
        </Button>
      </div>
    );
  };

  const globalTableRows = paginatedGlobalRows.map((p) => {
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
      <AdminCatalogNameCell key={`n-${p.global_product_id ?? p.local_product_id ?? p.name}`} name={p.name} />,
      PRODUCT_CATEGORY_LABELS[p.category as keyof typeof PRODUCT_CATEGORY_LABELS] ?? p.category,
      DOSE_UNIT_LABELS[p.dose_unit as keyof typeof DOSE_UNIT_LABELS] ?? p.dose_unit,
      origin,
      actions,
    ];
  });

  const customizedTableRows = paginatedCustomRows.map((p) => {
    const owner = p.owner_name?.trim();
    const agronomistCell = owner ? (
      <span className="block max-w-[10rem] truncate sm:max-w-[14rem]" title={owner}>
        {owner}
      </span>
    ) : (
      "—"
    );
    return [
      <AdminCatalogNameCell key={`cn-${p.local_product_id ?? p.name}`} name={p.name} />,
      PRODUCT_CATEGORY_LABELS[p.category as keyof typeof PRODUCT_CATEGORY_LABELS] ?? p.category,
      DOSE_UNITS[p.dose_unit as keyof typeof DOSE_UNITS]?.split(" ")[0] ?? p.dose_unit,
      p.price_brl ? `R$ ${parseFloat(String(p.price_brl)).toFixed(2)}` : "-",
      agronomistCell,
      <div key={`v-${p.local_product_id}`}>{renderCustomVinculo(p)}</div>,
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

  const inactiveRows = paginatedInactiveRows.map((p) => [
    <AdminCatalogNameCell key={`in-${p.global_product_id ?? p.local_product_id ?? p.name}`} name={p.name} />,
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

  const hasActiveListFilters = Boolean(filterName.trim() || filterCategory || filterDoseUnit || filterOrigin);

  return (
    <>
      <PageHeader
        icon={<Package className="h-5 w-5" />}
        section="Plataforma"
        title="Catálogo Global"
        description="Como administrador, você pode editar e desativar produtos ativos; a exclusão definitiva fica na aba Removidos."
      />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedTabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v);
            setFilterName("");
            setFilterCategory("");
            setFilterDoseUnit("");
            setFilterOrigin("");
          }}
          items={[
            { value: "global", label: "Catálogo Global" },
            { value: "customizados", label: "Customizados" },
            { value: "desativados", label: "Removidos", badgeCount: inactiveProducts.length },
          ]}
        />
      </div>

      <div className="mb-4 flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-0 flex-1 sm:min-w-[12rem] sm:max-w-xs">
              <label className="mb-1 block text-xs font-medium text-foreground">Nome</label>
              <Input
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                placeholder="Buscar por nome…"
              />
            </div>
            <div className="w-full min-w-[10rem] sm:w-44">
              <label className="mb-1 block text-xs font-medium text-foreground">Categoria</label>
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
              <label className="mb-1 block text-xs font-medium text-foreground">Unidade de dose</label>
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
            <div className="w-full min-w-[10rem] sm:w-44">
              <label className="mb-1 block text-xs font-medium text-foreground">Origem</label>
              <Select
                value={filterOrigin}
                onValueChange={(value) => {
                  setFilterOrigin(value === "platform" || value === "custom" ? value : "");
                }}
                placeholder="Todas"
                options={[
                  { value: "platform", label: "Plataforma" },
                  { value: "custom", label: "Customizado" },
                ]}
              />
            </div>
            {hasActiveListFilters ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 self-end sm:self-auto"
                onClick={() => {
                  setFilterName("");
                  setFilterCategory("");
                  setFilterDoseUnit("");
                  setFilterOrigin("");
                }}
              >
                Limpar filtros
              </Button>
            ) : null}
          </div>
          {activeTab === "global" ? (
            <div className="flex flex-wrap items-center gap-2">
              <Sheet
                open={importOpen}
                onOpenChange={(open) => {
                  setImportOpen(open);
                  if (!open) setImportResult(null);
                }}
              >
              <SheetTrigger asChild>
                <Button type="button" variant="secondary">
                  Importar CSV / Excel
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full max-w-full overflow-y-auto sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>Importar produtos da plataforma</SheetTitle>
                </SheetHeader>
                <div className="space-y-4 px-4 pb-4 text-sm">
                  <p className="text-muted-foreground">
                    O arquivo deve conter as colunas: <strong>MARCA</strong>, <strong>DOSAGEM</strong>,{" "}
                    <strong>TIPO</strong>, <strong>CLASSE</strong> (primeira linha = cabeçalho).
                  </p>
                  <div>
                    <p className="mb-2 font-medium text-foreground">Unidades de dose no sistema</p>
                    <p className="mb-2 text-muted-foreground">
                      A coluna <strong>DOSAGEM</strong> da planilha descreve a concentração (ex.: 720 g/L). O sistema
                      infere a unidade de dose do cadastro (litros, kg, g, mL ou dose) quando possível; se não houver
                      pistas claras, usa <strong>L</strong> (litros da calda).
                    </p>
                    <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                      {GLOBAL_DOSE_UNITS.map((u) => (
                        <li key={u}>
                          <code className="text-xs">{u}</code> — {DOSE_UNIT_LABELS[u]}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={downloadProdutosPlataformaTemplate}>
                    Baixar modelo CSV
                  </Button>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground">Arquivo (.csv ou .xlsx)</label>
                    <Input
                      type="file"
                      accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      disabled={importMutation.isPending}
                      onChange={onPickImportFile}
                    />
                    {importMutation.isPending ? (
                      <p className="mt-2 text-xs text-muted-foreground">Importando…</p>
                    ) : null}
                  </div>
                  {importResult ? (
                    <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
                      <p className="font-medium text-foreground">Último resultado</p>
                      <p className="mt-1 text-muted-foreground">
                        Criados: {importResult.created} · Ignorados (duplicados ou já existentes): {importResult.skipped}{" "}
                        · Falhas: {importResult.failed}
                      </p>
                      {importResult.errors.length > 0 ? (
                        <div className="mt-2 max-h-40 overflow-y-auto rounded border border-border bg-background p-2">
                          <p className="mb-1 font-medium">Linhas com erro</p>
                          <ul className="space-y-0.5 font-mono text-[11px]">
                            {importResult.errors.map((e, idx) => (
                              <li key={`${e.row}-${idx}-${e.message}`}>
                                Linha {e.row}: {e.message}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </SheetContent>
            </Sheet>
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
                <Button type="button" variant="clay">
                  <Plus className="h-4 w-4" />
                  Novo produto
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>Novo produto global</SheetTitle>
                </SheetHeader>
                <form onSubmit={onCreate} className="space-y-4 px-4 pb-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground">Nome</label>
                    <Input {...createForm.register("name")} />
                    {createForm.formState.errors.name && (
                      <p className="mt-1 text-xs text-destructive">{createForm.formState.errors.name.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground">Categoria</label>
                    <Select
                      {...createForm.register("category")}
                      value={createForm.watch("category") ?? ""}
                      filterLabel="Categoria"
                      options={GLOBAL_PRODUCT_CATEGORIES.map((c) => ({
                        value: c,
                        label: PRODUCT_CATEGORY_LABELS[c],
                      }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground">Unidade de dose</label>
                    <Select
                      {...createForm.register("dose_unit")}
                      value={createForm.watch("dose_unit") ?? ""}
                      filterLabel="Unidade de dose"
                      options={GLOBAL_DOSE_UNITS.map((u) => ({
                        value: u,
                        label: DOSE_UNIT_LABELS[u],
                      }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground">URL do rótulo (opcional)</label>
                    <Input {...createForm.register("default_label_url")} placeholder="https://..." />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground">
                      Grupo de equivalência (opcional)
                    </label>
                    <Input {...createForm.register("equivalence_group")} />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-input bg-background accent-primary focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
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
          ) : null}
        </div>
      </div>

      {activeTab === "global" && (
        <>
          {platformLoading ? (
            <TableRowsSkeleton rows={10} columns={5} />
          ) : platformRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum produto no catálogo da plataforma</p>
          ) : filteredGlobalRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum resultado para o filtro.</p>
          ) : (
            <DataTable
              headers={["Nome", "Categoria", "Unidade", "Origem", "Ações"]}
              rows={globalTableRows}
              columnCellClassNames={[
                "max-w-0 min-w-0",
                "whitespace-nowrap",
                "whitespace-nowrap",
                "max-w-0 min-w-0",
                "whitespace-nowrap",
              ]}
              footer={
                <PaginationBar
                  page={globalPage}
                  pageSize={CATALOG_PAGE_SIZE}
                  total={filteredGlobalRows.length}
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
          ) : customizedRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum produto customizado ativo</p>
          ) : filteredCustomRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum resultado para o filtro.</p>
          ) : (
            <DataTable
              headers={["Nome", "Categoria", "Unidade", "Preço", "Agrônomo", "Vínculo", "Ações"]}
              rows={customizedTableRows}
              columnCellClassNames={[
                "max-w-0 min-w-0",
                "whitespace-nowrap",
                "whitespace-nowrap",
                "whitespace-nowrap",
                "max-w-0 min-w-0",
                "min-w-[9rem]",
                "whitespace-nowrap",
              ]}
              footer={
                <PaginationBar
                  page={customPage}
                  pageSize={CATALOG_PAGE_SIZE}
                  total={filteredCustomRows.length}
                  onPageChange={setCustomPage}
                />
              }
            />
          )}
        </>
      )}

      {activeTab === "desativados" && (
        <>
          {deactivatedLoading ? (
            <TableRowsSkeleton rows={10} columns={5} />
          ) : inactiveProducts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum produto removido do catálogo ativo</p>
          ) : filteredInactiveProducts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum resultado para o filtro.</p>
          ) : (
            <DataTable
              headers={["Nome", "Categoria", "Unidade", "Origem", "Ações"]}
              rows={inactiveRows}
              columnCellClassNames={[
                "max-w-0 min-w-0",
                "whitespace-nowrap",
                "whitespace-nowrap",
                "max-w-0 min-w-0",
                "whitespace-nowrap",
              ]}
              footer={
                <PaginationBar
                  page={inactivePage}
                  pageSize={CATALOG_PAGE_SIZE}
                  total={filteredInactiveProducts.length}
                  onPageChange={setInactivePage}
                />
              }
            />
          )}
        </>
      )}

      <Sheet open={Boolean(editProduct)} onOpenChange={(o) => !o && setEditProduct(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Editar produto global</SheetTitle>
          </SheetHeader>
          <form onSubmit={onEditGlobal} className="space-y-4 px-4 pb-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Nome</label>
              <Input {...editForm.register("name")} />
              {editForm.formState.errors.name && (
                <p className="mt-1 text-xs text-destructive">{editForm.formState.errors.name.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Categoria</label>
              <Select
                {...editForm.register("category")}
                value={editForm.watch("category") ?? ""}
                filterLabel="Categoria"
                options={GLOBAL_PRODUCT_CATEGORIES.map((c) => ({
                  value: c,
                  label: PRODUCT_CATEGORY_LABELS[c],
                }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Unidade de dose</label>
              <Select
                {...editForm.register("dose_unit")}
                value={editForm.watch("dose_unit") ?? ""}
                filterLabel="Unidade de dose"
                options={GLOBAL_DOSE_UNITS.map((u) => ({
                  value: u,
                  label: DOSE_UNIT_LABELS[u],
                }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">URL do rótulo (opcional)</label>
              <Input {...editForm.register("default_label_url")} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Grupo de equivalência (opcional)</label>
              <Input {...editForm.register("equivalence_group")} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border-input bg-background accent-primary focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
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
          <form onSubmit={onEditCustom} className="space-y-4 px-4 pb-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Nome</label>
              <Input {...customEditForm.register("name")} />
              {customEditForm.formState.errors.name && (
                <p className="mt-1 text-xs text-destructive">{customEditForm.formState.errors.name.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Categoria</label>
              <Select
                {...customEditForm.register("category")}
                value={customEditForm.watch("category") ?? ""}
                filterLabel="Categoria"
                options={GLOBAL_PRODUCT_CATEGORIES.map((c) => ({
                  value: c,
                  label: PRODUCT_CATEGORY_LABELS[c],
                }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Unidade de dose</label>
              <Select
                {...customEditForm.register("dose_unit")}
                value={customEditForm.watch("dose_unit") ?? ""}
                filterLabel="Unidade de dose"
                options={GLOBAL_DOSE_UNITS.map((u) => ({
                  value: u,
                  label: DOSE_UNIT_LABELS[u],
                }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Preço (BRL)</label>
              <Input {...customEditForm.register("price_brl")} placeholder="0,00" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">URL do rótulo (opcional)</label>
              <Input {...customEditForm.register("label_url")} placeholder="https://..." />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border-input bg-background accent-primary focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
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

      <Sheet open={!!linking} onOpenChange={(open) => !open && setLinking(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Vincular “{linking?.name}” a um produto global</SheetTitle>
            <p className="text-sm text-muted-foreground">
              Escolha o produto oficial equivalente. O produto customizado do agrônomo deixa de existir e
              tudo onde ele foi usado (listas de compra, cronogramas, estoque) passa a apontar para o
              produto global escolhido.
            </p>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Produto global</label>
              <SearchableSelect
                value={selectedGlobalId}
                onValueChange={setSelectedGlobalId}
                options={globalProducts.map((g) => ({
                  value: g.id,
                  label: g.name,
                  keywords: g.name,
                }))}
                placeholder="Selecione o produto global…"
                filterLabel="Buscar produto global"
                searchPlaceholder="Buscar…"
                className="w-full"
              />
            </div>
            {selectedGlobalProduct ? (
              <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Prévia da sugestão
                </p>
                <p className="mt-1 font-medium text-foreground">{selectedGlobalProduct.name}</p>
                <p className="text-xs text-muted-foreground">
                  {PRODUCT_CATEGORY_LABELS[
                    selectedGlobalProduct.category as keyof typeof PRODUCT_CATEGORY_LABELS
                  ] ?? selectedGlobalProduct.category}
                  {" · "}
                  {DOSE_UNIT_LABELS[selectedGlobalProduct.dose_unit as keyof typeof DOSE_UNIT_LABELS] ??
                    selectedGlobalProduct.dose_unit}
                </p>
              </div>
            ) : null}
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                onClick={saveGlobalLink}
                disabled={!selectedGlobalId || resolveLinkMutation.isPending}
              >
                {resolveLinkMutation.isPending ? "Vinculando…" : "Vincular"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setLinking(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={Boolean(promoteRow)} onOpenChange={(o) => !o && setPromoteRow(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Cadastrar “{promoteRow?.name}” no catálogo global</SheetTitle>
            <p className="text-sm text-muted-foreground">
              Revise/edite os dados e confirme. O produto entra no catálogo global e sai da lista de
              customizados, mantendo onde já foi usado.
              {promoteRow?.owner_name ? ` Agrônomo: ${promoteRow.owner_name}.` : ""}
            </p>
          </SheetHeader>
          <form onSubmit={onPromote} className="space-y-4 px-4 pb-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Nome</label>
              <Input {...promoteForm.register("name")} />
              {promoteForm.formState.errors.name && (
                <p className="mt-1 text-xs text-destructive">{promoteForm.formState.errors.name.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Categoria</label>
              <Select
                {...promoteForm.register("category")}
                value={promoteForm.watch("category") ?? ""}
                filterLabel="Categoria"
                options={GLOBAL_PRODUCT_CATEGORIES.map((c) => ({
                  value: c,
                  label: PRODUCT_CATEGORY_LABELS[c],
                }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Unidade de dose</label>
              <Select
                {...promoteForm.register("dose_unit")}
                value={promoteForm.watch("dose_unit") ?? ""}
                filterLabel="Unidade de dose"
                options={GLOBAL_DOSE_UNITS.map((u) => ({
                  value: u,
                  label: DOSE_UNIT_LABELS[u],
                }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                URL do rótulo (opcional)
              </label>
              <Input {...promoteForm.register("default_label_url")} placeholder="https://..." />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                Grupo de equivalência (opcional)
              </label>
              <Input {...promoteForm.register("equivalence_group")} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={promoteMutation.isPending}>
                {promoteMutation.isPending ? "Cadastrando…" : "Cadastrar produto"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setPromoteRow(null)}>
                Cancelar
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
