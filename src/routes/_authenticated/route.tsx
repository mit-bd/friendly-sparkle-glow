import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { AuthProvider } from "@/lib/auth-context";
import { BrandingProvider } from "@/lib/branding-context";
import { AppShell } from "@/components/app/AppShell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <AuthProvider>
      <BrandingProvider>
        <AppShell>
          <Outlet />
        </AppShell>
      </BrandingProvider>
    </AuthProvider>
  );
}