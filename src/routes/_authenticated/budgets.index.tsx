import { createFileRoute } from '@tanstack/react-router'
import { createFileRoute, Link } from "@/lib/router";
import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { Wallet, TrendingUp, PiggyBank, AlertTriangle, Gauge, Sparkles, Plus, FileBarChart, BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { EmptyState } from "@/components/analytics/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BudgetStatusBadge, BudgetUtilizationBar } from "@/components/budgets/BudgetStatusBadge";
import { useAuth } from "@/lib/auth-context";
import { budgetInsights, budgetPeriodLabel, evaluateAll, fetchBudgetDataset, fetchBudgets, formatTk, runBudgetAlerts, summarise, BUDGET_TARGET_LABELS, type Budget, type BudgetDataset, type BudgetEvaluation } from "@/lib/budgets";

export const Route = createFileRoute("/_authenticated/budgets/")({
  head: () => ({ meta: [{ title: "Budget Dashboard — Motion IT BD" }] }),
  component: BudgetDashboard,
});

function BudgetDashboard() {
  const { canAccessModule, can, isAdmin } = useAuth();
  const canEdit = isAdmin || can("budgets", "edit");
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [data, setData] = useState<BudgetDataset>({ expenses: [], returns: [], damages: [], payables: [] });
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  function load() {
    setLoading(true);
    fetchBudgets()
      .then(async (bs) => { setBudgets(bs); setData(await fetchBudgetDataset(bs)); })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load budgets."))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  const evals = useMemo(() => evaluateAll(budgets, data), [budgets, data]);
  const summary = useMemo(() => summarise(evals), [evals]);
  const insights = useMemo(() => budgetInsights(evals), [evals]);
  const sorted = useMemo(() => [...evals].sort((a, b) => b.utilization - a.utilization), [evals]);
  const vsActual = useMemo(() => sorted.slice(0, 8).map((e) => ({ name: e.budget.name, Budget: e.budget.amount, Used: e.used })), [sorted]);

  async function runAlerts() {
    setRunning(true);
    try {
      const n = await runBudgetAlerts();
      toast.success(n > 0 ? `${n} budget alert(s) generated.` : "No new alerts — all budgets within thresholds.");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to run alert check.");
    } finally { setRunning(false); }
  }

  if (!canAccessModule("budgets")) return (<div className="space-y-8"><PageHeader title="Budget Dashboard" /><NoAccess /></div>);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budget Control"
        description="Define budgets, monitor approved spending against them and act before overspending. Approved records only."
        actions={
          <div className="flex flex-wrap gap-2">
            {canEdit && <Button variant="outline" onClick={runAlerts} disabled={running}>{running ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}Run alert check</Button>}
            <Button variant="outline" asChild><Link to="/budgets/reports"><FileBarChart className="h-4 w-4" />Reports</Link></Button>
            {canEdit && <Button asChild><Link to="/budgets/create"><Plus className="h-4 w-4" />New budget</Link></Button>}
          </div>
        }
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}</div>
      ) : budgets.length === 0 ? (
        <Card><CardContent className="py-12"><EmptyState icon={Wallet} title="No budgets yet" description="Create your first budget to start monitoring spending against targets." /></CardContent></Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <KpiCard icon={Wallet} label="Total Budget" value={formatTk(summary.totalBudget)} hint={`${summary.budgetCount} active budgets`} />
            <KpiCard icon={TrendingUp} label="Budget Used" value={formatTk(summary.totalUsed)} hint="Approved spend" />
            <KpiCard icon={PiggyBank} label="Budget Remaining" value={formatTk(summary.totalRemaining)} hint="Across all budgets" tone={summary.totalRemaining < 0 ? "negative" : "neutral"} />
            <KpiCard icon={AlertTriangle} label="Over Budget" value={String(summary.overBudgetCount)} hint="Budgets exceeded" tone={summary.overBudgetCount > 0 ? "negative" : "neutral"} />
            <KpiCard icon={Gauge} label="Utilization" value={`${summary.utilization.toFixed(0)}%`} hint="Overall used vs budget" />
          </div>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-brand" />Budget insights</CardTitle></CardHeader>
            <CardContent>
              {insights.length === 0 ? <p className="text-sm text-muted-foreground">No insights yet.</p> : (
                <ul className="space-y-2">
                  {insights.map((ins, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${ins.tone === "positive" ? "bg-chart-2" : ins.tone === "negative" ? "bg-destructive" : "bg-warning"}`} />
                      <span className={ins.tone === "positive" ? "text-chart-2" : ins.tone === "negative" ? "text-destructive" : "text-foreground"}>{ins.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Budget vs Actual</CardTitle></CardHeader>
            <CardContent>
              {vsActual.length === 0 ? <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">No approved data yet.</div> : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={vsActual} margin={{ left: 8, right: 8 }}>
                    <CartesianGrid vertical={false} strokeOpacity={0.15} />
                    <XAxis dataKey="name" fontSize={11} tickFormatter={(v: string) => (v.length > 12 ? `${v.slice(0, 12)}…` : v)} />
                    <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} fontSize={11} />
                    <Tooltip formatter={(v: number) => formatTk(v)} />
                    <Legend />
                    <Bar dataKey="Budget" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Used" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Category utilization</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Budget</TableHead><TableHead>Target</TableHead><TableHead>Period</TableHead>
                    <TableHead className="text-right">Budget</TableHead><TableHead className="text-right">Used</TableHead>
                    <TableHead className="text-right">Remaining</TableHead><TableHead className="w-[180px]">Utilization</TableHead><TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>{sorted.map((e) => <BudgetRow key={e.budget.id} e={e} />)}</TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function BudgetRow({ e }: { e: BudgetEvaluation }) {
  return (
    <TableRow>
      <TableCell className="font-medium">
        <Link to="/budgets/$id" params={{ id: e.budget.id }} className="hover:text-brand">{e.budget.name}</Link>
        <div className="text-xs text-muted-foreground">{e.budget.budget_number}</div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{BUDGET_TARGET_LABELS[e.budget.target_type]}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{budgetPeriodLabel(e.budget)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatTk(e.budget.amount)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatTk(e.used)}</TableCell>
      <TableCell className={`text-right tabular-nums ${e.remaining < 0 ? "text-destructive" : ""}`}>{formatTk(e.remaining)}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <BudgetUtilizationBar utilization={e.utilization} status={e.status} />
          <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{e.utilization.toFixed(0)}%</span>
        </div>
      </TableCell>
      <TableCell><BudgetStatusBadge status={e.status} /></TableCell>
    </TableRow>
  );
}

function KpiCard({ icon: Icon, label, value, hint, tone = "neutral" }: { icon: typeof Wallet; label: string; value: string; hint: string; tone?: "neutral" | "negative" }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-gradient-soft text-brand"><Icon className="h-4 w-4" /></span>
        </div>
        <p className={`mt-3 text-2xl font-semibold tabular-nums ${tone === "negative" ? "text-destructive" : "text-foreground"}`}>{value}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
