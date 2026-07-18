import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AgronomistShell } from "@/components/layout/agronomist-shell";
import { getSessionRole } from "@/lib/auth/session";
import { routes } from "@recomenda/config";

export default async function AgronomistLayout({ children }: { children: ReactNode }) {
  const role = await getSessionRole();
  // Membro de equipe (Gestor/Consultor) usa a mesma área do agrônomo (com escopo
  // e permissões aplicados no backend).
  if (role !== "AGRONOMIST" && role !== "STAFF") {
    redirect(
      role === "ADMIN"
        ? routes.admin.dashboard
        : role === "PRODUCER"
          ? routes.acessoProdutor
          : routes.login(),
    );
  }
  return <AgronomistShell>{children}</AgronomistShell>;
}
