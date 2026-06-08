import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowLeft, Layers } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/expenses";
import { formatRangeLabel, sumAmount, type DateRange } from "@/lib/analytics";
import { useApprovedExpenses, useTaxonomy } from "@/hooks/use-analytics";
import { ExpenseMiniTable } from "@/components/analytics/ExpenseMiniTable";
import { EmptyState } from "@/components/analytics/EmptyState";

export const Route = createFileRoute("/_authenticated/dashboard/subcategory/$id")({
  validateSearch: (s: Record<string, unknown>): DateRange => ({
    from: typeof s.from === "string" ? s.from : "",
    to: typeof s.to === "string" ? s.to : "",
  }),
  head: () => ({ meta: [{ title: "Subcategory Details — Motion IT BD" }] }),
  component: SubcategoryDetail,
});

function SubcategoryDetail() {
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
  const sub = subcategories.find((s) => s.id === id);
  const parent = categories.find((c) => c.id === sub?.category_id);

  const rows = useMemo(
    () => (expenses.data ?? []).filter((r) => r.subcategory_id === id),
    [expenses.data, id],
  );
  const total = sumAmount(rows);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit gap-1.5">
        <Link to="/" search={range as never}>
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
      </Button>

      <PageHeader
        title={sub?.name ?? "Subcategory"}
        description={`${parent?.name ?? "—"} · Approved expenses · ${formatRangeLabel(range)}`}
      />

      {loading ? (
        <Skeleton className="h-32 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No approved expenses in this subcategory."
          description="There is no approved spend for this subcategory in the selected range."
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card>
              <CardContent className="pt-6">
                <div className="text-xs text-muted-foreground">Total Amount</div>
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
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">All Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <ExpenseMiniTable rows={rows} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}