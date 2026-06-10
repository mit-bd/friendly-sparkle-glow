import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl } from "./storage";
import { applyFavicon } from "./favicon";

export interface CompanyProfile {
  id: string;
  name: string;
  logo_url: string | null;
  address: string | null;
  mobile: string | null;
  email: string | null;
  website: string | null;
  facebook: string | null;
  whatsapp: string | null;
  trade_license: string | null;
  bin_number: string | null;
  tin_number: string | null;
  description: string | null;
}

interface BrandingContextValue {
  company: CompanyProfile | null;
  logoUrl: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextValue | undefined>(undefined);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    // Admins can read the full row (including sensitive tax/license fields).
    const { data } = await supabase
      .from("company_profile")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    let comp: CompanyProfile | null = (data as CompanyProfile | null) ?? null;

    // Non-admins are blocked by RLS from the table; fall back to the safe
    // branding RPC that excludes sensitive identifiers (TIN/BIN/trade license).
    if (!comp) {
      const { data: rpcData } = await (supabase as unknown as {
        rpc: (fn: string) => Promise<{ data: Partial<CompanyProfile>[] | null }>;
      }).rpc("get_company_branding");
      const row = rpcData?.[0] ?? null;
      comp = row
        ? ({
            trade_license: null,
            bin_number: null,
            tin_number: null,
            ...row,
          } as CompanyProfile)
        : null;
    }

    setCompany(comp);
    const signedLogo = await getSignedUrl("logos", comp?.logo_url);
    setLogoUrl(signedLogo);
    // Keep the browser-tab favicon in sync with the active company logo so an
    // admin changing the logo updates the favicon instantly (no redeploy).
    applyFavicon(signedLogo);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <BrandingContext.Provider value={{ company, logoUrl, loading, refresh }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error("useBranding must be used within BrandingProvider");
  return ctx;
}