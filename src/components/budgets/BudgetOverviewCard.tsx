import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Wallet, ArrowRight, AlertTriangle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BudgetStatusBadge, BudgetUtilizationBar } from "@/components/budgets/BudgetStatusBadge";
import { useAuth } from "@/lib/auth-context";
import {
  evaluateAll,
  fetchBudgetDataset,
  fetchBudgets,
  formatTk,
  summarise,
  type Budget,
} from "@/lib/budgets";

/**
 * Compact, read-only budget overview surfaced on the main dashboard and the
 * Executive Intelligence layer. Approved records only (handled inside the
 * budgets evaluation engine). Renders nothing when the user has no budgets
 * access or when no active budgets exist.
 */
export function BudgetOverviewCard({ limit = 5, title = "Budget control" }: { limit?: number; title?: string }) {
  const { canAccessModule } = useAuth();
  const hasAccess = canAccessModule("budgets");

  const query = useQuery({
    queryKey: ["budget-overview"],
    enabled: hasAccess,
    staleTime: 60_000,
    queryFn: async () => {
      const all = await fetchBudgets();
      const active = all.filter((b: Budget) => b.is_active);
      const data = await fetchBudgetDataset(active);
      return { active, data };
    },
  });

  const evals = useMemo(
    () => (query.data ? evaluateAll(query.data.active, query.data.data) : []),
    [query.data],
  );
  const summary = useMemo(() => summarise(evals), [evals]);
  const top = useMemo(
    () => [...evals].sort((a, b) => b.utilization - a.utilization).slice(0, limit),
    [evals, limit],
  );

  if (!hasAccess) return null;
  if (query.isLoading) return <Skeleton className="h-64 w-full rounded-lg" />;
  if (!query.data || query.data.active.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4 text-brand" />
          {title}
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/budgets">
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total budget" value={formatTk(summary.totalBudget)} />
          <Stat label="Approved spend" value={formatTk(summary.totalUsed)} />
          <Stat
            label="Remaining"
            value={formatTk(summary.totalRemaining)}
            tone={summary.totalRemaining < 0 ? "negative" : "neutral"}
          />
          <Stat
            label="Over budget"
            value={String(summary.overBudgetCount)}
            tone={summary.overBudgetCount > 0 ? "negative" : "neutral"}
          />
        </div>

        {summary.overBudgetCount + summary.warningCount > 0 && (
          <div className="flex items-center gap-2 rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {summary.overBudgetCount} exceeded · {summary.warningCount} approaching limit
          </div>
        )}

        <ul className="space-y-3">
          {top.map((e) => (
            <li key={e.budget.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                <Link
                  to="/budgets/$id"
                  params={{ id: e.budget.id }}
                  className="truncate font-medium hover:text-brand"
                >
                  {e.budget.name}
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="tabular-nums text-xs text-muted-foreground">
                    {e.utilization.toFixed(0)}%
                  </span>
                  <BudgetStatusBadge status={e.status} />
                </div>
              </div>
              <BudgetUtilizationBar utilization={e.utilization} status={e.status} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "negative" }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-base font-semibold tabular-nums ${tone === "negative" ? "text-destructive" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}
