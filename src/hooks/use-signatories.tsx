import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type SignatoryType = "accountant" | "manager" | "ceo";

export interface Signatory {
  id: string;
  type: SignatoryType;
  full_name: string;
  designation: string;
  signature_url: string | null;
}

export const SIGNATORY_ROLE_LABEL: Record<SignatoryType, string> = {
  accountant: "Prepared By",
  manager: "Reviewed By",
  ceo: "Approved By",
};

export const SIGNATORY_ORDER: SignatoryType[] = ["accountant", "manager", "ceo"];

/** Live authorized signatories (Prepared / Reviewed / Approved By). */
export function useSignatories() {
  return useQuery({
    queryKey: ["signatories"],
    queryFn: async () => {
      const { data } = await supabase.from("signatories").select("*");
      const rows = (data as Signatory[]) ?? [];
      return rows.sort(
        (a, b) => SIGNATORY_ORDER.indexOf(a.type) - SIGNATORY_ORDER.indexOf(b.type),
      );
    },
    staleTime: 5 * 60_000,
  });
}
