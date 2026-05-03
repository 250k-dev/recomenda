import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/domain/page-header";

export default function MixTemplatesPage() {
  return (
    <>
      <PageHeader
        title="Templates de mix"
        description="Composição de doses por produto para cada aplicação."
      />
      <Card>Integração prevista com `/mix_templates` e itens de mix.</Card>
    </>
  );
}
