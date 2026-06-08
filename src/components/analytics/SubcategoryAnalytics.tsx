import { Link } from "@tanstack/react-router";
import { Layers } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/expenses";
import type { DateRange, SubcategorySummary } from "@/lib/analytics";
import { EmptyState } from "./EmptyState";

interface Props {
  summary: SubcategorySummary[];
  range: DateRange;
  limit?: number;
}

export function SubcategoryAnalytics({ summary, range, limit = 10 }: Props) {
  const top = summary.filter((s) => s.total > 0).slice(0, limit);
  const search = { from: range.from, to: range.to };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top Subcategories by Spending</CardTitle>
      </CardHeader>
      <CardContent>
        {top.length === 0 ? (
          <EmptyState icon={Layers} title="No data for selected date range." />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {top.map((s) => {
              const inner = (
                <>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{s.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {s.categoryName} · {s.count} item{s.count === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold tabular-nums">
                      {formatCurrency(s.total)}
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      {s.percentage.toFixed(1)}%
                    </div>
                  </div>
                </>
              );
              return s.id ? (
                <Link
                  key={s.id}
                  to="/dashboard/subcategory/$id"
                  params={{ id: s.id }}
                  search={search}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2.5 transition-colors hover:bg-accent"
                >
                  {inner}
                </Link>
              ) : (
                <div
                  key="none"
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2.5"
                >
                  {inner}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}