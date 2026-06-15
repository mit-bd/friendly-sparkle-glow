import type { ReactNode } from "react";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppTopbar } from "./AppTopbar";
import { NotificationListener } from "./NotificationListener";
import { AiAssistant } from "./AiAssistant";
import { BottomNav } from "./BottomNav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <NotificationListener />
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <AppTopbar />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 pb-bottomnav sm:px-6 sm:py-8 md:pb-8 lg:px-10 lg:py-10">
          {children}
        </main>
        <footer className="hidden border-t border-border px-4 py-4 sm:px-6 md:block lg:px-10">
          <p className="mx-auto w-full max-w-7xl text-center text-xs text-muted-foreground">
            © 2026 Motion IT BD. All Rights Reserved.
          </p>
        </footer>
      </SidebarInset>
      <BottomNav />
      <AiAssistant />
    </SidebarProvider>
  );
}