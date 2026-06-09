import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Megaphone } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/expenses";
import {
  buildCampaignSummary,
  buildCurrencySummary,
  buildMonthlyMarketing,
  buildPlatformSummary,
  formatBDT,
  type MarketingExpense,
  type MarketingPlatform,
} from "@/lib/marketing";
import { EmptyState } from "@/components/analytics/EmptyState";

const compact = (v: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v);

interface Props {
  rows: MarketingExpense[];
  platforms: MarketingPlatform[];
}

export function MarketingIntel({ rows, platforms }: Props) {
  const monthly = useMemo(() => buildMonthlyMarketing(rows), [rows]);
  const platform = useMemo(() => buildPlatformSummary(rows, platforms), [rows, platforms]);
  const campaigns = useMemo(() => buildCampaignSummary(rows, platforms).slice(0, 8), [rows, platforms]);
  const currencies = useMemo(() => buildCurrencySummary(rows), [rows]);

  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Marketing Cost Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState icon={Megaphone} title="No approved marketing spend in this range." />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Marketing Cost Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="trend">
          <TabsList className="flex-wrap">
            <TabsTrigger value="trend">Trend</TabsTrigger>
            <TabsTrigger value="platform">Platforms</TabsTrigger>
            <TabsTrigger value="campaign">Campaigns</TabsTrigger>
            <TabsTrigger value="currency">Currency Impact</TabsTrigger>
          </TabsList>

          <TabsContent value="trend" className="mt-4">
            <ChartContainer config={{}} className="h-[260px] w-full">
              <BarChart data={monthly} margin={{ left: 4, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.4} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={compact} tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatCurrency(Number(v))} hideLabel />} />
                <Bar dataKey="total" radius={4} fill="var(--brand-from)" />
              </BarChart>
            </ChartContainer>
          </TabsContent>

          <TabsContent value="platform" className="mt-4">
            <ul className="space-y-2">
              {platform.rows.map((p) => (
                <li key={p.id ?? "none"} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{p.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {p.count} item{p.count === 1 ? "" : "s"} · {p.currencies.join(", ")}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-semibold tabular-nums">{formatCurrency(p.total)}</span>
                    <span className="block text-xs text-muted-foreground tabular-nums">{p.percentage.toFixed(1)}%</span>
                  </span>
                </li>
              ))}
            </ul>
          </TabsContent>

          <TabsContent value="campaign" className="mt-4">
            <ul className="space-y-2">
              {campaigns.map((c, i) => (
                <li key={`${c.name}-${i}`} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{c.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{c.platformName}</span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(c.total)}</span>
                </li>
              ))}
            </ul>
          </TabsContent>

          <TabsContent value="currency" className="mt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Currency</th>
                    <th className="py-2 pr-3 text-right font-medium">Original</th>
                    <th className="py-2 pr-3 text-right font-medium">Avg Rate</th>
                    <th className="py-2 text-right font-medium">Converted (BDT)</th>
                  </tr>
                </thead>
                <tbody>
                  {currencies.map((c) => (
                    <tr key={c.currency} className="border-b border-border/60">
                      <td className="py-2 pr-3 font-medium">{c.currency}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {new Intl.NumberFormat("en-US", { minimumFractionDigits: 2 }).format(c.originalTotal)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{c.avgRate.toFixed(4)}</td>
                      <td className="py-2 text-right font-semibold tabular-nums">{formatBDT(c.convertedTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}