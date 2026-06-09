import { Area, AreaChart, CartesianGrid, Legend, XAxis, YAxis } from "recharts";
import { TrendingDown } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/expenses";
import type { CombinedMonthly } from "@/lib/loss";
import { EmptyState } from "@/components/analytics/EmptyState";

const compact = (v: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v);

interface Props {
  monthly: CombinedMonthly[];
  returnLoss: number;
  damageLoss: number;
}

export function LossImpact({ monthly, returnLoss, damageLoss }: Props) {
  const hasData = monthly.some((m) => m.total > 0);
  const total = returnLoss + damageLoss;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Return &amp; Damage Impact</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs font-medium text-muted-foreground">Return Loss</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{formatCurrency(returnLoss)}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs font-medium text-muted-foreground">Damage Loss</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{formatCurrency(damageLoss)}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs font-medium text-muted-foreground">Combined Loss</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{formatCurrency(total)}</p>
          </div>
        </div>

        {hasData ? (
          <ChartContainer config={{}} className="h-[280px] w-full">
            <AreaChart data={monthly} margin={{ left: 4, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="retFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="dmgFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-5)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--chart-5)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.4} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={compact} tick={{ fontSize: 11 }} />
              <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatCurrency(Number(v))} />} />
              <Legend />
              <Area dataKey="returns" name="Return Loss" type="monotone" stroke="var(--chart-3)" strokeWidth={2} fill="url(#retFill)" />
              <Area dataKey="damages" name="Damage Loss" type="monotone" stroke="var(--chart-5)" strokeWidth={2} fill="url(#dmgFill)" />
            </AreaChart>
          </ChartContainer>
        ) : (
          <EmptyState icon={TrendingDown} title="No approved returns or damages yet." />
        )}
      </CardContent>
    </Card>
  );
}