"use client";

import { useState } from "react";
import { PageHeader } from "@/components/domain/page-header";
import { SegmentedTabs } from "@/components/domain/segmented-tabs";
import { TableRowsSkeleton } from "@/components/domain/page-skeletons";
import { DataTable } from "@/components/ui/table";
import { useAllLocalProducts, useAllInactiveLocalProducts } from "@/lib/api/hooks";

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

export default function CustomCatalogPage() {
  const { data: activeData, isLoading: activeLoading } = useAllLocalProducts();
  const { data: inactiveData, isLoading: inactiveLoading } = useAllInactiveLocalProducts();
  const [activeTab, setActiveTab] = useState<"ativos" | "inativos">("ativos");

  const activeProducts = activeData?.data ?? [];
  const inactiveProducts = inactiveData?.data ?? [];

  const activeRows = activeProducts
    .filter((p: any) => p.is_active !== false)
    .map((product: any) => [
      <div key={`name-${product.id}`} className="font-medium">{product.name}</div>,
      product.category ? (CATEGORIES[product.category] ?? product.category) : "-",
      product.dose_unit ? (DOSE_UNITS[product.dose_unit]?.split(" ")[0] ?? product.dose_unit) : "-",
      product.price_brl ? `R$ ${parseFloat(product.price_brl).toFixed(2)}` : "-",
      "-",
    ]);

  const inactiveRows = inactiveProducts.map((product: any) => [
    <div key={`name-${product.id}`} className="font-medium">{product.name}</div>,
    product.category ? (CATEGORIES[product.category] ?? product.category) : "-",
    product.dose_unit ? (DOSE_UNITS[product.dose_unit]?.split(" ")[0] ?? product.dose_unit) : "-",
    product.price_brl ? `R$ ${parseFloat(product.price_brl).toFixed(2)}` : "-",
    (product as any).agronomist_name || "-",
  ]);

  return (
    <>
      <PageHeader
        title="Produtos Customizados"
        description="Produtos criados pelos agrônomos. Veja aqui todos os produtos customizados do sistema."
      />

      <div className="mb-6">
        <SegmentedTabs
          value={activeTab}
          onValueChange={setActiveTab}
          items={[
            { value: "ativos", label: "Ativos" },
            { value: "inativos", label: "Desativados", badgeCount: inactiveProducts.length },
          ]}
        />
      </div>

      {activeTab === "ativos" && (
        <>
          {activeLoading ? (
            <TableRowsSkeleton rows={10} columns={5} />
          ) : activeRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">Nenhum produto customizado ativo</p>
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
            <p className="py-8 text-center text-sm text-zinc-500">Nenhum produto customizado desativado</p>
          ) : (
            <DataTable headers={["Nome", "Categoria", "Unidade", "Preço", "Criado por"]} rows={inactiveRows} />
          )}
        </>
      )}
    </>
  );
}
