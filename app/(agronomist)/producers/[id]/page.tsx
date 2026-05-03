import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/domain/page-header";

export default async function ProducerDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  return (
    <>
      <PageHeader title="Detalhe do produtor" description={`Produtor ${params.id}`} />
      <Card>Gestão de acessos por fazenda e status de convite.</Card>
    </>
  );
}
