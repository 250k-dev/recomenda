import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AgronomistShell } from "@/components/layout/agronomist-shell";
import { getSessionRole } from "@/lib/auth/session";

export default async function AgronomistLayout({ children }: { children: ReactNode }) {
  const role = await getSessionRole();
  // Consultor usa a mesma área do agrônomo (com escopo aplicado no backend).
  if (role !== "AGRONOMIST" && role !== "CONSULTANT") {
    redirect(
      role === "ADMIN" ? "/admin" : role === "PRODUCER" ? "/producer-only" : "/login",
    );
  }
  return <AgronomistShell>{children}</AgronomistShell>;
}
