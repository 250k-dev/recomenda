import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getSessionRole } from "@/lib/auth/session";
import { routes } from "@recomenda/config";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const role = await getSessionRole();
  if (role !== "ADMIN" && role !== "ORG_ADMIN") {
    redirect(
      role === "AGRONOMIST" || role === "STAFF" || role === "PRODUCER"
        ? routes.dashboard
        : routes.login(),
    );
  }
  return <AppShell role={role}>{children}</AppShell>;
}
