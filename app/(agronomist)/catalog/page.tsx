"use client";

import { PageHeader } from "@/components/domain/page-header";
import { DataTable } from "@/components/ui/table";
import { useLocalCatalog } from "@/lib/api/hooks";

export default function CatalogPage() {
  const { data } = useLocalCatalog();
  const rows =
    data?.data?.map((product) => [product.name, product.category ?? "-", product.id]) ?? [];

  return (
    <>
      <PageHeader
        title="Catálogo local"
        description="Produtos personalizados e clonados do catálogo global."
      />
      <DataTable headers={["Nome", "Categoria", "ID"]} rows={rows} />
    </>
  );
}
