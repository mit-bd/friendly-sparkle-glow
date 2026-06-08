import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, X, Receipt } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { ROLE_LABELS } from "@/lib/modules";
import {
  buildCategorySummary,
  buildDailyTrend,
  buildMonthlyTrend,
  buildSubcategorySummary,
  resolveRange,
  searchExpenses,
  DEFAULT_PRESET,
  type DateRange,
  type RangePreset,
} from "@/lib/analytics";
import { useApprovedExpenses, useStatusCounts, useTaxonomy } from "@/hooks/use-analytics";
import { DateRangeFilter } from "@/components/analytics/DateRangeFilter";
import { SummaryCards } from "@/components/analytics/SummaryCards";
import { CategoryAnalytics } from "@/components/analytics/CategoryAnalytics";
import { SubcategoryAnalytics } from "@/components/analytics/SubcategoryAnalytics";
import { TrendCharts } from "@/components/analytics/TrendCharts";
import { MarketingPanel, LossPanel } from "@/components/analytics/MarketingLossPanels";
import { ExpenseMiniTable } from "@/components/analytics/ExpenseMiniTable";
import { EmptyState } from "@/components/analytics/EmptyState";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Dashboard — Motion IT BD" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { profile, primaryRole } = useAuth();
  const firstName = profile?.full_name?.split(" ")[0] || "there";

  const [preset, setPreset] = useState<RangePreset>(DEFAULT_PRESET);
  const [range, setRange] = useState<DateRange>(() => resolveRange(DEFAULT_PRESET));
  const [term, setTerm] = useState("");

  const taxonomy = useTaxonomy();
  const expenses = useApprovedExpenses(range);
  const counts = useStatusCounts(range);

  const categories = taxonomy.data?.categories ?? [];
  const subcategories = taxonomy.data?.subcategories ?? [];
  const rows = expenses.data ?? [];
  const loading = expenses.isLoading || taxonomy.isLoading;

  const categorySummary = useMemo(
    () => buildCategorySummary(rows, categories),
    [rows, categories],
  );
  const subcategorySummary = useMemo(
    () => buildSubcategorySummary(rows, subcategories, categories),
    [rows, subcategories, categories],
  );
  const daily = useMemo(() => buildDailyTrend(rows, range), [rows, range]);
  const monthly = useMemo(() => buildMonthlyTrend(rows), [rows]);
  const searchResults = useMemo(
    () => searchExpenses(rows, term, categories, subcategories),
    [rows, term, categories, subcategories],
  );

  const catName = useMemo(() => {
    const m = new Map(categories.map((c) => [c.id, c.name]));
    return (id: string | null) => (id ? m.get(id) ?? "—" : "—");
  }, [categories]);
  const subName = useMemo(() => {
    const m = new Map(subcategories.map((s) => [s.id, s.name]));
    return (id: string | null) => (id ? m.get(id) ?? "—" : "—");
  }, [subcategories]);

  const onRangeChange = (p: RangePreset, r: DateRange) => {
    setPreset(p);
    setRange(r);
  };

  const noData = !loading && rows.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description={
          primaryRole
            ? `Signed in as ${ROLE_LABELS[primaryRole]}. Financial overview of approved expenses.`
            : "Financial overview of approved expenses."
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <DateRangeFilter preset={preset} range={range} onChange={onRangeChange} />
        <div className="relative w-full lg:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search number, category, notes…"
            className="pl-9 pr-9"
          />
          {term && (
            <button
              onClick={() => setTerm("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {term ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Search results · {searchResults.length} found
            </CardTitle>
          </CardHeader>
          <CardContent>
            {searchResults.length === 0 ? (
              <EmptyState
                icon={Search}
                title="No approved expenses match your search."
                description="Search covers expense number, category, subcategory, description and notes."
              />
            ) : (
              <ExpenseMiniTable
                rows={searchResults}
                categoryName={catName}
                subcategoryName={subName}
              />
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <SummaryCards
            rows={expenses.data}
            counts={counts.data}
            categories={categories}
            subcategories={subcategories}
            loading={loading}
          />

          {loading ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <Skeleton className="h-72 w-full" />
              <Skeleton className="h-72 w-full" />
            </div>
          ) : noData ? (
            <Card>
              <CardContent className="py-4">
                <EmptyState
                  icon={Receipt}
                  title="No approved expenses yet."
                  description="Once expenses are approved within the selected range, analytics and charts will appear here."
                />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <CategoryAnalytics summary={categorySummary} range={range} />
              <SubcategoryAnalytics summary={subcategorySummary} range={range} />
              <TrendCharts daily={daily} monthly={monthly} />
              <div className="grid gap-4 lg:grid-cols-2">
                <MarketingPanel
                  rows={rows}
                  categories={categories}
                  subcategories={subcategories}
                />
                <LossPanel rows={rows} categories={categories} subcategories={subcategories} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}