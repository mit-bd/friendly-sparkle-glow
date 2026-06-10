import { createFileRoute } from '@tanstack/react-router'
import { createFileRoute, Link, useNavigate } from "@/lib/router";
import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { ArrowLeft, Pencil, Trash2, Loader2, BellRing } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BudgetStatusBadge, BudgetUtilizationBar } from "@/components/budgets/BudgetStatusBadge";
import { BudgetForm } from "@/components/budgets/BudgetForm";
import { useAuth } from "@/lib/auth-context";
import {
  budgetPeriodLabel, evaluateBudget, fetchBudget, fetchBudgetAlerts, fetchBudgetDataset, formatBudgetDate,
  formatTk, monthlyBreakdown, BUDGET_TARGET_LABELS, BUDGET_TYPE_LABELS,
  type Budget, type BudgetAlert, type BudgetDataset,
} from "@/lib/budgets";

export const Route = createFileRoute("/_authenticated/budgets/$id")({
  head: () => ({ meta: [{ title: "Budget Details — Motion IT BD" }] }),
  component: BudgetDetail,
});

const ALERT_LABEL: Record<BudgetAlert["level"], string> = {
  warning: "Warning (80%)", near: "Near limit (90%)", critical: "Critical (100%)", exceeded: "Exceeded",
};

function BudgetDetail() {
  const { id } = Route.useParams();
  const { canAccessModule, can, isAdmin } = useAuth();
  const navigate = useNavigate();
  const canEdit = isAdmin || can("budgets", "edit");
  const [budget, setBudget] = useState<Budget | null>(null);
  const [data, setData] = useState<BudgetDataset>({ expenses: [], returns: [], damages: [], payables: [] });
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function load() {
    setLoading(true);
    fetchBudget(id)
      .then(async (b) => {
        setBudget(b);
        if (b) {
          const [ds, al] = await Promise.all([fetchBudgetDataset([b]), fetchBudgetAlerts(b.id)]);
          setData(ds);
          setAlerts(al);
        }
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load budget."))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [id]);

  const evaln = useMemo(() => (budget ? evaluateBudget(budget, data) : null), [budget, data]);
  const monthly = useMemo(() => (budget ? monthlyBreakdown(budget, data) : []), [budget, data]);

  async function doDelete() {
    if (!budget) return;
    setDeleting(true);
    try {
      const { softDeleteBudget } = await import("@/lib/budgets");
      await softDeleteBudget(budget.id);
      toast.success("Budget deleted.");
      navigate({ to: "/budgets" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete budget.");
    } finally {
      setDeleting(false);
    }
  }

  if (!canAccessModule("budgets")) return (<div className="space-y-8"><PageHeader title="Budget Details" /><NoAccess /></div>);
  if (loading) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-40 rounded-lg" /></div>;
  if (!budget || !evaln) return (<div className="space-y-8"><PageHeader title="Budget Details" /><p className="text-muted-foreground">Budget not found.</p></div>);

  return (
    <div className="space-y-6">
      <PageHeader
        title={budget.name}
        description={`${budget.budget_number} · ${BUDGET_TYPE_LABELS[budget.budget_type]} · ${BUDGET_TARGET_LABELS[budget.target_type]}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild><Link to="/budgets"><ArrowLeft className="h-4 w-4" />Back</Link></Button>
            {canEdit && <Button variant="outline" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" />Edit</Button>}
            {isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="outline" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" />Delete</Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Delete this budget?</AlertDialogTitle><AlertDialogDescription>This moves the budget to the recycle bin. Spending records are not affected.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={doDelete} disabled={deleting}>{deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Budget Amount" value={formatTk(budget.amount)} />
        <StatCard label="Used Amount" value={formatTk(evaln.used)} />
        <StatCard label="Remaining" value={formatTk(evaln.remaining)} tone={evaln.remaining < 0 ? "negative" : "neutral"} />
        <Card><CardContent className="p-5"><p className="text-xs font-medium text-muted-foreground">Status</p><div className="mt-3 flex items-center gap-2"><BudgetStatusBadge status={evaln.status} /><span className="text-sm tabular-nums text-muted-foreground">{evaln.utilization.toFixed(0)}%</span></div><div className="mt-3"><BudgetUtilizationBar utilization={evaln.utilization} status={evaln.status} /></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Budget details</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <Detail label="Period" value={budgetPeriodLabel(budget)} />
          <Detail label="Target" value={BUDGET_TARGET_LABELS[budget.target_type]} />
          <Detail label="Warning threshold" value={`${budget.warning_threshold}%`} />
          <Detail label="Critical threshold" value={`${budget.critical_threshold}%`} />
          {budget.notes && <div className="sm:col-span-2"><Detail label="Notes" value={budget.notes} /></div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Monthly breakdown</CardTitle></CardHeader>
        <CardContent>
          {monthly.length === 0 ? <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">No approved spending in this period.</div> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthly} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} strokeOpacity={0.15} />
                <XAxis dataKey="label" fontSize={11} /><YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} fontSize={11} />
                <Tooltip formatter={(v: number) => formatTk(v)} />
                <Bar dataKey="used" name="Used" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BellRing className="h-4 w-4 text-brand" />Alert history</CardTitle></CardHeader>
        <CardContent className="p-0">
          {alerts.length === 0 ? <p className="p-6 text-sm text-muted-foreground">No alerts generated for this budget yet.</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Level</TableHead><TableHead className="text-right">Utilization</TableHead><TableHead className="text-right">Used</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
              <TableBody>
                {alerts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{ALERT_LABEL[a.level]}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(a.utilization).toFixed(0)}%</TableCell>
                    <TableCell className="text-right tabular-nums">{formatTk(a.used_amount)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatBudgetDate(a.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Edit budget</DialogTitle></DialogHeader>
          <BudgetForm mode="edit" initial={budget} onSaved={() => { setEditing(false); load(); }} onCancel={() => setEditing(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "negative" }) {
  return (<Card><CardContent className="p-5"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className={`mt-3 text-2xl font-semibold tabular-nums ${tone === "negative" ? "text-destructive" : "text-foreground"}`}>{value}</p></CardContent></Card>);
}
function Detail({ label, value }: { label: string; value: string }) {
  return (<div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="font-medium text-foreground">{value}</dd></div>);
}
