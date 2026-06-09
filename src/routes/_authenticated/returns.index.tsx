import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Undo2, TrendingDown, Coins, Wallet, ChevronRight, FileBarChart, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";
import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/analytics/EmptyState";
import { DateRangeFilter } from "@/components/analytics/DateRangeFilter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkActionBar } from "@/components/bulk/BulkActionBar";
import { BulkScopeMenu } from "@/components/bulk/BulkScopeMenu";
import { useBulkExport } from "@/hooks/use-bulk-export";
import type { BulkExportConfig, BulkScope } from "@/lib/bulk-export";
import { useAuth } from "@/lib/auth-context";
import { DEFAULT_PRESET, resolveRange, type DateRange, type RangePreset } from "@/lib/analytics";
import { fetchCategories, fetchUserNames, formatDate, type ExpenseCategory } from "@/lib/expenses";
import { fetchApprovedReturns, fetchReturnsList, fetchReturnReasons, buildReasonSummary, buildMonthly, returnTotals, formatTk, type ReturnRecord, type ReturnReason } from "@/lib/loss";
export const Route = createFileRoute("/_authenticated/returns/")({ head: () => ({ meta: [{ title: "Returns — Motion IT BD" }] }), component: ReturnsOverview });
const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
function ReturnsOverview() {
  const { canAccessModule, can, isAdmin, profile } = useAuth();
  const canExport = isAdmin || can("returns", "export");
  const [preset, setPreset] = useState<RangePreset>(DEFAULT_PRESET);
  const [range, setRange] = useState<DateRange>(resolveRange(DEFAULT_PRESET));
  const [approved, setApproved] = useState<ReturnRecord[]>([]);
  const [list, setList] = useState<ReturnRecord[]>([]);
  const [reasons, setReasons] = useState<ReturnReason[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true; setLoading(true);
    Promise.all([fetchApprovedReturns(range), fetchReturnsList(), fetchReturnReasons(true), fetchCategories(true)])
      .then(async ([a, l, rs, cats]) => {
        if (!active) return;
        setApproved(a); setList(l); setReasons(rs); setCategories(cats);
        const map = await fetchUserNames(l.map((r) => r.created_by ?? "").filter(Boolean));
        if (active) setNames(map);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load returns."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [range]);
  const totals = useMemo(() => returnTotals(approved), [approved]);
  const reasonSummary = useMemo(() => buildReasonSummary(approved, reasons), [approved, reasons]);
  const monthly = useMemo(() => buildMonthly(approved, (r) => r.return_date, (r) => r.net_loss_amount), [approved]);
  const reasonMap = useMemo(() => new Map(reasons.map((r) => [r.id, r.name])), [reasons]);
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const bulkConfig = useMemo<BulkExportConfig<ReturnRecord>>(() => ({
    module: "returns", moduleLabel: "Returns", documentTitle: "Bulk Return Report",
    fileBase: "motion-it-bd-returns", numberPrefix: "RET", recordLabel: (r) => r.return_number,
    fields: [
      { label: "Category", value: (r) => (r.category_id ? catMap.get(r.category_id) ?? "—" : "—") },
      { label: "Reason", value: (r) => (r.reason_id ? reasonMap.get(r.reason_id) ?? "—" : "—") },
      { label: "Product", value: (r) => r.product_name || "—" },
      { label: "Amount", value: (r) => formatTk(r.net_loss_amount) },
      { label: "Date", value: (r) => formatDate(r.return_date) },
      { label: "Status", value: (r) => r.status },
      { label: "Created By", value: (r) => (r.created_by ? names[r.created_by] ?? "—" : "—") },
    ],
  }), [catMap, reasonMap, names]);
  const bulk = useBulkExport<ReturnRecord>({
    config: bulkConfig, getId: (r) => r.id,
    generatedBy: profile?.full_name?.trim() || profile?.email || "—", canExport,
  });
  const runBulk = (scope: BulkScope, kind: "print" | "pdf" | "csv") => {
    const rows = scope === "selected" ? list.filter((r) => bulk.selection.isSelected(r.id)) : list;
    if (kind === "print") bulk.runPrint(rows, scope);
    else if (kind === "pdf") bulk.runPdf(rows, scope);
    else bulk.runCsv(rows, scope);
  };
  const pageAllSelected = list.length > 0 && list.every((r) => bulk.selection.isSelected(r.id));
  if (!canAccessModule("returns")) return (<div className="space-y-8"><PageHeader title="Returns" /><NoAccess /></div>);
  return (
    <div className="space-y-6">
      <PageHeader title="Returns" description="Track returned goods and net return loss. Only approved returns count toward loss totals." actions={
        <div className="flex flex-wrap gap-2">
          {canExport && <BulkScopeMenu busy={bulk.busy} onAction={runBulk} />}
          <Button variant="outline" asChild><Link to="/returns/pending"><ClipboardList className="h-4 w-4" />Pending</Link></Button>
          <Button variant="outline" asChild><Link to="/returns/reports"><FileBarChart className="h-4 w-4" />Reports</Link></Button>
          <Button asChild><Link to="/returns/add"><Plus className="h-4 w-4" />Add return</Link></Button>
        </div>} />
      <DateRangeFilter preset={preset} range={range} onChange={(p, r) => { setPreset(p); setRange(r); }} />
      {loading ? (<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-28 rounded-lg" />))}</div>) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard icon={Undo2} label="Total returns" value={String(totals.count)} hint="Approved in range" />
            <MetricCard icon={TrendingDown} label="Total return loss" value={formatTk(totals.loss)} hint="Gross loss" />
            <MetricCard icon={Wallet} label="Recoverable amount" value={formatTk(totals.recoverable)} hint="Expected recovery" />
            <MetricCard icon={Coins} label="Net return loss" value={formatTk(totals.netLoss)} hint="Loss - recoverable" />
          </div>
          {approved.length === 0 ? (<EmptyState icon={Undo2} title="No approved returns in this range" description="Returns appear in analytics only after they are approved." />) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card><CardHeader><CardTitle className="text-base">Top return reasons (net loss)</CardTitle></CardHeader><CardContent>
                <ResponsiveContainer width="100%" height={280}><BarChart data={reasonSummary.rows.slice(0, 8).map((r) => ({ name: r.name, total: r.netLoss }))} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid horizontal={false} strokeOpacity={0.15} /><XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} fontSize={11} /><YAxis type="category" dataKey="name" width={120} fontSize={11} /><Tooltip formatter={(v: number) => formatTk(v)} />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]}>{reasonSummary.rows.slice(0, 8).map((_, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}</Bar></BarChart></ResponsiveContainer></CardContent></Card>
              <Card><CardHeader><CardTitle className="text-base">Monthly net return loss</CardTitle></CardHeader><CardContent>
                <ResponsiveContainer width="100%" height={280}><BarChart data={monthly} margin={{ left: 8, right: 8 }}><CartesianGrid vertical={false} strokeOpacity={0.15} /><XAxis dataKey="label" fontSize={11} /><YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} fontSize={11} /><Tooltip formatter={(v: number) => formatTk(v)} /><Bar dataKey="total" fill="var(--chart-1)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></CardContent></Card>
            </div>)}
          {approved.length > 0 && (
            <Card><CardHeader><CardTitle className="text-base">Return reason breakdown</CardTitle></CardHeader><CardContent className="p-0">
              <Table><TableHeader><TableRow><TableHead>Reason</TableHead><TableHead className="text-right">Count</TableHead><TableHead className="text-right">Loss</TableHead><TableHead className="text-right">Recoverable</TableHead><TableHead className="text-right">Net loss</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
                <TableBody>{reasonSummary.rows.map((r) => (<TableRow key={r.id ?? "none"} className="group">
                  <TableCell className="font-medium">{r.id ? (<Link to="/returns/reason/$id" params={{ id: r.id }} search={{ from: range.from, to: range.to }} className="hover:text-brand-to hover:underline">{r.name}</Link>) : r.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.count}</TableCell><TableCell className="text-right tabular-nums">{formatTk(r.loss)}</TableCell><TableCell className="text-right tabular-nums">{formatTk(r.recoverable)}</TableCell><TableCell className="text-right font-medium tabular-nums">{formatTk(r.netLoss)}</TableCell>
                  <TableCell>{r.id && (<ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />)}</TableCell></TableRow>))}</TableBody></Table></CardContent></Card>)}
          <Card><CardHeader><CardTitle className="text-base">All returns</CardTitle></CardHeader><CardContent className="p-0">
            {list.length === 0 ? (<div className="p-6"><EmptyState icon={Undo2} title="No returns yet" description="Create your first return record." /></div>) : (
              <Table><TableHeader><TableRow><TableHead className="w-10"><Checkbox checked={pageAllSelected} onCheckedChange={() => pageAllSelected ? bulk.selection.removeMany(list) : bulk.selection.addMany(list)} aria-label="Select all returns" /></TableHead><TableHead>Return No.</TableHead><TableHead>Date</TableHead><TableHead>Product</TableHead><TableHead className="text-right">Net loss</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{list.map((r) => (<TableRow key={r.id}><TableCell><Checkbox checked={bulk.selection.isSelected(r.id)} onCheckedChange={() => bulk.selection.toggle(r.id)} aria-label={`Select ${r.return_number}`} /></TableCell><TableCell className="font-medium"><Link to="/returns/$id" params={{ id: r.id }} className="hover:text-brand-to hover:underline">{r.return_number}</Link></TableCell><TableCell className="whitespace-nowrap">{formatDate(r.return_date)}</TableCell><TableCell className="max-w-[200px] truncate">{r.product_name || "—"}</TableCell><TableCell className="text-right tabular-nums">{formatTk(r.net_loss_amount)}</TableCell><TableCell><StatusBadge status={r.status} /></TableCell></TableRow>))}</TableBody></Table>)}</CardContent></Card>
        </>)}
      <BulkActionBar count={bulk.selection.count} canExport={canExport} busy={bulk.busy} onClear={bulk.selection.clear} onPrint={() => runBulk("selected", "print")} onPdf={() => runBulk("selected", "pdf")} onCsv={() => runBulk("selected", "csv")} />
      {bulk.printNode}
    </div>);
}
function MetricCard({ icon: Icon, label, value, hint }: { icon: typeof Undo2; label: string; value: string; hint: string }) {
  return (<Card><CardContent className="p-5"><div className="flex items-center justify-between"><p className="text-xs font-medium text-muted-foreground">{label}</p><span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-gradient-soft text-brand"><Icon className="h-4 w-4" /></span></div><p className="mt-3 text-2xl font-semibold tabular-nums text-foreground">{value}</p><p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p></CardContent></Card>);
}
