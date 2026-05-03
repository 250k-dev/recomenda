"use client";

import { PageHeader } from "@/components/domain/page-header";
import { DataTable } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useImpersonateProducer, useProducers } from "@/lib/api/hooks";

export default function ProducersPage() {
  const { data } = useProducers();
  const impersonateMutation = useImpersonateProducer();

  const rows =
    data?.data?.map((producer) => [
      producer.name,
      producer.email,
      <Button
        key={producer.id}
        onClick={() => impersonateMutation.mutate(producer.id)}
        disabled={impersonateMutation.isPending}
      >
        Acessar como produtor
      </Button>,
    ]) ?? [];

  return (
    <>
      <PageHeader title="Produtores" description="Gestão de produtores e acesso por fazenda." />
      <DataTable headers={["Nome", "E-mail", "Ações"]} rows={rows} />
    </>
  );
}
