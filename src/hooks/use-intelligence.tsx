import { useQuery } from "@tanstack/react-query";

import type { DateRange } from "@/lib/analytics";
import { fetchApprovedReturns, fetchApprovedDamages } from "@/lib/loss";
import { fetchApprovedMarketing } from "@/lib/marketing";
import {
  fetchIntelExpenses,
  previousRange,
  trailingMonthsRange,
  type IntelDataset,
} from "@/lib/intelligence";

async function loadDataset(range: DateRange): Promise<IntelDataset> {
  const [expenses, returns, damages] = await Promise.all([
    fetchIntelExpenses(range),
    fetchApprovedReturns(range),
    fetchApprovedDamages(range),
  ]);
  return { expenses, returns, damages };
}

/** Approved intelligence dataset for the active filter range. */
export function useIntelData(range: DateRange) {
  return useQuery({
    queryKey: ["intel", "current", range.from, range.to],
    queryFn: () => loadDataset(range),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}

/** Equal-length preceding window, for % change vs previous period. */
export function useIntelPrevious(range: DateRange) {
  const prev = previousRange(range);
  return useQuery({
    queryKey: ["intel", "previous", prev.from, prev.to],
    queryFn: () => loadDataset(prev),
    staleTime: 30_000,
    placeholderData: (p) => p,
  });
}

/** Trailing 12-month history powering trends, anomaly detection and stability. */
export function useIntelHistory(months = 12) {
  const range = trailingMonthsRange(months);
  return useQuery({
    queryKey: ["intel", "history", range.from, range.to],
    queryFn: () => loadDataset(range),
    staleTime: 60_000,
  });
}

/** Approved marketing rows (multi-currency) for the marketing intelligence panel. */
export function useIntelMarketing(range: DateRange) {
  return useQuery({
    queryKey: ["intel", "marketing", range.from, range.to],
    queryFn: () => fetchApprovedMarketing(range),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}