// Public branding for the login page (company name + signed logo URL).
// No auth required — uses the service role to read the single company profile
// row and sign the logo before the visitor is authenticated.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: company } = await admin
      .from("company_profile")
      .select("name, logo_url")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    let logoUrl: string | null = null;
    if (company?.logo_url) {
      const { data: signed } = await admin.storage
        .from("logos")
        .createSignedUrl(company.logo_url, 3600);
      logoUrl = signed?.signedUrl ?? null;
    }

    return new Response(
      JSON.stringify({ name: company?.name ?? "", logoUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (_err) {
    return new Response(JSON.stringify({ name: "", logoUrl: null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});