import { ReactNode } from "react";
import { ImpersonationBanner } from "@/components/layout/impersonation-banner";
import { AppHeader } from "./app-header";

export function AgronomistShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-canvas">
      <AppHeader />
      <ImpersonationBanner />
      <main className="flex-1 px-4 py-6 md:px-8">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
