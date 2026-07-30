import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AgronomistShell } from "@/components/layout/agronomist-shell";
import { getSessionRole } from "@/lib/auth/session";
import { routes } from "@recomenda/config";

export default async function AgronomistLayout({ children }: { children: ReactNode }) {
  const role = await getSessionRole();
  // Membro de equipe (Gestor/Consultor) usa a mesma área do agrônomo (com escopo
  // e permissões aplicados no backend).
  if (role !== "AGRONOMIST" && role !== "STAFF" && role !== "PRODUCER") {
    redirect(role === "ADMIN" || role === "ORG_ADMIN" ? routes.admin.dashboard : routes.login());
  }
  return <AgronomistShell>{children}</AgronomistShell>;
}
