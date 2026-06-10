import { createFileRoute } from '@tanstack/react-router'
import { createFileRoute, Link } from "@/lib/router";
import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, LineChart, Line, Legend } from "recharts";
import { ArrowDownRight, ArrowUpRight, Banknote, HandCoins, Scale, AlertTriangle, CalendarClock, CalendarDays, Truck, Boxes, Sparkles, FileBarChart, Repeat } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { EmptyState } from "@/components/analytics/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import {
  buildMonthly, buildSnapshot, courierReceivableSummary, fetchAllCollections, fetchAllPayments, fetchPayables, fetchReceivables,
  financeInsights, formatTk, isApprovedActive, supplierLiabilitySummary, topOutstandingParties,
  type FinanceInsight, type Payable, type Receivable,
} from "@/lib/finance";
import {
  fetchOutstandingFixedCosts, fetchTemplates, remainingOf,
  type FixedCostRecord, type FixedCostTemplate,
} from "@/lib/fixed-costs";

export const Route = createFileRoute("/_authenticated/finance/")({
  head: () => ({ meta: [{ title: "Finance Dashboard — Motion IT BD" }] }),
  component: FinanceDashboard,
});

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function FinanceDashboard() {
  const { canAccessModule } = useAuth();
  const [recv, setRecv] = useState<Receivable[]>([]);
  const [pay, setPay] = useState<Payable[]>([]);
  const [collections, setCollections] = useState<{ amount: number; collection_date: string }[]>([]);
  const [payments, setPayments] = useState<{ amount: number; payment_date: string }[]>([]);
  const [fixedCosts, setFixedCosts] = useState<FixedCostRecord[]>([]);
  const [fcTemplates, setFcTemplates] = useState<FixedCostTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([fetchReceivables(), fetchPayables(), fetchAllCollections(), fetchAllPayments(), fetchOutstandingFixedCosts().catch(() => []), fetchTemplates().catch(() => [])])
      .then(([r, p, c, pm, fc, ft]) => { if (!active) return; setRecv(r); setPay(p); setCollections(c); setPayments(pm); setFixedCosts(fc as FixedCostRecord[]); setFcTemplates(ft as FixedCostTemplate[]); })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load finance data."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const snap = useMemo(() => buildSnapshot(recv, pay), [recv, pay]);
  const approvedRecv = useMemo(() => recv.filter(isApprovedActive), [recv]);
  const approvedPay = useMemo(() => pay.filter(isApprovedActive), [pay]);
  const insights = useMemo(() => financeInsights(recv, pay), [recv, pay]);
  const couriers = useMemo(() => courierReceivableSummary(recv), [recv]);
  const suppliers = useMemo(() => supplierLiabilitySummary(pay), [pay]);
  const topCustomers = useMemo(() => topOutstandingParties(approvedRecv), [approvedRecv]);
  const topSuppliers = useMemo(() => topOutstandingParties(approvedPay), [approvedPay]);
  const recvTrend = useMemo(() => buildMonthly(approvedRecv, (r) => r.created_at, (r) => r.amount), [approvedRecv]);
  const payTrend = useMemo(() => buildMonthly(approvedPay, (p) => p.created_at, (p) => p.amount), [approvedPay]);
  const fcOutstandingTotal = useMemo(() => fixedCosts.reduce((a, r) => a + remainingOf(r), 0), [fixedCosts]);
  const fcTopOutstanding = useMemo(() => {
    const tName = new Map(fcTemplates.map((t) => [t.id, t.name]));
    return [...fixedCosts]
      .map((r) => ({ id: r.id, name: r.fixed_cost_template_id ? tName.get(r.fixed_cost_template_id) ?? "Fixed Cost" : "Fixed Cost", remaining: remainingOf(r), month: (r.period_month ?? r.expense_date).slice(0, 7) }))
      .sort((a, b) => b.remaining - a.remaining)
      .slice(0, 6);
  }, [fixedCosts, fcTemplates]);
  const collectionTrend = useMemo(() => buildMonthly(collections, (c) => c.collection_date, (c) => c.amount), [collections]);
  const paymentTrend = useMemo(() => buildMonthly(payments, (c) => c.payment_date, (c) => c.amount), [payments]);

  const settlementTrend = useMemo(() => {
    const keys = new Set([...collectionTrend.map((d) => d.key), ...paymentTrend.map((d) => d.key)]);
    const cMap = new Map(collectionTrend.map((d) => [d.key, d.total]));
    const pMap = new Map(paymentTrend.map((d) => [d.key, d.total]));
    return [...keys].sort().map((k) => ({
      label: (collectionTrend.find((d) => d.key === k) ?? paymentTrend.find((d) => d.key === k))?.label ?? k,
      collected: cMap.get(k) ?? 0, paid: pMap.get(k) ?? 0,
    }));
  }, [collectionTrend, paymentTrend]);

  if (!canAccessModule("finance")) return (<div className="space-y-8"><PageHeader title="Finance Dashboard" /><NoAccess /></div>);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance Dashboard"
        description="Receivables, payables, settlements and outstanding balances. Approved records only."
        actions={<Button variant="outline" asChild><Link to="/finance/reports"><FileBarChart className="h-4 w-4" />Finance Reports</Link></Button>}
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard icon={Banknote} label="Total Receivable" value={formatTk(snap.totalReceivable)} hint="Outstanding owed to us" tone="positive" />
            <KpiCard icon={HandCoins} label="Total Payable" value={formatTk(snap.totalPayable)} hint="Outstanding we owe" tone="negative" />
            <NetCard net={snap.net} />
            <KpiCard icon={AlertTriangle} label="Overdue Receivable" value={formatTk(snap.overdueReceivable)} hint="Past due, owed to us" tone="negative" />
            <KpiCard icon={AlertTriangle} label="Overdue Payable" value={formatTk(snap.overduePayable)} hint="Past due, we owe" tone="negative" />
            <KpiCard icon={CalendarClock} label="Due This Week" value={formatTk(snap.dueThisWeek)} hint="Receivable + payable" tone="neutral" />
            <KpiCard icon={CalendarDays} label="Due This Month" value={formatTk(snap.dueThisMonth)} hint="Receivable + payable" tone="neutral" />
            <KpiCard icon={Scale} label="Collection / Payment %" value={`${snap.collectionEfficiency.toFixed(0)}% / ${snap.paymentEfficiency.toFixed(0)}%`} hint="Efficiency" tone="neutral" />
          </div>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-brand" />Financial health insights</CardTitle></CardHeader>
            <CardContent>
              {insights.length === 0 ? <p className="text-sm text-muted-foreground">No insights yet.</p> : (
                <ul className="space-y-2">
                  {insights.map((ins, i) => <InsightRow key={i} insight={ins} />)}
                </ul>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Receivable vs Payable trend (created)">
              {recvTrend.length === 0 && payTrend.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={mergeTrend(recvTrend, payTrend, "receivable", "payable")} margin={{ left: 8, right: 8 }}>
                    <CartesianGrid vertical={false} strokeOpacity={0.15} /><XAxis dataKey="label" fontSize={11} /><YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} fontSize={11} /><Tooltip formatter={(v: number) => formatTk(v)} /><Legend />
                    <Bar dataKey="receivable" name="Receivable" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="payable" name="Payable" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
            <ChartCard title="Monthly collections vs payments">
              {settlementTrend.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={settlementTrend} margin={{ left: 8, right: 8 }}>
                    <CartesianGrid vertical={false} strokeOpacity={0.15} /><XAxis dataKey="label" fontSize={11} /><YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} fontSize={11} /><Tooltip formatter={(v: number) => formatTk(v)} /><Legend />
                    <Line type="monotone" dataKey="collected" name="Collected" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="paid" name="Paid" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <PartyTable title="Top outstanding customers" icon={Banknote} rows={topCustomers} />
            <PartyTable title="Top outstanding suppliers" icon={Boxes} rows={topSuppliers} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <PartyTable title="Courier receivable summary" icon={Truck} rows={couriers} emptyHint="No outstanding courier settlements." />
            <PartyTable title="Supplier liabilities" icon={Boxes} rows={suppliers} emptyHint="No outstanding supplier liabilities." />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                <span className="flex items-center gap-2"><Repeat className="h-4 w-4 text-brand" />Outstanding fixed costs</span>
                <span className="text-sm font-semibold tabular-nums text-foreground">{formatTk(fcOutstandingTotal)}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {fcTopOutstanding.length === 0 ? (
                <p className="text-sm text-muted-foreground">No outstanding fixed costs.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fixed cost</TableHead>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Remaining</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fcTopOutstanding.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">
                          <Link to="/fixed-costs/$id" params={{ id: r.id }} className="hover:text-brand hover:underline">{r.name}</Link>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{r.month}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatTk(r.remaining)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <div className="mt-3">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/fixed-costs"><Repeat className="h-4 w-4" />Manage fixed costs</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function mergeTrend(a: { key: string; label: string; total: number }[], b: { key: string; label: string; total: number }[], aKey: string, bKey: string) {
  const keys = new Set([...a.map((d) => d.key), ...b.map((d) => d.key)]);
  const aMap = new Map(a.map((d) => [d.key, d.total]));
  const bMap = new Map(b.map((d) => [d.key, d.total]));
  return [...keys].sort().map((k) => ({ label: (a.find((d) => d.key === k) ?? b.find((d) => d.key === k))?.label ?? k, [aKey]: aMap.get(k) ?? 0, [bKey]: bMap.get(k) ?? 0 }));
}

function KpiCard({ icon: Icon, label, value, hint, tone }: { icon: typeof Banknote; label: string; value: string; hint: string; tone: "positive" | "negative" | "neutral" }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-gradient-soft text-brand"><Icon className="h-4 w-4" /></span>
        </div>
        <p className="mt-3 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function NetCard({ net }: { net: number }) {
  const positive = net >= 0;
  return (
    <Card className={positive ? "border-chart-2/40" : "border-warning/40"}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">Net Position</p>
          <span className={`flex h-8 w-8 items-center justify-center rounded-md ${positive ? "bg-chart-2/15 text-chart-2" : "bg-warning/15 text-warning"}`}>
            {positive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
          </span>
        </div>
        <p className={`mt-3 text-2xl font-semibold tabular-nums ${positive ? "text-chart-2" : "text-warning"}`}>{formatTk(net)}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{positive ? "Net owed to company" : "Company owes more"}</p>
      </CardContent>
    </Card>
  );
}

function InsightRow({ insight }: { insight: FinanceInsight }) {
  const tone = insight.tone === "positive" ? "text-chart-2" : insight.tone === "negative" ? "text-destructive" : "text-muted-foreground";
  return (
    <li className="flex items-start gap-2 text-sm">
      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${insight.tone === "positive" ? "bg-chart-2" : insight.tone === "negative" ? "bg-destructive" : "bg-muted-foreground"}`} />
      <span className={tone}>{insight.text}</span>
    </li>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (<Card><CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent>{children}</CardContent></Card>);
}
function EmptyChart() { return <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">No approved data yet.</div>; }

function PartyTable({ title, icon: Icon, rows, emptyHint }: { title: string; icon: typeof Banknote; rows: { name: string; outstanding: number; count: number }[]; emptyHint?: string }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4 text-brand" />{title}</CardTitle></CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (<div className="p-6"><EmptyState icon={Icon} title="Nothing outstanding" description={emptyHint ?? "No outstanding balances."} /></div>) : (
          <Table>
            <TableHeader><TableRow><TableHead>Party</TableHead><TableHead className="text-right">Records</TableHead><TableHead className="text-right">Outstanding</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.name}><TableCell className="max-w-[200px] truncate font-medium">{r.name}</TableCell><TableCell className="text-right tabular-nums">{r.count}</TableCell><TableCell className="text-right font-medium tabular-nums">{formatTk(r.outstanding)}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}