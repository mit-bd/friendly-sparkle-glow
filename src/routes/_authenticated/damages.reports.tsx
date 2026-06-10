import { createFileRoute } from '@tanstack/react-router'
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
import { TypeSummaryBody, DamageLedgerBody, MonthlyBody } from "@/components/loss/LossReportBodies";
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
  fetchApprovedDamages,
  fetchDamageTypes,
  buildTypeSummary,
  buildMonthly,
  sumBy,
  type DamageRecord,
  type DamageType,
} from "@/lib/loss";

type RType = "damage_summary" | "damage_type" | "damage_monthly";

const TYPES: { value: RType; label: string; description: string }[] = [
  { value: "damage_summary", label: "Damage Summary Report", description: "Approved damages ledger with totals." },
  { value: "damage_type", label: "Damage Type Report", description: "Damage value grouped by type." },
  { value: "damage_monthly", label: "Monthly Damage Report", description: "Damage value per month." },
];

export const Route = createFileRoute("/_authenticated/damages/reports")({
  head: () => ({ meta: [{ title: "Damage Reports — Motion IT BD" }] }),
  component: DamageReportsPage,
});

interface Generated {
  type: RType;
  rows: DamageRecord[];
  types: DamageType[];
  reportNumber: string;
  generatedAt: string;
  generatedBy: string;
  rangeLabel: string;
}

function DamageReportsPage() {
  const { canAccessModule, profile } = useAuth();
  const [reportType, setReportType] = useState<RType>("damage_summary");
  const [preset, setPreset] = useState<RangePreset>(DEFAULT_PRESET);
  const [range, setRange] = useState<DateRange>(resolveRange(DEFAULT_PRESET));
  const [types, setTypes] = useState<DamageType[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<Generated | null>(null);

  useEffect(() => {
    fetchDamageTypes(true).then(setTypes).catch(() => setTypes([]));
  }, []);
  useEffect(() => setGenerated(null), [reportType]);

  if (!canAccessModule("damages")) {
    return (
      <div className="space-y-8">
        <PageHeader title="Damage Reports" />
        <NoAccess />
      </div>
    );
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const rows = await fetchApprovedDamages(range);
      const total = sumBy(rows, (r) => r.damage_value);
      const logged = await logReportExport({
        reportType,
        title: TYPES.find((t) => t.value === reportType)!.label,
        rangeFrom: range.from,
        rangeTo: range.to,
        filters: { preset },
        expenseCount: rows.length,
        totalAmount: total,
      });
      void logActivity({
        action: "export",
        entityType: "report",
        entityLabel: `${logged.report_number} · ${TYPES.find((t) => t.value === reportType)!.label}`,
        metadata: { count: rows.length, total },
      });
      setGenerated({
        type: reportType,
        rows,
        types,
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
    const { type, rows, types: dtypes } = generated;
    let headers: string[] = [];
    let body: (string | number)[][] = [];
    if (type === "damage_type") {
      const { rows: ts, grandValue } = buildTypeSummary(rows, dtypes);
      headers = ["Damage Type", "Count", "Value", "% of total"];
      body = ts.map((r) => [r.name, r.count, r.value, `${r.percentage.toFixed(1)}%`]);
      body.push(["Grand Total", rows.length, grandValue, "100.0%"]);
    } else if (type === "damage_monthly") {
      const points = buildMonthly(rows, (r) => r.damage_date, (r) => r.damage_value);
      headers = ["Month", "Damage Value"];
      body = points.map((p) => [p.label, p.total]);
    } else {
      const typeName = new Map(dtypes.map((t) => [t.id, t.name]));
      headers = ["Damage No.", "Date", "Type", "Product", "Quantity", "Damage Value"];
      body = rows.map((r) => [
        r.damage_number,
        r.damage_date,
        r.type_id ? typeName.get(r.type_id) ?? "" : "",
        r.product_name,
        r.quantity,
        r.damage_value,
      ]);
      body.push(["Grand Total", "", "", "", "", sumBy(rows, (r) => r.damage_value)]);
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
        title="Damage Reports"
        description="Branded, approval-only damage and loss reports."
        actions={
          <Button variant="outline" asChild>
            <Link to="/damages">
              <ArrowLeft className="h-4 w-4" />
              Damages
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
          <DamageReportSwitch report={generated} />
        </ReportDocument>
      )}
    </div>
  );
}

function DamageReportSwitch({ report }: { report: Generated }) {
  const { type, rows, types } = report;
  if (type === "damage_type") {
    const { rows: ts, grandValue } = buildTypeSummary(rows, types);
    return <TypeSummaryBody rows={ts} grandValue={grandValue} />;
  }
  if (type === "damage_monthly") {
    const points = buildMonthly(rows, (r) => r.damage_date, (r) => r.damage_value);
    return <MonthlyBody points={points} label="Damage Value" />;
  }
  return <DamageLedgerBody rows={rows} types={types} />;
}
