import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, FileDown, FileSpreadsheet, Loader2, Printer, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangeFilter } from "@/components/analytics/DateRangeFilter";
import { ReportDocument } from "@/components/reports/ReportDocument";
import { EmptyReportNote } from "@/components/reports/ReportBodies";
import { useAuth } from "@/lib/auth-context";
import {
  DEFAULT_PRESET,
  resolveRange,
  formatRangeLabel,
  type DateRange,
  type RangePreset,
} from "@/lib/analytics";
import { EXPENSE_STATUS, formatCurrency, formatDate, formatDateTime, type ExpenseStatus } from "@/lib/expenses";
import { logActivity } from "@/lib/audit";
import { logReportExport } from "@/lib/reports";
import { downloadCsv } from "@/lib/report-csv";
import {
  fetchApprovedFixedCosts,
  fetchFixedCostRecords,
  fetchTemplates,
  buildMonthlyFixedCost,
  buildTopFixedCosts,
  sumAmount,
  fetchOutstandingFixedCosts,
  fetchFixedCostPaymentHistory,
  remainingOf,
  settlementOf,
  SETTLEMENT_STATUS,
  type FixedCostRecord,
  type FixedCostTemplate,
  type PaymentHistoryRow,
} from "@/lib/fixed-costs";

export const Route = createFileRoute("/_authenticated/fixed-costs/reports")({
  head: () => ({ meta: [{ title: "Fixed Cost Reports — Motion IT BD" }] }),
  component: FixedCostReports,
});

type FcReportType = "summary" | "monthly" | "approval" | "outstanding" | "payments";

const REPORT_TYPES: { value: FcReportType; label: string; description: string }[] = [
  { value: "summary", label: "Fixed Cost Summary Report", description: "Approved spend grouped per fixed cost with share of total." },
  { value: "monthly", label: "Monthly Fixed Cost Report", description: "Approved fixed cost totals per month." },
  { value: "approval", label: "Fixed Cost Approval Report", description: "Every generated record in range with its approval status." },
  { value: "outstanding", label: "Fixed Cost Outstanding Report", description: "Unsettled fixed costs with total, paid, and remaining balance." },
  { value: "payments", label: "Fixed Cost Payment History", description: "Every payment recorded in range with reference and amount." },
];

const th = "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
const td = "px-3 py-2 text-sm text-foreground align-top";
const num = "px-3 py-2 text-sm text-foreground text-right tabular-nums align-top";

interface Generated {
  type: FcReportType;
  approved: FixedCostRecord[];
  all: FixedCostRecord[];
  templates: FixedCostTemplate[];
  outstanding: FixedCostRecord[];
  payments: PaymentHistoryRow[];
  reportNumber: string;
  generatedAt: string;
  generatedBy: string;
  rangeLabel: string;
}

function FixedCostReports() {
  const { canAccessModule, can, isAdmin, profile } = useAuth();
  const canExport = isAdmin || can("reports", "view") || can("reports", "export");

  const [type, setType] = useState<FcReportType>("summary");
  const [preset, setPreset] = useState<RangePreset>(DEFAULT_PRESET);
  const [range, setRange] = useState<DateRange>(resolveRange(DEFAULT_PRESET));
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<Generated | null>(null);

  useEffect(() => setGenerated(null), [type]);

  if (!canAccessModule("fixed_costs")) {
    return (
      <div className="space-y-8">
        <PageHeader title="Fixed Cost Reports" />
        <NoAccess />
      </div>
    );
  }

  const meta = REPORT_TYPES.find((t) => t.value === type)!;

  async function handleGenerate() {
    setGenerating(true);
    try {
      const [approved, list, templates, outstanding, payments] = await Promise.all([
        fetchApprovedFixedCosts(range),
        fetchFixedCostRecords(),
        fetchTemplates(),
        fetchOutstandingFixedCosts(),
        fetchFixedCostPaymentHistory(range),
      ]);
      const all = list.filter(
        (r) => (r.period_month ?? r.expense_date) >= range.from && (r.period_month ?? r.expense_date) <= range.to,
      );
      const grand =
        type === "outstanding"
          ? outstanding.reduce((acc, r) => acc + remainingOf(r), 0)
          : type === "payments"
            ? payments.reduce((acc, p) => acc + Number(p.amount || 0), 0)
            : sumAmount(approved);
      const count =
        type === "approval" ? all.length : type === "outstanding" ? outstanding.length : type === "payments" ? payments.length : approved.length;
      let reportNumber = "—";
      let createdAt = new Date().toISOString();
      if (canExport) {
        try {
          const logged = await logReportExport({
            reportType: `fixed_cost_${type}`,
            title: `${meta.label} (${formatRangeLabel(range)})`,
            rangeFrom: range.from,
            rangeTo: range.to,
            filters: { module: "fixed_costs", report: type, preset },
            expenseCount: count,
            totalAmount: grand,
          });
          reportNumber = logged.report_number;
          createdAt = logged.created_at;
          void logActivity({
            action: "export",
            entityType: "report",
            entityLabel: `${reportNumber} · ${meta.label}`,
            metadata: { count, total: grand },
          });
        } catch {
          /* archive is best-effort */
        }
      }
      setGenerated({
        type,
        approved,
        all,
        templates,
        outstanding,
        payments,
        reportNumber,
        generatedAt: formatDateTime(createdAt),
        generatedBy: profile?.full_name?.trim() || profile?.email || "—",
        rangeLabel: formatRangeLabel(range),
      });
      toast.success(reportNumber === "—" ? "Report generated." : `Report ${reportNumber} generated and archived.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate report.");
    } finally {
      setGenerating(false);
    }
  }

  const print = () => {
    if (generated)
      void logActivity({ action: "print", entityType: "report", entityLabel: generated.reportNumber });
    window.print();
  };

  function handleCsv() {
    if (!generated) return;
    const tName = new Map(generated.templates.map((t) => [t.id, t.name]));
    const name = (id: string | null) => (id ? tName.get(id) ?? "Fixed Cost" : "Fixed Cost");
    let headers: string[] = [];
    let body: (string | number)[][] = [];

    if (type === "summary") {
      const top = buildTopFixedCosts(generated.approved, name);
      headers = ["Fixed Cost", "Records", "Total (BDT)", "% of total"];
      body = top.rows.map((r) => [r.name, r.count, r.total, `${r.percentage.toFixed(1)}%`]);
      body.push(["Grand Total", generated.approved.length, top.grandTotal, "100.0%"]);
    } else if (type === "monthly") {
      const monthly = buildMonthlyFixedCost(generated.approved);
      headers = ["Month", "Total (BDT)"];
      body = monthly.map((m) => [m.label, m.total]);
      body.push(["Grand Total", sumAmount(generated.approved)]);
    } else if (type === "outstanding") {
      headers = ["Fixed Cost", "Number", "Month", "Total (BDT)", "Paid (BDT)", "Remaining (BDT)", "Status"];
      body = generated.outstanding.map((r) => [
        name(r.fixed_cost_template_id),
        r.expense_number,
        (r.period_month ?? r.expense_date).slice(0, 7),
        r.amount,
        r.fc_paid_amount,
        remainingOf(r),
        SETTLEMENT_STATUS[settlementOf(r)].label,
      ]);
      const totOut = generated.outstanding.reduce((a, r) => a + remainingOf(r), 0);
      body.push(["Grand Total", "", "", "", "", totOut, ""]);
    } else if (type === "payments") {
      headers = ["Date", "Fixed Cost", "Number", "Reference", "Amount (BDT)", "Notes"];
      body = generated.payments.map((p) => [
        formatDate(p.payment_date),
        name(p.template_id),
        p.expense_number,
        p.reference_number ?? "—",
        p.amount,
        p.notes ?? "",
      ]);
      const totPay = generated.payments.reduce((a, p) => a + Number(p.amount || 0), 0);
      body.push(["Grand Total", "", "", "", totPay, ""]);
    } else {
      headers = ["Fixed Cost", "Number", "Month", "Amount (BDT)", "Status", "Created", "Approved"];
      body = generated.all.map((r) => [
        name(r.fixed_cost_template_id),
        r.expense_number,
        (r.period_month ?? r.expense_date).slice(0, 7),
        r.amount,
        EXPENSE_STATUS[r.status as ExpenseStatus]?.label ?? r.status,
        formatDate(r.created_at),
        r.approved_at ? formatDate(r.approved_at) : "—",
      ]);
    }
    downloadCsv(`motion-it-bd-${meta.label.toLowerCase().replace(/\s+/g, "-")}`, headers, body);
    void logActivity({
      action: "export",
      entityType: "report",
      entityLabel: `${generated.reportNumber} · ${meta.label}`,
      metadata: { format: "csv" },
    });
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Fixed Cost Reports"
        description="Finance-grade recurring cost reports. Summary totals are approved spend in BDT."
        actions={
          <Button variant="outline" asChild>
            <Link to="/fixed-costs">
              <ArrowLeft className="h-4 w-4" />
              Fixed Costs
            </Link>
          </Button>
        }
      />

      <Card className="no-print">
        <CardHeader>
          <CardTitle className="text-base">Build a report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Report type</Label>
              <Select value={type} onValueChange={(v) => setType(v as FcReportType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{meta.description}</p>
            </div>
            <div className="space-y-2">
              <Label>Date range</Label>
              <DateRangeFilter preset={preset} range={range} onChange={(p, r) => { setPreset(p); setRange(r); }} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleGenerate} disabled={generating} className="bg-brand-gradient text-primary-foreground">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate Report
            </Button>
            {generated && (
              <>
                <Button variant="outline" onClick={print}><Printer className="h-4 w-4" />Print</Button>
                <Button variant="outline" onClick={print}><FileDown className="h-4 w-4" />Export PDF</Button>
                <Button variant="outline" onClick={handleCsv}><FileSpreadsheet className="h-4 w-4" />Export CSV</Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {generated && (
        <ReportDocument
          reportName={REPORT_TYPES.find((t) => t.value === generated.type)!.label}
          reportNumber={generated.reportNumber}
          generatedAt={generated.generatedAt}
          generatedBy={generated.generatedBy}
          dateRangeLabel={generated.rangeLabel}
        >
          <FixedCostReportSwitch report={generated} />
        </ReportDocument>
      )}
    </div>
  );
}

function FixedCostReportSwitch({ report }: { report: Generated }) {
  const { type, approved, all, templates, outstanding, payments } = report;
  const name = useMemo(() => {
    const m = new Map(templates.map((t) => [t.id, t.name]));
    return (id: string | null) => (id ? m.get(id) ?? "Fixed Cost" : "Fixed Cost");
  }, [templates]);
  const top = useMemo(() => buildTopFixedCosts(approved, name), [approved, name]);
  const monthly = useMemo(() => buildMonthlyFixedCost(approved), [approved]);
  const grand = sumAmount(approved);

  const isEmpty =
    type === "approval"
      ? all.length === 0
      : type === "outstanding"
        ? outstanding.length === 0
        : type === "payments"
          ? payments.length === 0
          : approved.length === 0;
  if (isEmpty) return <EmptyReportNote />;

  if (type === "outstanding") {
    const totTotal = outstanding.reduce((a, r) => a + Number(r.amount || 0), 0);
    const totPaid = outstanding.reduce((a, r) => a + Number(r.fc_paid_amount || 0), 0);
    const totRemain = outstanding.reduce((a, r) => a + remainingOf(r), 0);
    return (
      <table className="report-table w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-border">
            <th className={th}>Fixed Cost</th>
            <th className={th}>Number</th>
            <th className={th}>Month</th>
            <th className={th + " text-right"}>Total</th>
            <th className={th + " text-right"}>Paid</th>
            <th className={th + " text-right"}>Remaining</th>
            <th className={th}>Status</th>
          </tr>
        </thead>
        <tbody>
          {outstanding.map((r) => (
            <tr key={r.id} className="border-b border-border break-inside-avoid">
              <td className={td}>{name(r.fixed_cost_template_id)}</td>
              <td className={td}>{r.expense_number}</td>
              <td className={td}>{(r.period_month ?? r.expense_date).slice(0, 7)}</td>
              <td className={num}>{formatCurrency(r.amount)}</td>
              <td className={num}>{formatCurrency(r.fc_paid_amount)}</td>
              <td className={num}>{formatCurrency(remainingOf(r))}</td>
              <td className={td}>{SETTLEMENT_STATUS[settlementOf(r)].label}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-foreground/70 font-semibold">
            <td className={td + " font-semibold"} colSpan={3}>Total ({outstanding.length} records)</td>
            <td className={num + " font-semibold"}>{formatCurrency(totTotal)}</td>
            <td className={num + " font-semibold"}>{formatCurrency(totPaid)}</td>
            <td className={num + " font-semibold"}>{formatCurrency(totRemain)}</td>
            <td className={td} />
          </tr>
        </tfoot>
      </table>
    );
  }

  if (type === "payments") {
    const totPay = payments.reduce((a, p) => a + Number(p.amount || 0), 0);
    return (
      <table className="report-table w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-border">
            <th className={th}>Date</th>
            <th className={th}>Fixed Cost</th>
            <th className={th}>Number</th>
            <th className={th}>Reference</th>
            <th className={th + " text-right"}>Amount (BDT)</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id} className="border-b border-border break-inside-avoid">
              <td className={td}>{formatDate(p.payment_date)}</td>
              <td className={td}>{name(p.template_id)}</td>
              <td className={td}>{p.expense_number}</td>
              <td className={td}>{p.reference_number ?? "—"}</td>
              <td className={num}>{formatCurrency(p.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-foreground/70 font-semibold">
            <td className={td + " font-semibold"} colSpan={4}>Total ({payments.length} payments)</td>
            <td className={num + " font-semibold"}>{formatCurrency(totPay)}</td>
          </tr>
        </tfoot>
      </table>
    );
  }

  if (type === "summary") {
    return (
      <table className="report-table w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-border">
            <th className={th}>Fixed Cost</th>
            <th className={th + " text-right"}>Records</th>
            <th className={th + " text-right"}>Total (BDT)</th>
            <th className={th + " text-right"}>% of total</th>
          </tr>
        </thead>
        <tbody>
          {top.rows.map((r) => (
            <tr key={r.id ?? "none"} className="border-b border-border">
              <td className={td}>{r.name}</td>
              <td className={num}>{r.count}</td>
              <td className={num}>{formatCurrency(r.total)}</td>
              <td className={num}>{r.percentage.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-foreground/70 font-semibold">
            <td className={td + " font-semibold"}>Grand Total</td>
            <td className={num + " font-semibold"}>{approved.length}</td>
            <td className={num + " font-semibold"}>{formatCurrency(grand)}</td>
            <td className={num + " font-semibold"}>100.0%</td>
          </tr>
        </tfoot>
      </table>
    );
  }

  if (type === "monthly") {
    return (
      <table className="report-table w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-border">
            <th className={th}>Month</th>
            <th className={th + " text-right"}>Total (BDT)</th>
          </tr>
        </thead>
        <tbody>
          {monthly.map((m) => (
            <tr key={m.key} className="border-b border-border">
              <td className={td}>{m.label}</td>
              <td className={num}>{formatCurrency(m.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-foreground/70 font-semibold">
            <td className={td + " font-semibold"}>Grand Total</td>
            <td className={num + " font-semibold"}>{formatCurrency(grand)}</td>
          </tr>
        </tfoot>
      </table>
    );
  }

  const approvalGrand = sumAmount(all);
  return (
    <table className="report-table w-full border-collapse">
      <thead>
        <tr className="border-b-2 border-border">
          <th className={th}>Fixed Cost</th>
          <th className={th}>Number</th>
          <th className={th}>Month</th>
          <th className={th + " text-right"}>Amount (BDT)</th>
          <th className={th}>Status</th>
          <th className={th}>Approved</th>
        </tr>
      </thead>
      <tbody>
        {all.map((r) => (
          <tr key={r.id} className="border-b border-border break-inside-avoid">
            <td className={td}>{name(r.fixed_cost_template_id)}</td>
            <td className={td}>{r.expense_number}</td>
            <td className={td}>{(r.period_month ?? r.expense_date).slice(0, 7)}</td>
            <td className={num}>{formatCurrency(r.amount)}</td>
            <td className={td}>{EXPENSE_STATUS[r.status as ExpenseStatus]?.label ?? r.status}</td>
            <td className={td}>{r.approved_at ? formatDate(r.approved_at) : "—"}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-foreground/70 font-semibold">
          <td className={td + " font-semibold"} colSpan={3}>Total ({all.length} records)</td>
          <td className={num + " font-semibold"}>{formatCurrency(approvalGrand)}</td>
          <td className={td} colSpan={2} />
        </tr>
      </tfoot>
    </table>
  );
}
