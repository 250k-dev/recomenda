import { ReactNode } from "react";
import { MobileTopbar } from "@/components/layout/mobile-topbar";
import { ImpersonationBanner } from "@/components/layout/impersonation-banner";
import type { UserRole } from "@/types/auth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";

export function AppShell({
  role,
  children,
}: {
  role: UserRole;
  children: ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar role={role} />
      <div className="relative flex min-h-svh flex-1 flex-col min-w-0 bg-canvas">
        <MobileTopbar />
        <ImpersonationBanner />
        <main className="flex-1 px-4 py-6 md:px-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}
