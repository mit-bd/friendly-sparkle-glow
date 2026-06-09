import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { FileDown, FileSpreadsheet, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReportDocument } from "@/components/reports/ReportDocument";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime } from "@/lib/expenses";
import { logActivity } from "@/lib/audit";
import { logReportExport } from "@/lib/reports";
import { downloadCsv } from "@/lib/report-csv";
import {
  budgetPeriodLabel, evaluateAll, fetchBudgetDataset, fetchBudgets, formatTk,
  BUDGET_STATUS_META, BUDGET_TARGET_LABELS,
  type Budget, type BudgetDataset, type BudgetEvaluation,
} from "@/lib/budgets";

export const Route = createFileRoute("/_authenticated/budgets/reports")({
  head: () => ({ meta: [{ title: "Budget Reports — Motion IT BD" }] }),
  component: BudgetReports,
});

type RType = "summary" | "vs_actual" | "over_budget" | "category" | "monthly";
const REPORT_TYPES: { value: RType; label: string }[] = [
  { value: "summary", label: "Budget Summary" },
  { value: "vs_actual", label: "Budget vs Actual" },
  { value: "over_budget", label: "Over Budget Report" },
  { value: "category", label: "Category Budget Report" },
  { value: "monthly", label: "Monthly Budget Report" },
];
const LABELS = Object.fromEntries(REPORT_TYPES.map((t) => [t.value, t.label])) as Record<RType, string>;
const MONEY = ["Budget", "Used", "Remaining", "Amount"];

interface Built { headers: string[]; rows: (string | number)[][]; total: number; count: number; }

function BudgetReports() {
  const { canAccessModule, can, isAdmin, profile } = useAuth();
  const canExport = isAdmin || can("budgets", "export") || can("reports", "export");
  const [type, setType] = useState<RType>("summary");
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [data, setData] = useState<BudgetDataset>({ expenses: [], returns: [], damages: [], payables: [] });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<{ type: RType; built: Built; reportNumber: string; generatedAt: string; generatedBy: string } | null>(null);

  useEffect(() => {
    fetchBudgets()
      .then(async (bs) => { setBudgets(bs); setData(await fetchBudgetDataset(bs)); })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load budgets."))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => setGenerated(null), [type]);

  const evals = useMemo(() => evaluateAll(budgets, data), [budgets, data]);

  function build(t: RType): Built {
    if (t === "over_budget") {
      const rows = evals.filter((e) => e.status === "exceeded" || e.status === "critical");
      return summaryBuilt(rows);
    }
    if (t === "vs_actual") {
      const headers = ["Budget", "Target", "Budget", "Used", "Variance", "Utilization"];
      const body = evals.map((e) => [e.budget.name, BUDGET_TARGET_LABELS[e.budget.target_type], e.budget.amount, e.used, e.budget.amount - e.used, `${e.utilization.toFixed(0)}%`]);
      return { headers, rows: body, total: evals.reduce((a, e) => a + e.used, 0), count: evals.length };
    }
    return summaryBuilt(evals);
  }

  function summaryBuilt(rows: BudgetEvaluation[]): Built {
    const headers = ["Budget", "Target", "Period", "Budget", "Used", "Remaining", "Utilization", "Status"];
    const body = rows.map((e) => [
      e.budget.name, BUDGET_TARGET_LABELS[e.budget.target_type], budgetPeriodLabel(e.budget),
      e.budget.amount, e.used, e.remaining, `${e.utilization.toFixed(0)}%`, BUDGET_STATUS_META[e.status].label,
    ]);
    return { headers, rows: body, total: rows.reduce((a, e) => a + e.budget.amount, 0), count: rows.length };
  }

  async function generate() {
    setGenerating(true);
    try {
      const built = build(type);
      const logged = await logReportExport({
        reportType: `budget_${type}`, title: LABELS[type], rangeFrom: null, rangeTo: null,
        filters: { module: "budgets" }, expenseCount: built.count, totalAmount: built.total,
      });
      void logActivity({ action: "export", entityType: "report", entityLabel: `${logged.report_number} · ${LABELS[type]}`, metadata: { module: "budgets" } });
      setGenerated({ type, built, reportNumber: logged.report_number, generatedAt: formatDateTime(logged.created_at), generatedBy: profile?.full_name?.trim() || profile?.email || "—" });
      toast.success(`Report ${logged.report_number} generated and archived.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate report.");
    } finally {
      setGenerating(false);
    }
  }

  function exportCsv() {
    if (!generated) return;
    downloadCsv(`motion-it-bd-${LABELS[generated.type].toLowerCase().replace(/\s+/g, "-")}`, generated.built.headers, generated.built.rows);
    void logActivity({ action: "export", entityType: "report", entityLabel: `${generated.reportNumber} · ${LABELS[generated.type]}`, metadata: { format: "csv" } });
  }
  function print() { if (generated) void logActivity({ action: "print", entityType: "report", entityLabel: `${generated.reportNumber} · ${LABELS[generated.type]}` }); window.print(); }

  if (!canAccessModule("budgets")) return (<div className="space-y-8"><PageHeader title="Budget Reports" /><NoAccess /></div>);

  const moneyHeader = (h: string, i: number) => MONEY.includes(h) || (h === "Variance");

  return (
    <div className="space-y-8">
      <PageHeader title="Budget Reports" description="Branded, approval-only budget reports with print, PDF and CSV export." />
      <Card className="no-print">
        <CardHeader><CardTitle className="text-base">Build a report</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Report type</Label>
              <Select value={type} onValueChange={(v) => setType(v as RType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{REPORT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={generate} disabled={loading || generating}>{generating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Generate report</Button>
            {generated && canExport && (<>
              <Button variant="outline" onClick={print}><Printer className="h-4 w-4" />Print</Button>
              <Button variant="outline" onClick={print}><FileDown className="h-4 w-4" />Save as PDF</Button>
              <Button variant="outline" onClick={exportCsv}><FileSpreadsheet className="h-4 w-4" />Export CSV</Button>
            </>)}
          </div>
        </CardContent>
      </Card>

      {generated && (
        <ReportDocument reportName={LABELS[generated.type]} reportNumber={generated.reportNumber} generatedAt={generated.generatedAt} generatedBy={generated.generatedBy}>
          <Table>
            <TableHeader><TableRow>{generated.built.headers.map((h, i) => (<TableHead key={`${h}-${i}`} className={moneyHeader(h, i) ? "text-right" : ""}>{h}</TableHead>))}</TableRow></TableHeader>
            <TableBody>
              {generated.built.rows.length === 0 ? (
                <TableRow><TableCell colSpan={generated.built.headers.length} className="text-center text-muted-foreground">No budgets to report.</TableCell></TableRow>
              ) : generated.built.rows.map((r, i) => (
                <TableRow key={i}>{r.map((c, j) => {
                  const h = generated.built.headers[j];
                  const money = moneyHeader(h, j);
                  const val = money && typeof c === "number" ? formatTk(c) : String(c ?? "");
                  return (<TableCell key={j} className={money ? "text-right tabular-nums" : ""}>{val}</TableCell>);
                })}</TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-4 flex justify-between border-t border-border pt-3 text-sm font-semibold">
            <span>{generated.built.count} budget(s)</span>
            <span className="tabular-nums">Total budgeted: {formatTk(generated.built.total)}</span>
          </div>
        </ReportDocument>
      )}
    </div>
  );
}
