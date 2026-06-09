import { Bar, BarChart, CartesianGrid, Legend, XAxis, YAxis } from "recharts";
import { Scale } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/expenses";
import type { FixedVariablePoint, IntelTotals } from "@/lib/intelligence";
import { EmptyState } from "@/components/analytics/EmptyState";

const compact = (v: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v);

interface Props {
  totals: IntelTotals;
  series: FixedVariablePoint[];
}

export function FixedVsVariable({ totals, series }: Props) {
  const grand = totals.total;
  const fixedPct = grand > 0 ? (totals.fixed / grand) * 100 : 0;
  const variablePct = grand > 0 ? (totals.variable / grand) * 100 : 0;
  const hasData = series.some((p) => p.total > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Fixed vs Variable Cost</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs font-medium text-muted-foreground">Fixed Cost</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{formatCurrency(totals.fixed)}</p>
            <p className="text-xs text-muted-foreground">{fixedPct.toFixed(1)}% of expenses</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs font-medium text-muted-foreground">Variable Cost</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{formatCurrency(totals.variable)}</p>
            <p className="text-xs text-muted-foreground">{variablePct.toFixed(1)}% of expenses</p>
          </div>
        </div>

        {grand > 0 && (
          <div className="flex h-3 w-full overflow-hidden rounded-full">
            <span className="bg-chart-1" style={{ width: `${fixedPct}%` }} />
            <span className="bg-chart-3" style={{ width: `${variablePct}%` }} />
          </div>
        )}

        {hasData ? (
          <ChartContainer config={{}} className="h-[280px] w-full">
            <BarChart data={series} margin={{ left: 4, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.4} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={44}
                tickFormatter={compact}
                tick={{ fontSize: 11 }}
              />
              <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatCurrency(Number(v))} />} />
              <Legend />
              <Bar dataKey="fixed" name="Fixed" stackId="c" radius={[0, 0, 0, 0]} fill="var(--chart-1)" />
              <Bar dataKey="variable" name="Variable" stackId="c" radius={[4, 4, 0, 0]} fill="var(--chart-3)" />
            </BarChart>
          </ChartContainer>
        ) : (
          <EmptyState icon={Scale} title="No approved expenses to compare yet." />
        )}
      </CardContent>
    </Card>
  );
}