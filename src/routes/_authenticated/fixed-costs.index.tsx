import { createFileRoute } from "@/lib/router"
import { createFileRoute, Link } from "@/lib/router";
import { useEffect, useMemo, useState } from "react";
import {
  Repeat,
  Wallet,
  Clock,
  CheckCircle2,
  TrendingUp,
  FileBarChart,
  Settings as SettingsIcon,
  Search,
  X,
  type LucideIcon,
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
import { SettlementBadge } from "@/components/fixed-costs/SettlementBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { formatCurrency } from "@/lib/expenses";
import {
  fetchApprovedFixedCosts,
  fetchFixedCostRecords,
  fetchTemplates,
  buildMonthlyFixedCost,
  buildTopFixedCosts,
  fixedCostGrowth,
  sumAmount,
  settlementSummary,
  settlementOf,
  remainingOf,
  SETTLEMENT_STATUS,
  type SettlementStatus,
  type FixedCostRecord,
  type FixedCostTemplate,
} from "@/lib/fixed-costs";

export const Route = createFileRoute("/_authenticated/fixed-costs/")({
  head: () => ({ meta: [{ title: "Fixed Costs — Motion IT BD" }] }),
  component: FixedCostsOverview,
});

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const PAGE_SIZE = 10;
const ALL = "all";

function FixedCostsOverview() {
  const { canAccessModule, isAdmin } = useAuth();
  const [preset, setPreset] = useState<RangePreset>(DEFAULT_PRESET);
  const [range, setRange] = useState<DateRange>(resolveRange(DEFAULT_PRESET));
  const [approved, setApproved] = useState<FixedCostRecord[]>([]);
  const [list, setList] = useState<FixedCostRecord[]>([]);
  const [templates, setTemplates] = useState<FixedCostTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [monthFilter, setMonthFilter] = useState(ALL);
  const [page, setPage] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      fetchApprovedFixedCosts(range),
      fetchFixedCostRecords(),
      fetchTemplates(),
    ])
      .then(([a, l, t]) => {
        if (!active) return;
        setApproved(a);
        setList(l);
        setTemplates(t);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load fixed costs."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [range]);

  const templateName = useMemo(() => {
    const m = new Map(templates.map((t) => [t.id, t.name]));
    return (id: string | null) => (id ? m.get(id) ?? "Fixed Cost" : "Fixed Cost");
  }, [templates]);

  const monthly = useMemo(() => buildMonthlyFixedCost(approved), [approved]);
  const top = useMemo(() => buildTopFixedCosts(approved, templateName), [approved, templateName]);
  const growth = useMemo(() => fixedCostGrowth(monthly), [monthly]);
  const summary = useMemo(() => settlementSummary(list), [list]);
  const totalThisRange = sumAmount(approved);

  const months = useMemo(() => {
    const set = new Set<string>();
    for (const r of list) set.add((r.period_month ?? r.expense_date).slice(0, 7));
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [list]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((r) => {
      if (statusFilter !== ALL && settlementOf(r) !== statusFilter) return false;
      if (monthFilter !== ALL && (r.period_month ?? r.expense_date).slice(0, 7) !== monthFilter) return false;
      if (q) {
        const hay = `${r.expense_number} ${templateName(r.fixed_cost_template_id)} ${r.description ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [list, search, statusFilter, monthFilter, templateName]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const splitData = [
    { name: "Paid", total: summary.paidTotal },
    { name: "Outstanding", total: summary.outstandingTotal },
  ];

  if (!canAccessModule("fixed_costs")) {
    return (
      <div className="space-y-8">
        <PageHeader title="Fixed Costs" />
        <NoAccess />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fixed Cost Overview"
        description="Recurring monthly costs. Every total is approved spend in BDT."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/fixed-costs/reports">
                <FileBarChart className="h-4 w-4" />
                Reports
              </Link>
            </Button>
            {isAdmin && (
              <Button asChild>
                <Link to="/settings/fixed-costs">
                  <SettingsIcon className="h-4 w-4" />
                  Manage templates
                </Link>
              </Button>
            )}
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
            <MetricCard icon={Wallet} label="Fixed cost this month" value={formatCurrency(totalThisRange)} hint={`${approved.length} paid in range`} />
            <MetricCard icon={Clock} label="Outstanding" value={formatCurrency(summary.outstandingTotal)} hint={`${summary.generatedCount + summary.partialCount} unsettled`} />
            <MetricCard icon={CheckCircle2} label="Settled records" value={String(summary.paidCount)} hint={`${summary.partialCount} partially paid`} />
            <MetricCard
              icon={TrendingUp}
              label="Fixed cost growth"
              value={`${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%`}
              hint="Month over month"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Monthly fixed cost trend</CardTitle></CardHeader>
              <CardContent>
                {monthly.length === 0 ? (
                  <EmptyState icon={Repeat} title="No approved fixed costs" description="Approved fixed costs will chart here." />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={monthly} margin={{ left: 8, right: 8 }}>
                      <CartesianGrid vertical={false} strokeOpacity={0.15} />
                      <XAxis dataKey="label" fontSize={11} />
                      <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} fontSize={11} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Bar dataKey="total" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Paid vs outstanding</CardTitle></CardHeader>
              <CardContent>
                {summary.paidTotal === 0 && summary.outstandingTotal === 0 ? (
                  <EmptyState icon={CheckCircle2} title="Nothing to compare yet" description="Generate fixed costs to see the split." />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={splitData} margin={{ left: 8, right: 8 }}>
                      <CartesianGrid vertical={false} strokeOpacity={0.15} />
                      <XAxis dataKey="name" fontSize={11} />
                      <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} fontSize={11} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                        <Cell fill="var(--chart-2)" />
                        <Cell fill="var(--chart-4)" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {top.rows.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Top fixed costs</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(160, top.rows.slice(0, 8).length * 38)}>
                  <BarChart data={top.rows.slice(0, 8).map((t) => ({ name: t.name, total: t.total }))} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid horizontal={false} strokeOpacity={0.15} />
                    <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} fontSize={11} />
                    <YAxis type="category" dataKey="name" width={140} fontSize={11} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                      {top.rows.slice(0, 8).map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">All fixed cost records</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                    placeholder="Search number, name, description…"
                    className="pl-9"
                  />
                  {search && (
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={() => setSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Select value={monthFilter} onValueChange={(v) => { setMonthFilter(v); setPage(0); }}>
                  <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Month" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All months</SelectItem>
                    {months.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
                  <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All statuses</SelectItem>
                    {(Object.keys(SETTLEMENT_STATUS) as SettlementStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>{SETTLEMENT_STATUS[s].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {filtered.length === 0 ? (
                <div className="py-6">
                  <EmptyState icon={Repeat} title="No fixed cost records" description="Generate monthly records from Manage templates." />
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Number</TableHead>
                          <TableHead>Month</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">Paid</TableHead>
                          <TableHead className="text-right">Remaining</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pageRows.map((r) => (
                          <TableRow key={r.id} className="cursor-pointer">
                            <TableCell className="font-medium">
                              <Link to="/fixed-costs/$id" params={{ id: r.id }} className="hover:text-brand hover:underline">
                                {templateName(r.fixed_cost_template_id)}
                              </Link>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{r.expense_number}</TableCell>
                            <TableCell className="whitespace-nowrap">
                              {(r.period_month ?? r.expense_date).slice(0, 7)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{formatCurrency(r.amount)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatCurrency(r.fc_paid_amount)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatCurrency(remainingOf(r))}</TableCell>
                            <TableCell><SettlementBadge status={r.fc_settlement_status} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {filtered.length} record{filtered.length === 1 ? "" : "s"}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                        Previous
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Page {page + 1} of {totalPages}
                      </span>
                      <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: string; hint: string }) {
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
