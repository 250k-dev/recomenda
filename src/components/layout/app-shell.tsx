import { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileTopbar } from "@/components/layout/mobile-topbar";
import { ImpersonationBanner } from "@/components/layout/impersonation-banner";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import type { UserRole } from "@/types/auth";

export function AppShell({
  role,
  children,
}: {
  role: UserRole;
  children: ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-muted">
        <Sidebar role={role} />
        <div className="flex min-h-screen flex-1 flex-col min-w-0">
          <MobileTopbar role={role} />
          <ImpersonationBanner />
          <main className="flex-1 px-4 py-6 md:px-8">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
