import { useQuery } from "@tanstack/react-query";

import {
  fetchApprovedExpenses,
  fetchStatusCounts,
  type DateRange,
} from "@/lib/analytics";
import { fetchCategories, fetchSubcategories } from "@/lib/expenses";

/** Categories + subcategories incl. inactive, so historical rows always resolve. */
export function useTaxonomy() {
  return useQuery({
    queryKey: ["analytics", "taxonomy"],
    queryFn: async () => {
      const [categories, subcategories] = await Promise.all([
        fetchCategories(true),
        fetchSubcategories(true),
      ]);
      return { categories, subcategories };
    },
    staleTime: 5 * 60_000,
  });
}

/** Approved, date-bounded expense rows for the active dashboard filter. */
export function useApprovedExpenses(range: DateRange) {
  return useQuery({
    queryKey: ["analytics", "approved", range.from, range.to],
    queryFn: () => fetchApprovedExpenses(range),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}

export function useStatusCounts(range: DateRange) {
  return useQuery({
    queryKey: ["analytics", "counts", range.from, range.to],
    queryFn: () => fetchStatusCounts(range),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}