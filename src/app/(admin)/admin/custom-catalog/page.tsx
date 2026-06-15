"use client";

import { useState } from "react";
import { Package } from "lucide-react";

import { PageHeader } from "@/components/domain/page-header";
import { SegmentedTabs } from "@/components/domain/segmented-tabs";
import { TableRowsSkeleton } from "@/components/domain/page-skeletons";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { useAllLocalProducts, useAllInactiveLocalProducts } from "@/lib/api/hooks";

const CATEGORIES: Record<string, string> = {
  SEED: "Variedade / Híbrido",
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

export default function CustomCatalogPage() {
  const { data: activeData, isLoading: activeLoading } = useAllLocalProducts();
  const { data: inactiveData, isLoading: inactiveLoading } = useAllInactiveLocalProducts();
  const [activeTab, setActiveTab] = useState<"ativos" | "inativos">("ativos");

  type ProductRow = {
    id: string;
    name: string;
    is_active?: boolean;
    category?: string | null;
    dose_unit?: string | null;
    price_brl?: string | number | null;
    agronomist_name?: string | null;
  };

  const activeProducts = (activeData?.data ?? []) as ProductRow[];
  const inactiveProducts = (inactiveData?.data ?? []) as ProductRow[];

  const formatPrice = (value: ProductRow["price_brl"]) =>
    value != null ? `R$ ${parseFloat(String(value)).toFixed(2)}` : "—";

  const activeRows = activeProducts
    .filter((p) => p.is_active !== false)
    .map((product) => [
      <div key={`name-${product.id}`} className="font-medium">{product.name}</div>,
      product.category ? (CATEGORIES[product.category] ?? product.category) : "—",
      product.dose_unit ? (DOSE_UNITS[product.dose_unit]?.split(" ")[0] ?? product.dose_unit) : "—",
      formatPrice(product.price_brl),
      "—",
    ]);

  const inactiveRows = inactiveProducts.map((product) => [
    <div key={`name-${product.id}`} className="font-medium">{product.name}</div>,
    product.category ? (CATEGORIES[product.category] ?? product.category) : "—",
    product.dose_unit ? (DOSE_UNITS[product.dose_unit]?.split(" ")[0] ?? product.dose_unit) : "—",
    formatPrice(product.price_brl),
    product.agronomist_name || "—",
  ]);

  return (
    <>
      <PageHeader
        icon={<Package className="h-5 w-5" />}
        section="Catálogo"
        title="Produtos Customizados"
        description="Produtos criados pelos agrônomos. Veja aqui todos os produtos customizados do sistema."
      />

      <div className="mb-6">
        <SegmentedTabs
          value={activeTab}
          onValueChange={setActiveTab}
          items={[
            { value: "ativos", label: "Ativos" },
            { value: "inativos", label: "Removidos", badgeCount: inactiveProducts.length },
          ]}
        />
      </div>

      {activeTab === "ativos" && (
        <>
          {activeLoading ? (
            <TableRowsSkeleton rows={10} columns={5} />
          ) : activeRows.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Nenhum produto customizado ativo"
              description="Quando agrônomos criarem produtos próprios, eles aparecerão aqui."
            />
          ) : (
            <DataTable headers={["Nome", "Categoria", "Unidade", "Preço", "Criado por"]} rows={activeRows} />
          )}
        </>
      )}

      {activeTab === "inativos" && (
        <>
          {inactiveLoading ? (
            <TableRowsSkeleton rows={10} columns={5} />
          ) : inactiveRows.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Nenhum produto removido"
              variant="inline"
            />
          ) : (
            <DataTable headers={["Nome", "Categoria", "Unidade", "Preço", "Criado por"]} rows={inactiveRows} />
          )}
        </>
      )}
    </>
  );
}
