import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Line, LineChart } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/expenses";
import { formatPct, type Granularity, type MetricTrend } from "@/lib/intelligence";

const OPTIONS: { value: Granularity; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

interface Props {
  trends: MetricTrend[];
  granularity: Granularity;
  onGranularity: (g: Granularity) => void;
}

export function MomTrends({ trends, granularity, onGranularity }: Props) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Period-over-Period Analysis</CardTitle>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
          {OPTIONS.map((o) => (
            <Button
              key={o.value}
              size="sm"
              variant={granularity === o.value ? "default" : "ghost"}
              className={cn(
                "h-7 px-2.5 text-xs",
                granularity === o.value && "bg-brand-gradient text-primary-foreground",
              )}
              onClick={() => onGranularity(o.value)}
            >
              {o.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {trends.map((t) => {
          const bad = t.direction === "up";
          const good = t.direction === "down";
          const tone = bad ? "text-destructive" : good ? "text-success" : "text-muted-foreground";
          const Arrow =
            t.direction === "up" ? ArrowUpRight : t.direction === "down" ? ArrowDownRight : Minus;
          return (
            <div key={t.key} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">{t.label}</p>
                <span className={cn("flex items-center gap-0.5 text-xs font-semibold", tone)}>
                  <Arrow className="h-3.5 w-3.5" />
                  {formatPct(t.changePct)}
                </span>
              </div>
              <p className="mt-1 text-lg font-semibold tabular-nums">{formatCurrency(t.current)}</p>
              {t.points.length > 1 ? (
                <ChartContainer config={{}} className="mt-1 h-10 w-full">
                  <LineChart data={t.points} margin={{ top: 2, bottom: 2, left: 2, right: 2 }}>
                    <Line
                      dataKey="value"
                      type="monotone"
                      stroke={bad ? "var(--destructive)" : "var(--brand-from)"}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ChartContainer>
              ) : (
                <p className="mt-2 text-[11px] text-muted-foreground">Not enough history</p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}