import { createFileRoute } from "@/lib/router"
import { createFileRoute, Link } from "@/lib/router";
import { useEffect, useMemo, useState } from "react";
import { Plus, PackageX, TrendingDown, Layers, ChevronRight, FileBarChart, ClipboardList } from "lucide-react";
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
import { fetchUserNames, formatDate } from "@/lib/expenses";
import { fetchApprovedDamages, fetchDamagesList, fetchDamageTypes, buildTypeSummary, buildMonthly, sumBy, formatTk, type DamageRecord, type DamageType } from "@/lib/loss";
export const Route = createFileRoute("/_authenticated/damages/")({ head: () => ({ meta: [{ title: "Damages — Motion IT BD" }] }), component: DamagesOverview });
const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
function DamagesOverview() {
  const { canAccessModule, can, isAdmin, profile } = useAuth();
  const canExport = isAdmin || can("damages", "export");
  const [preset, setPreset] = useState<RangePreset>(DEFAULT_PRESET);
  const [range, setRange] = useState<DateRange>(resolveRange(DEFAULT_PRESET));
  const [approved, setApproved] = useState<DamageRecord[]>([]);
  const [list, setList] = useState<DamageRecord[]>([]);
  const [types, setTypes] = useState<DamageType[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true; setLoading(true);
    Promise.all([fetchApprovedDamages(range), fetchDamagesList(), fetchDamageTypes(true)])
      .then(async ([a, l, t]) => {
        if (!active) return;
        setApproved(a); setList(l); setTypes(t);
        const map = await fetchUserNames(l.map((r) => r.created_by ?? "").filter(Boolean));
        if (active) setNames(map);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load damages."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [range]);
  const totalValue = useMemo(() => sumBy(approved, (r) => r.damage_value), [approved]);
  const typeSummary = useMemo(() => buildTypeSummary(approved, types), [approved, types]);
  const monthly = useMemo(() => buildMonthly(approved, (r) => r.damage_date, (r) => r.damage_value), [approved]);
  const typeMap = useMemo(() => new Map(types.map((t) => [t.id, t.name])), [types]);
  const bulkConfig = useMemo<BulkExportConfig<DamageRecord>>(() => ({
    module: "damages", moduleLabel: "Damages", documentTitle: "Bulk Damage Report",
    fileBase: "motion-it-bd-damages", numberPrefix: "DMG", recordLabel: (r) => r.damage_number,
    fields: [
      { label: "Type", value: (r) => (r.type_id ? typeMap.get(r.type_id) ?? "—" : "—") },
      { label: "Product", value: (r) => r.product_name || "—" },
      { label: "Quantity", value: (r) => String(r.quantity) },
      { label: "Amount", value: (r) => formatTk(r.damage_value) },
      { label: "Date", value: (r) => formatDate(r.damage_date) },
      { label: "Status", value: (r) => r.status },
      { label: "Created By", value: (r) => (r.created_by ? names[r.created_by] ?? "—" : "—") },
    ],
  }), [typeMap, names]);
  const bulk = useBulkExport<DamageRecord>({
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
  if (!canAccessModule("damages")) return (<div className="space-y-8"><PageHeader title="Damages" /><NoAccess /></div>);
  return (
    <div className="space-y-6">
      <PageHeader title="Damages" description="Record damaged inventory and write-offs. Only approved damages count toward loss totals." actions={
        <div className="flex flex-wrap gap-2">
          {canExport && <BulkScopeMenu busy={bulk.busy} onAction={runBulk} />}
          <Button variant="outline" asChild><Link to="/damages/pending"><ClipboardList className="h-4 w-4" />Pending</Link></Button>
          <Button variant="outline" asChild><Link to="/damages/reports"><FileBarChart className="h-4 w-4" />Reports</Link></Button>
          <Button asChild><Link to="/damages/add"><Plus className="h-4 w-4" />Add damage</Link></Button>
        </div>} />
      <DateRangeFilter preset={preset} range={range} onChange={(p, r) => { setPreset(p); setRange(r); }} />
      {loading ? (<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => (<Skeleton key={i} className="h-28 rounded-lg" />))}</div>) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard icon={PackageX} label="Total damages" value={String(approved.length)} hint="Approved in range" />
            <MetricCard icon={TrendingDown} label="Damage value" value={formatTk(totalValue)} hint="Total write-off" />
            <MetricCard icon={Layers} label="Damage types" value={String(typeSummary.rows.length)} hint={typeSummary.rows[0] ? `Top: ${typeSummary.rows[0].name}` : "—"} />
          </div>
          {approved.length === 0 ? (<EmptyState icon={PackageX} title="No approved damages in this range" description="Damages appear in analytics only after they are approved." />) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card><CardHeader><CardTitle className="text-base">Damage type breakdown</CardTitle></CardHeader><CardContent>
                <ResponsiveContainer width="100%" height={280}><BarChart data={typeSummary.rows.slice(0, 8).map((r) => ({ name: r.name, total: r.value }))} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid horizontal={false} strokeOpacity={0.15} /><XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} fontSize={11} /><YAxis type="category" dataKey="name" width={120} fontSize={11} /><Tooltip formatter={(v: number) => formatTk(v)} />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]}>{typeSummary.rows.slice(0, 8).map((_, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}</Bar></BarChart></ResponsiveContainer></CardContent></Card>
              <Card><CardHeader><CardTitle className="text-base">Monthly damage value</CardTitle></CardHeader><CardContent>
                <ResponsiveContainer width="100%" height={280}><BarChart data={monthly} margin={{ left: 8, right: 8 }}><CartesianGrid vertical={false} strokeOpacity={0.15} /><XAxis dataKey="label" fontSize={11} /><YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} fontSize={11} /><Tooltip formatter={(v: number) => formatTk(v)} /><Bar dataKey="total" fill="var(--chart-2)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></CardContent></Card>
            </div>)}
          {approved.length > 0 && (
            <Card><CardHeader><CardTitle className="text-base">Damage type detail</CardTitle></CardHeader><CardContent className="p-0">
              <Table><TableHeader><TableRow><TableHead>Type</TableHead><TableHead className="text-right">Count</TableHead><TableHead className="text-right">Damage value</TableHead><TableHead className="text-right">% of total</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
                <TableBody>{typeSummary.rows.map((r) => (<TableRow key={r.id ?? "none"} className="group">
                  <TableCell className="font-medium">{r.id ? (<Link to="/damages/type/$id" params={{ id: r.id }} search={{ from: range.from, to: range.to }} className="hover:text-brand-to hover:underline">{r.name}</Link>) : r.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.count}</TableCell><TableCell className="text-right font-medium tabular-nums">{formatTk(r.value)}</TableCell><TableCell className="text-right tabular-nums text-muted-foreground">{r.percentage.toFixed(1)}%</TableCell>
                  <TableCell>{r.id && (<ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />)}</TableCell></TableRow>))}</TableBody></Table></CardContent></Card>)}
          <Card><CardHeader><CardTitle className="text-base">All damages</CardTitle></CardHeader><CardContent className="p-0">
            {list.length === 0 ? (<div className="p-6"><EmptyState icon={PackageX} title="No damages yet" description="Create your first damage record." /></div>) : (
              <Table><TableHeader><TableRow><TableHead className="w-10"><Checkbox checked={pageAllSelected} onCheckedChange={() => pageAllSelected ? bulk.selection.removeMany(list) : bulk.selection.addMany(list)} aria-label="Select all damages" /></TableHead><TableHead>Damage No.</TableHead><TableHead>Date</TableHead><TableHead>Product</TableHead><TableHead className="text-right">Value</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{list.map((r) => (<TableRow key={r.id}><TableCell><Checkbox checked={bulk.selection.isSelected(r.id)} onCheckedChange={() => bulk.selection.toggle(r.id)} aria-label={`Select ${r.damage_number}`} /></TableCell><TableCell className="font-medium"><Link to="/damages/$id" params={{ id: r.id }} className="hover:text-brand-to hover:underline">{r.damage_number}</Link></TableCell><TableCell className="whitespace-nowrap">{formatDate(r.damage_date)}</TableCell><TableCell className="max-w-[200px] truncate">{r.product_name || "—"}</TableCell><TableCell className="text-right tabular-nums">{formatTk(r.damage_value)}</TableCell><TableCell><StatusBadge status={r.status} /></TableCell></TableRow>))}</TableBody></Table>)}</CardContent></Card>
        </>)}
      <BulkActionBar count={bulk.selection.count} canExport={canExport} busy={bulk.busy} onClear={bulk.selection.clear} onPrint={() => runBulk("selected", "print")} onPdf={() => runBulk("selected", "pdf")} onCsv={() => runBulk("selected", "csv")} />
      {bulk.printNode}
    </div>);
}
function MetricCard({ icon: Icon, label, value, hint }: { icon: typeof PackageX; label: string; value: string; hint: string }) {
  return (<Card><CardContent className="p-5"><div className="flex items-center justify-between"><p className="text-xs font-medium text-muted-foreground">{label}</p><span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-gradient-soft text-brand"><Icon className="h-4 w-4" /></span></div><p className="mt-3 text-2xl font-semibold tabular-nums text-foreground">{value}</p><p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p></CardContent></Card>);
}
