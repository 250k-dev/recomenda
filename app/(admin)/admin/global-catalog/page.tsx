"use client";

import { PageHeader } from "@/components/domain/page-header";
import { DataTable } from "@/components/ui/table";
import { useGlobalCatalog } from "@/lib/api/hooks";

export default function AdminGlobalCatalogPage() {
  const { data } = useGlobalCatalog();
  const rows =
    data?.data?.map((product) => [product.name, product.category ?? "-", product.id]) ?? [];

  return (
    <>
      <PageHeader
        title="Catálogo global"
        description="Produtos base controlados por administradores."
      />
      <DataTable headers={["Nome", "Categoria", "ID"]} rows={rows} />
    </>
  );
}
