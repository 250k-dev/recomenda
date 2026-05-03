import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/domain/page-header";

export default function AdminHomePage() {
  return (
    <>
      <PageHeader
        title="Painel Admin"
        description="Gerencie planos, agrônomos e catálogo global."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Card>Total de Agrônomos</Card>
        <Card>Planos ativos</Card>
        <Card>Produtos globais</Card>
      </div>
    </>
  );
}
