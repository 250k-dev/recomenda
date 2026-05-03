import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/domain/page-header";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Configurações" description="Preferências de conta e notificações." />
      <Card>Preferências de notificações e segurança da conta.</Card>
    </>
  );
}
