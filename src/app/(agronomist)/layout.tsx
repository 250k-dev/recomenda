import { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";

export default function AgronomistLayout({ children }: { children: ReactNode }) {
  return <AppShell role="AGRONOMIST">{children}</AppShell>;
}
