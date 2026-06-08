import type { ReactNode } from "react";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppTopbar } from "./AppTopbar";
import { NotificationListener } from "./NotificationListener";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <NotificationListener />
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <AppTopbar />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}