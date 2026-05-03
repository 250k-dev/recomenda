import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/domain/page-header";

export default async function MixTemplateDetailPage(
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  return (
    <>
      <PageHeader title="Template de mix" description={`Template ${params.id}`} />
      <Card>Produtos, dose por hectare e preview para área.</Card>
    </>
  );
}
