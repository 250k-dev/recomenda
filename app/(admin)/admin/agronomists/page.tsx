import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/domain/page-header";

export default function AdminAgronomistsPage() {
  return (
    <>
      <PageHeader
        title="Agrônomos"
        description="Onboarding e gestão de contas de agrônomos."
      />
      <Card>Integração com `/admin/agronomists`.</Card>
    </>
  );
}
