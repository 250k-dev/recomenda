import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AgronomistShell } from "@/components/layout/agronomist-shell";
import { getSessionRole } from "@/lib/auth/session";

export default async function AgronomistLayout({ children }: { children: ReactNode }) {
  const role = await getSessionRole();
  if (role !== "AGRONOMIST") {
    redirect(
      role === "ADMIN" ? "/admin" : role === "PRODUCER" ? "/producer-only" : "/login",
    );
  }
  return <AgronomistShell>{children}</AgronomistShell>;
}
