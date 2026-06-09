import { Link } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, Layers, Minus } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/expenses";
import { formatPct, type PerfRow } from "@/lib/intelligence";
import { EmptyState } from "@/components/analytics/EmptyState";

type Row = PerfRow & { categoryName: string };

interface Props {
  rows: Row[];
  range: { from: string; to: string };
}

function List({ rows, range }: Props) {
  const max = rows.reduce((m, r) => Math.max(m, r.total), 0);
  if (rows.length === 0)
    return <EmptyState icon={Layers} title="No subcategory spending in this range." />;
  return (
    <ul className="space-y-2">
      {rows.map((r) => {
        const up = r.growthPct > 0.05;
        const down = r.growthPct < -0.05;
        const tone = up ? "text-destructive" : down ? "text-success" : "text-muted-foreground";
        const Arrow = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
        const inner = (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{r.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{r.categoryName}</span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <span className={cn("flex items-center gap-0.5 text-xs font-medium", tone)}>
                  <Arrow className="h-3.5 w-3.5" />
                  {formatPct(r.growthPct)}
                </span>
                <span className="text-sm font-semibold tabular-nums">{formatCurrency(r.total)}</span>
              </span>
            </div>
            <Progress value={max > 0 ? (r.total / max) * 100 : 0} className="mt-1.5 h-1.5" />
          </>
        );
        return (
          <li key={r.id ?? "none"}>
            {r.id ? (
              <Link
                to="/dashboard/subcategory/$id"
                params={{ id: r.id }}
                search={{ from: range.from, to: range.to }}
                className="block rounded-md border border-border px-3 py-2 transition-colors hover:bg-accent"
              >
                {inner}
              </Link>
            ) : (
              <div className="rounded-md border border-border px-3 py-2">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function SubcategoryIntel({ rows, range }: Props) {
  const highest = [...rows].sort((a, b) => b.total - a.total).slice(0, 8);
  const growing = [...rows]
    .filter((r) => r.total > 0 && r.growthPct > 0)
    .sort((a, b) => b.growthPct - a.growthPct)
    .slice(0, 8);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Subcategory Analytics</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="highest">
          <TabsList>
            <TabsTrigger value="highest">Highest Spending</TabsTrigger>
            <TabsTrigger value="growing">Fastest Growing</TabsTrigger>
          </TabsList>
          <TabsContent value="highest" className="mt-4">
            <List rows={highest} range={range} />
          </TabsContent>
          <TabsContent value="growing" className="mt-4">
            <List rows={growing} range={range} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}