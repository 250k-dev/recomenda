"use client";

import Link from "next/link";
import { PageHeader } from "@/components/domain/page-header";
import { DataTable } from "@/components/ui/table";
import { useFarms } from "@/lib/api/hooks";

export default function FarmsPage() {
  const { data } = useFarms();
  const rows =
    data?.data?.map((farm) => [
      <Link key={farm.id} href={`/farms/${farm.id}`} className="text-[var(--brand)] underline">
        {farm.name}
      </Link>,
      farm.city ?? "-",
      farm.state ?? "-",
    ]) ?? [];

  return (
    <>
      <PageHeader title="Fazendas" description="Cadastro e gestão de fazendas e talhões." />
      <DataTable headers={["Nome", "Cidade", "UF"]} rows={rows} />
    </>
  );
}
