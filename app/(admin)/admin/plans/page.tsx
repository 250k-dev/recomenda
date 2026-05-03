import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/domain/page-header";

export default function AdminPlansPage() {
  return (
    <>
      <PageHeader title="Planos" description="Controle de planos e quotas." />
      <Card>Integração com `GET /plans` e `POST /plans`.</Card>
    </>
  );
}
