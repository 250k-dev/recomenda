import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/domain/page-header";

export default async function FarmPlotsPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  return (
    <>
      <PageHeader title="Talhões" description={`Talhões da fazenda ${params.id}`} />
      <Card>Listagem e gestão de talhões vinculados.</Card>
    </>
  );
}
