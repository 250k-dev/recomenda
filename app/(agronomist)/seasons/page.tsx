"use client";

import Link from "next/link";
import { PageHeader } from "@/components/domain/page-header";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/table";
import { useSeasons } from "@/lib/api/hooks";

export default function SeasonsPage() {
  const { data } = useSeasons();
  const rows =
    data?.data?.map((season) => [
      <Link
        key={season.id}
        href={`/seasons/${season.id}`}
        className="text-[var(--brand)] underline"
      >
        {season.id}
      </Link>,
      season.crop,
      season.status,
      season.plot_name,
    ]) ?? [];

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <PageHeader title="Safras" description="Gestão de ciclo, timeline e status de execução." />
        <Link href="/seasons/new">
          <Button>Nova safra</Button>
        </Link>
      </div>
      <DataTable headers={["ID", "Cultura", "Status", "Talhão"]} rows={rows} />
    </>
  );
}
