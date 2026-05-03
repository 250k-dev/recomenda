import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/domain/page-header";

export default function TimingTemplatesPage() {
  return (
    <>
      <PageHeader
        title="Templates de timing"
        description="Definição de estágios, janelas e mix padrão por cultura."
      />
      <Card>Integração prevista com `/timing_templates` e reorder de estágios.</Card>
    </>
  );
}
