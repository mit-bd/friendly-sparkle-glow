import { createServerFn } from "@tanstack/react-start";

/** Public branding for the login page (name + signed logo URL). No auth required. */
export const getPublicBranding = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: company } = await supabaseAdmin
    .from("company_profile")
    .select("name, logo_url")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let logoUrl: string | null = null;
  if (company?.logo_url) {
    const { data: signed } = await supabaseAdmin.storage
      .from("logos")
      .createSignedUrl(company.logo_url, 3600);
    logoUrl = signed?.signedUrl ?? null;
  }

  return { name: company?.name ?? "", logoUrl };
});