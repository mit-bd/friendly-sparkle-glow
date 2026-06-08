import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowLeft, FolderTree } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/expenses";
import {
  buildSubcategorySummary,
  formatRangeLabel,
  sumAmount,
  type DateRange,
} from "@/lib/analytics";
import { useApprovedExpenses, useTaxonomy } from "@/hooks/use-analytics";
import { ExpenseMiniTable } from "@/components/analytics/ExpenseMiniTable";
import { SubcategoryAnalytics } from "@/components/analytics/SubcategoryAnalytics";
import { EmptyState } from "@/components/analytics/EmptyState";

export const Route = createFileRoute("/_authenticated/dashboard/category/$id")({
  validateSearch: (s: Record<string, unknown>): DateRange => ({
    from: typeof s.from === "string" ? s.from : "",
    to: typeof s.to === "string" ? s.to : "",
  }),
  head: () => ({ meta: [{ title: "Category Details — Motion IT BD" }] }),
  component: CategoryDetail,
});

function CategoryDetail() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const range: DateRange = {
    from: search.from || new Date().toISOString().slice(0, 10),
    to: search.to || new Date().toISOString().slice(0, 10),
  };

  const taxonomy = useTaxonomy();
  const expenses = useApprovedExpenses(range);
  const loading = taxonomy.isLoading || expenses.isLoading;

  const categories = taxonomy.data?.categories ?? [];
  const subcategories = taxonomy.data?.subcategories ?? [];
  const category = categories.find((c) => c.id === id);

  const rows = useMemo(
    () => (expenses.data ?? []).filter((r) => r.category_id === id),
    [expenses.data, id],
  );
  const subSummary = useMemo(
    () => buildSubcategorySummary(rows, subcategories, categories),
    [rows, subcategories, categories],
  );
  const total = sumAmount(rows);
  const subName = useMemo(() => {
    const m = new Map(subcategories.map((s) => [s.id, s.name]));
    return (sid: string | null) => (sid ? m.get(sid) ?? "—" : "—");
  }, [subcategories]);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit gap-1.5">
        <Link to="/" search={range as never}>
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
      </Button>

      <PageHeader
        title={category?.name ?? "Category"}
        description={`Approved expenses · ${formatRangeLabel(range)}`}
      />

      {loading ? (
        <Skeleton className="h-32 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title="No approved expenses in this category."
          description="There is no approved spend for this category in the selected range."
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="text-xs text-muted-foreground">Total Expense</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">
                  {formatCurrency(total)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-xs text-muted-foreground">Expense Count</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">{rows.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-xs text-muted-foreground">Subcategories</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">
                  {subSummary.length}
                </div>
              </CardContent>
            </Card>
          </div>

          <SubcategoryAnalytics summary={subSummary} range={range} limit={20} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Expense List</CardTitle>
            </CardHeader>
            <CardContent>
              <ExpenseMiniTable rows={rows} subcategoryName={subName} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}