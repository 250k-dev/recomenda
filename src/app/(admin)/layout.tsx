import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getSessionRole } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const role = await getSessionRole();
  if (role !== "ADMIN") {
    redirect(
      role === "AGRONOMIST" ? "/dashboard" : role === "PRODUCER" ? "/producer-only" : "/login",
    );
  }
  return <AppShell role="ADMIN">{children}</AppShell>;
}
