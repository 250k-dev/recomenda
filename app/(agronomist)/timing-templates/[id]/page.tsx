import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/domain/page-header";

export default async function TimingTemplateDetailPage(
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  return (
    <>
      <PageHeader title="Template de timing" description={`Template ${params.id}`} />
      <Card>Edição de estágios, janela e ordenação.</Card>
    </>
  );
}
