import { ReactNode } from "react";
import { AgronomistShell } from "@/components/layout/agronomist-shell";

export default function AgronomistLayout({ children }: { children: ReactNode }) {
  return <AgronomistShell>{children}</AgronomistShell>;
}
