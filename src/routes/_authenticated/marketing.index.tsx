import { createFileRoute } from '@tanstack/react-router'
import { createFileRoute, Link } from "@/lib/router";
import { useEffect, useMemo, useState } from "react";
import {
  Megaphone,
  Plus,
  TrendingUp,
  Layers,
  Coins,
  ChevronRight,
  FileBarChart,
} from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { EmptyState } from "@/components/analytics/EmptyState";
import { DateRangeFilter } from "@/components/analytics/DateRangeFilter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/StatusBadge";
import { BulkActionBar } from "@/components/bulk/BulkActionBar";
import { BulkScopeMenu } from "@/components/bulk/BulkScopeMenu";
import { useBulkExport } from "@/hooks/use-bulk-export";
import type { BulkExportConfig, BulkScope } from "@/lib/bulk-export";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { DEFAULT_PRESET, resolveRange, type DateRange, type RangePreset } from "@/lib/analytics";
import { fetchUserNames, formatDate } from "@/lib/expenses";
import {
  fetchApprovedMarketing,
  fetchMarketingList,
  fetchPlatforms,
  buildPlatformSummary,
  buildMonthlyMarketing,
  buildCurrencySummary,
  formatBDT,
  type MarketingExpense,
  type MarketingPlatform,
} from "@/lib/marketing";

export const Route = createFileRoute("/_authenticated/marketing/")({
  head: () => ({ meta: [{ title: "Marketing Overview — Motion IT BD" }] }),
  component: MarketingOverview,
});

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function MarketingOverview() {
  const { canAccessModule, can, isAdmin, profile } = useAuth();
  const canExport = isAdmin || can("marketing", "export");
  const [preset, setPreset] = useState<RangePreset>(DEFAULT_PRESET);
  const [range, setRange] = useState<DateRange>(resolveRange(DEFAULT_PRESET));
  const [rows, setRows] = useState<MarketingExpense[]>([]);
  const [platforms, setPlatforms] = useState<MarketingPlatform[]>([]);
  const [list, setList] = useState<MarketingExpense[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([fetchApprovedMarketing(range), fetchPlatforms(true), fetchMarketingList()])
      .then(async ([r, p, l]) => {
        if (!active) return;
        setRows(r);
        setPlatforms(p);
        setList(l);
        const map = await fetchUserNames(l.map((x) => x.created_by ?? "").filter(Boolean));
        if (active) setNames(map);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load marketing data."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [range]);

  const platformSummary = useMemo(() => buildPlatformSummary(rows, platforms), [rows, platforms]);
  const monthly = useMemo(() => buildMonthlyMarketing(rows), [rows]);
  const currencies = useMemo(() => buildCurrencySummary(rows), [rows]);
  const total = platformSummary.grandTotal;
  const topPlatform = platformSummary.rows[0];

  const platformMap = useMemo(() => new Map(platforms.map((p) => [p.id, p.name])), [platforms]);
  const bulkConfig = useMemo<BulkExportConfig<MarketingExpense>>(() => ({
    module: "marketing", moduleLabel: "Marketing", documentTitle: "Bulk Marketing Cost Report",
    fileBase: "motion-it-bd-marketing", numberPrefix: "MKT", recordLabel: (r) => r.expense_number,
    fields: [
      { label: "Platform", value: (r) => (r.platform_id ? platformMap.get(r.platform_id) ?? "—" : "—") },
      { label: "Campaign", value: (r) => r.campaign_name || "—" },
      { label: "Amount (BDT)", value: (r) => formatBDT(r.amount) },
      { label: "Original", value: (r) => (r.original_amount != null ? `${r.original_amount} ${r.currency}` : "—") },
      { label: "Date", value: (r) => formatDate(r.expense_date) },
      { label: "Status", value: (r) => r.status },
      { label: "Created By", value: (r) => (r.created_by ? names[r.created_by] ?? "—" : "—") },
    ],
  }), [platformMap, names]);
  const bulk = useBulkExport<MarketingExpense>({
    config: bulkConfig, getId: (r) => r.id,
    generatedBy: profile?.full_name?.trim() || profile?.email || "—", canExport,
  });
  const runBulk = (scope: BulkScope, kind: "print" | "pdf" | "csv") => {
    const sel = scope === "selected" ? list.filter((r) => bulk.selection.isSelected(r.id)) : list;
    if (kind === "print") bulk.runPrint(sel, scope);
    else if (kind === "pdf") bulk.runPdf(sel, scope);
    else bulk.runCsv(sel, scope);
  };
  const listAllSelected = list.length > 0 && list.every((r) => bulk.selection.isSelected(r.id));

  if (!canAccessModule("marketing")) {
    return (
      <div className="space-y-8">
        <PageHeader title="Marketing" />
        <NoAccess />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketing Cost Overview"
        description="Approved marketing spend across platforms — every total is in BDT (converted)."
        actions={
          <div className="flex flex-wrap gap-2">
            {canExport && <BulkScopeMenu busy={bulk.busy} onAction={runBulk} />}
            <Button variant="outline" asChild>
              <Link to="/marketing/reports">
                <FileBarChart className="h-4 w-4" />
                Reports
              </Link>
            </Button>
            <Button asChild>
              <Link to="/marketing/add">
                <Plus className="h-4 w-4" />
                Add marketing cost
              </Link>
            </Button>
          </div>
        }
      />

      <DateRangeFilter preset={preset} range={range} onChange={(p, r) => { setPreset(p); setRange(r); }} />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              icon={TrendingUp}
              label="Total marketing cost"
              value={formatBDT(total)}
              hint={`${rows.length} approved cost${rows.length === 1 ? "" : "s"}`}
            />
            <MetricCard
              icon={Layers}
              label="Active platforms"
              value={String(platformSummary.rows.length)}
              hint={topPlatform ? `Top: ${topPlatform.name}` : "—"}
            />
            <MetricCard
              icon={Megaphone}
              label="Top platform spend"
              value={topPlatform ? formatBDT(topPlatform.total) : formatBDT(0)}
              hint={topPlatform ? `${topPlatform.percentage.toFixed(1)}% of total` : "—"}
            />
            <MetricCard
              icon={Coins}
              label="Currencies used"
              value={String(currencies.length)}
              hint={currencies.map((c) => c.currency).join(", ") || "—"}
            />
          </div>

          {rows.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="No approved marketing costs in this range"
              description="Marketing costs appear here only after they are approved."
            />
          ) : (
            <>
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Top spending platforms</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart
                        data={platformSummary.rows.slice(0, 8).map((p) => ({ name: p.name, total: p.total }))}
                        layout="vertical"
                        margin={{ left: 8, right: 16 }}
                      >
                        <CartesianGrid horizontal={false} strokeOpacity={0.15} />
                        <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} fontSize={11} />
                        <YAxis type="category" dataKey="name" width={120} fontSize={11} />
                        <Tooltip formatter={(v: number) => formatBDT(v)} />
                        <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                          {platformSummary.rows.slice(0, 8).map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Monthly marketing cost</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={monthly} margin={{ left: 8, right: 8 }}>
                        <CartesianGrid vertical={false} strokeOpacity={0.15} />
                        <XAxis dataKey="label" fontSize={11} />
                        <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} fontSize={11} />
                        <Tooltip formatter={(v: number) => formatBDT(v)} />
                        <Bar dataKey="total" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Platform breakdown</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Platform</TableHead>
                        <TableHead>Currencies</TableHead>
                        <TableHead className="text-right">Costs</TableHead>
                        <TableHead className="text-right">Converted BDT</TableHead>
                        <TableHead className="text-right">% of total</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {platformSummary.rows.map((p) => (
                        <TableRow key={p.id ?? "none"} className="group">
                          <TableCell className="font-medium">
                            {p.id ? (
                              <Link
                                to="/marketing/platform/$id"
                                params={{ id: p.id }}
                                search={{ from: range.from, to: range.to }}
                                className="hover:text-brand-to hover:underline"
                              >
                                {p.name}
                              </Link>
                            ) : (
                              p.name
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {p.currencies.map((c) => (
                                <Badge key={c} variant="secondary" className="text-[10px]">
                                  {c}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{p.count}</TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatBDT(p.total)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {p.percentage.toFixed(1)}%
                          </TableCell>
                          <TableCell>
                            {p.id && (
                              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">All marketing costs</CardTitle></CardHeader>
            <CardContent className="p-0">
              {list.length === 0 ? (
                <div className="p-6">
                  <EmptyState icon={Megaphone} title="No marketing costs yet" description="Record your first marketing cost." />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={listAllSelected}
                          onCheckedChange={() => listAllSelected ? bulk.selection.removeMany(list) : bulk.selection.addMany(list)}
                          aria-label="Select all marketing costs"
                        />
                      </TableHead>
                      <TableHead>Cost No.</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>Campaign</TableHead>
                      <TableHead className="text-right">Amount (BDT)</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Checkbox
                            checked={bulk.selection.isSelected(r.id)}
                            onCheckedChange={() => bulk.selection.toggle(r.id)}
                            aria-label={`Select ${r.expense_number}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{r.expense_number}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(r.expense_date)}</TableCell>
                        <TableCell>{r.platform_id ? platformMap.get(r.platform_id) ?? "—" : "—"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{r.campaign_name || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatBDT(r.amount)}</TableCell>
                        <TableCell><StatusBadge status={r.status as never} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <BulkActionBar
        count={bulk.selection.count}
        canExport={canExport}
        busy={bulk.busy}
        onClear={bulk.selection.clear}
        onPrint={() => runBulk("selected", "print")}
        onPdf={() => runBulk("selected", "pdf")}
        onCsv={() => runBulk("selected", "csv")}
      />
      {bulk.printNode}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-gradient-soft text-brand">
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <p className="mt-3 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
