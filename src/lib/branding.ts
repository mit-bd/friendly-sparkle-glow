import { supabase } from "@/integrations/supabase/client";

export interface PublicBranding {
  name: string;
  logoUrl: string | null;
}

/**
 * Login-page branding (company name + signed logo URL), fetched from the
 * `public-branding` edge function. Runs before the visitor is authenticated.
 */
export async function getPublicBranding(): Promise<PublicBranding> {
  try {
    const { data, error } = await supabase.functions.invoke("public-branding");
    if (error || !data) return { name: "", logoUrl: null };
    return data as PublicBranding;
  } catch {
    return { name: "", logoUrl: null };
  }
}