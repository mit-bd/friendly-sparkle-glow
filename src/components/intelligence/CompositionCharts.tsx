import { useState } from "react";
import { Link } from "@/lib/router";
import { Cell, Pie, PieChart } from "recharts";
import { PieChart as PieIcon, ArrowRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/expenses";
import type { CompositionSlice } from "@/lib/intelligence";
import { EmptyState } from "@/components/analytics/EmptyState";

const DRILL: Record<string, string> = {
  fixed: "/fixed-costs",
  marketing: "/marketing",
  product: "/expenses",
  other: "/expenses",
  returnLoss: "/returns",
  damageLoss: "/damages",
};

interface Props {
  slices: CompositionSlice[];
}

export function CompositionCharts({ slices }: Props) {
  const [active, setActive] = useState<string | null>(null);
  const selected = slices.find((s) => s.key === active) ?? null;

  if (slices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Expense Composition</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState icon={PieIcon} title="No approved outflow in this range." />
        </CardContent>
      </Card>
    );
  }

  const renderChart = (inner: number) => (
    <ChartContainer config={{}} className="mx-auto aspect-square h-[260px]">
      <PieChart>
        <Pie
          data={slices}
          dataKey="value"
          nameKey="name"
          innerRadius={inner}
          outerRadius={104}
          paddingAngle={2}
          onClick={(_, i) => setActive(slices[i].key)}
        >
          {slices.map((s) => (
            <Cell
              key={s.key}
              fill={s.color}
              stroke="var(--background)"
              strokeWidth={2}
              opacity={active && active !== s.key ? 0.4 : 1}
              className="cursor-pointer transition-opacity"
            />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Expense Composition</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        <Tabs defaultValue="donut">
          <TabsList>
            <TabsTrigger value="donut">Donut</TabsTrigger>
            <TabsTrigger value="pie">Pie</TabsTrigger>
          </TabsList>
          <TabsContent value="donut" className="mt-4">
            {renderChart(62)}
          </TabsContent>
          <TabsContent value="pie" className="mt-4">
            {renderChart(0)}
          </TabsContent>
        </Tabs>

        <div className="space-y-2">
          {slices.map((s) => (
            <button
              key={s.key}
              onClick={() => setActive(active === s.key ? null : s.key)}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors",
                active === s.key ? "border-brand bg-accent" : "border-border hover:bg-accent/50",
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: s.color }} />
                <span className="truncate text-sm font-medium">{s.name}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="text-sm font-semibold tabular-nums">{formatCurrency(s.value)}</span>
                <span className="ml-2 text-xs text-muted-foreground tabular-nums">
                  {s.percentage.toFixed(1)}%
                </span>
              </span>
            </button>
          ))}

          {selected && (
            <Link
              to={DRILL[selected.key] ?? "/expenses"}
              className="mt-2 flex items-center justify-between gap-2 rounded-md bg-brand-gradient px-3 py-2 text-sm font-medium text-primary-foreground"
            >
              <span>Drill into {selected.name}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}