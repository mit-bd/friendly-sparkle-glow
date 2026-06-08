import { Link } from "@tanstack/react-router";
import { ChevronRight, PieChart as PieIcon } from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/expenses";
import type { CategorySummary, DateRange } from "@/lib/analytics";
import { EmptyState } from "./EmptyState";

const BAR_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

interface Props {
  summary: CategorySummary[];
  range: DateRange;
}

export function CategoryAnalytics({ summary, range }: Props) {
  const top10 = summary.filter((s) => s.total > 0).slice(0, 10);
  const search = { from: range.from, to: range.to };

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-base">Category Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.length === 0 ? (
            <EmptyState icon={PieIcon} title="No data for selected date range." />
          ) : (
            <div className="space-y-2">
              {summary.map((c) => {
                const row = (
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">{c.name}</span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">
                          {formatCurrency(c.total)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-brand-gradient"
                            style={{ width: `${Math.max(c.percentage, 1.5)}%` }}
                          />
                        </div>
                        <span className="w-20 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                          {c.percentage.toFixed(1)}% · {c.count}
                        </span>
                      </div>
                    </div>
                    {c.id && (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                  </div>
                );
                return c.id ? (
                  <Link
                    key={c.id}
                    to="/dashboard/category/$id"
                    params={{ id: c.id }}
                    search={search}
                    className="block rounded-md px-2 py-2 transition-colors hover:bg-accent"
                  >
                    {row}
                  </Link>
                ) : (
                  <div key="uncat" className="rounded-md px-2 py-2">
                    {row}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Top Spending Categories</CardTitle>
        </CardHeader>
        <CardContent>
          {top10.length === 0 ? (
            <EmptyState icon={PieIcon} title="No approved expenses yet." />
          ) : (
            <ChartContainer config={{}} className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top10} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(v) => formatCurrency(Number(v))}
                        hideLabel
                      />
                    }
                  />
                  <Bar dataKey="total" radius={4}>
                    {top10.map((_, i) => (
                      <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}