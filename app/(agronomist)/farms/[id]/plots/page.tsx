import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/domain/page-header";

export default async function FarmPlotsPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  return (
    <>
      <PageHeader title="Talhões" description={`Talhões da fazenda ${params.id}`} />
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Listagem e gestão de talhões vinculados.
        </CardContent>
      </Card>
    </>
  );
}
