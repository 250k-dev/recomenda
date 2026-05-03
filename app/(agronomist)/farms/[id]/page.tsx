import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/domain/page-header";

export default async function FarmDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  return (
    <>
      <PageHeader title="Detalhe da fazenda" description={`Fazenda ${params.id}`} />
      <Card>Talhões, acessos de produtores e safras vinculadas.</Card>
    </>
  );
}
