import { createFileRoute } from "@/lib/router"
import { createFileRoute, Link } from "@/lib/router";
import { useEffect, useState } from "react";
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
import {
  ReasonSummaryBody,
  ReturnLedgerBody,
  MonthlyBody,
  LossAnalysisBody,
} from "@/components/loss/LossReportBodies";
import { useAuth } from "@/lib/auth-context";
import {
  DEFAULT_PRESET,
  formatRangeLabel,
  resolveRange,
  type DateRange,
  type RangePreset,
} from "@/lib/analytics";
import { formatDateTime } from "@/lib/expenses";
import { logActivity } from "@/lib/audit";
import { logReportExport } from "@/lib/reports";
import { downloadCsv } from "@/lib/report-csv";
import {
  fetchApprovedReturns,
  fetchReturnReasons,
  buildReasonSummary,
  buildMonthly,
  returnTotals,
  formatTk,
  type ReturnRecord,
  type ReturnReason,
} from "@/lib/loss";

type RType = "return_summary" | "return_reason" | "return_monthly" | "return_loss";

const TYPES: { value: RType; label: string; description: string }[] = [
  { value: "return_summary", label: "Return Summary Report", description: "Approved returns ledger with loss totals." },
  { value: "return_reason", label: "Return Reason Report", description: "Net loss grouped by return reason." },
  { value: "return_monthly", label: "Monthly Return Report", description: "Net return loss per month." },
  { value: "return_loss", label: "Loss Analysis Report", description: "Loss vs recoverable breakdown." },
];

export const Route = createFileRoute("/_authenticated/returns/reports")({
  head: () => ({ meta: [{ title: "Return Reports — Motion IT BD" }] }),
  component: ReturnReportsPage,
});

interface Generated {
  type: RType;
  rows: ReturnRecord[];
  reasons: ReturnReason[];
  reportNumber: string;
  generatedAt: string;
  generatedBy: string;
  rangeLabel: string;
}

function ReturnReportsPage() {
  const { canAccessModule, profile } = useAuth();
  const [reportType, setReportType] = useState<RType>("return_summary");
  const [preset, setPreset] = useState<RangePreset>(DEFAULT_PRESET);
  const [range, setRange] = useState<DateRange>(resolveRange(DEFAULT_PRESET));
  const [reasons, setReasons] = useState<ReturnReason[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<Generated | null>(null);

  useEffect(() => {
    fetchReturnReasons(true).then(setReasons).catch(() => setReasons([]));
  }, []);
  useEffect(() => setGenerated(null), [reportType]);

  if (!canAccessModule("returns")) {
    return (
      <div className="space-y-8">
        <PageHeader title="Return Reports" />
        <NoAccess />
      </div>
    );
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const rows = await fetchApprovedReturns(range);
      const totals = returnTotals(rows);
      const logged = await logReportExport({
        reportType,
        title: TYPES.find((t) => t.value === reportType)!.label,
        rangeFrom: range.from,
        rangeTo: range.to,
        filters: { preset },
        expenseCount: rows.length,
        totalAmount: totals.netLoss,
      });
      void logActivity({
        action: "export",
        entityType: "report",
        entityLabel: `${logged.report_number} · ${TYPES.find((t) => t.value === reportType)!.label}`,
        metadata: { count: rows.length, total: totals.netLoss },
      });
      setGenerated({
        type: reportType,
        rows,
        reasons,
        reportNumber: logged.report_number,
        generatedAt: formatDateTime(logged.created_at),
        generatedBy: profile?.full_name?.trim() || profile?.email || "—",
        rangeLabel: formatRangeLabel(range),
      });
      toast.success(`Report ${logged.report_number} generated and archived.`);
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
    const { type, rows, reasons: rReasons } = generated;
    let headers: string[] = [];
    let body: (string | number)[][] = [];
    if (type === "return_reason") {
      const { rows: rs, grandNetLoss } = buildReasonSummary(rows, rReasons);
      headers = ["Reason", "Count", "Loss", "Recoverable", "Net Loss", "% of total"];
      body = rs.map((r) => [r.name, r.count, r.loss, r.recoverable, r.netLoss, `${r.percentage.toFixed(1)}%`]);
      body.push(["Grand Total", rows.length, "", "", grandNetLoss, "100.0%"]);
    } else if (type === "return_monthly") {
      const points = buildMonthly(rows, (r) => r.return_date, (r) => r.net_loss_amount);
      headers = ["Month", "Net Return Loss"];
      body = points.map((p) => [p.label, p.total]);
    } else if (type === "return_loss") {
      const t = returnTotals(rows);
      headers = ["Metric", "Amount"];
      body = [
        ["Total loss", t.loss],
        ["Recoverable", t.recoverable],
        ["Net loss", t.netLoss],
      ];
    } else {
      const reasonName = new Map(rReasons.map((r) => [r.id, r.name]));
      headers = ["Return No.", "Date", "Reason", "Product", "Quantity", "Loss", "Recoverable", "Net Loss"];
      body = rows.map((r) => [
        r.return_number,
        r.return_date,
        r.reason_id ? reasonName.get(r.reason_id) ?? "" : "",
        r.product_name,
        r.quantity,
        r.loss_amount,
        r.recoverable_amount,
        r.net_loss_amount,
      ]);
      const t = returnTotals(rows);
      body.push(["Grand Total", "", "", "", "", t.loss, t.recoverable, t.netLoss]);
    }
    downloadCsv(
      `motion-it-bd-${TYPES.find((t) => t.value === type)!.label.toLowerCase().replace(/\s+/g, "-")}`,
      headers,
      body,
    );
    void logActivity({
      action: "export",
      entityType: "report",
      entityLabel: `${generated.reportNumber} · ${TYPES.find((t) => t.value === type)!.label}`,
      metadata: { format: "csv" },
    });
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Return Reports"
        description="Branded, approval-only return and loss reports."
        actions={
          <Button variant="outline" asChild>
            <Link to="/returns">
              <ArrowLeft className="h-4 w-4" />
              Returns
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
              <Select value={reportType} onValueChange={(v) => setReportType(v as RType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {TYPES.find((t) => t.value === reportType)?.description}
              </p>
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
                <Button variant="outline" onClick={print}>
                  <Printer className="h-4 w-4" />
                  Print
                </Button>
                <Button variant="outline" onClick={print}>
                  <FileDown className="h-4 w-4" />
                  Export PDF
                </Button>
                <Button variant="outline" onClick={handleCsv}>
                  <FileSpreadsheet className="h-4 w-4" />
                  Export CSV
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {generated && (
        <ReportDocument
          reportName={TYPES.find((t) => t.value === generated.type)!.label}
          reportNumber={generated.reportNumber}
          generatedAt={generated.generatedAt}
          generatedBy={generated.generatedBy}
          dateRangeLabel={generated.rangeLabel}
        >
          <ReturnReportSwitch report={generated} />
        </ReportDocument>
      )}
    </div>
  );
}

function ReturnReportSwitch({ report }: { report: Generated }) {
  const { type, rows, reasons } = report;
  if (type === "return_reason") {
    const { rows: rs, grandNetLoss } = buildReasonSummary(rows, reasons);
    return <ReasonSummaryBody rows={rs} grandNetLoss={grandNetLoss} />;
  }
  if (type === "return_monthly") {
    const points = buildMonthly(rows, (r) => r.return_date, (r) => r.net_loss_amount);
    return <MonthlyBody points={points} label="Net Return Loss" />;
  }
  if (type === "return_loss") {
    const t = returnTotals(rows);
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Total loss" value={formatTk(t.loss)} />
          <Stat label="Recoverable" value={formatTk(t.recoverable)} />
          <Stat label="Net loss" value={formatTk(t.netLoss)} />
        </div>
        <LossAnalysisBody returnNetLoss={t.netLoss} damageValue={0} />
      </div>
    );
  }
  return <ReturnLedgerBody rows={rows} reasons={reasons} />;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
