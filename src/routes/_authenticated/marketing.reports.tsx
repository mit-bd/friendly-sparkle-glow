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
import { formatDateTime } from "@/lib/expenses";
import { logActivity } from "@/lib/audit";
import { logReportExport } from "@/lib/reports";
import { downloadCsv } from "@/lib/report-csv";
import {
  fetchApprovedMarketing,
  fetchPlatforms,
  buildPlatformSummary,
  buildCampaignSummary,
  buildCurrencySummary,
  formatBDT,
  formatMoney,
  sumBDT,
  type MarketingExpense,
  type MarketingPlatform,
} from "@/lib/marketing";

export const Route = createFileRoute("/_authenticated/marketing/reports")({
  head: () => ({ meta: [{ title: "Marketing Reports — Motion IT BD" }] }),
  component: MarketingReports,
});

type MkReportType = "summary" | "platform" | "campaign" | "currency";

const REPORT_TYPES: { value: MkReportType; label: string; description: string }[] = [
  { value: "summary", label: "Marketing Summary Report", description: "Platform-wise spend with share of total." },
  { value: "platform", label: "Platform Report", description: "Each platform with currencies, costs and converted BDT." },
  { value: "campaign", label: "Campaign Report", description: "Spend grouped by campaign across platforms." },
  { value: "currency", label: "Currency Conversion Report", description: "Original vs converted BDT per currency." },
];

const th = "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
const td = "px-3 py-2 text-sm text-foreground align-top";
const num = "px-3 py-2 text-sm text-foreground text-right tabular-nums align-top";

interface Generated {
  type: MkReportType;
  rows: MarketingExpense[];
  platforms: MarketingPlatform[];
  reportNumber: string;
  generatedAt: string;
  generatedBy: string;
  rangeLabel: string;
}

function MarketingReports() {
  const { canAccessModule, can, isAdmin, profile } = useAuth();
  const canExport = isAdmin || can("reports", "view") || can("reports", "export");

  const [type, setType] = useState<MkReportType>("summary");
  const [preset, setPreset] = useState<RangePreset>(DEFAULT_PRESET);
  const [range, setRange] = useState<DateRange>(resolveRange(DEFAULT_PRESET));
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<Generated | null>(null);

  useEffect(() => setGenerated(null), [type]);

  if (!canAccessModule("marketing")) {
    return (
      <div className="space-y-8">
        <PageHeader title="Marketing Reports" />
        <NoAccess />
      </div>
    );
  }

  const meta = REPORT_TYPES.find((t) => t.value === type)!;

  async function handleGenerate() {
    setGenerating(true);
    try {
      const [rows, platforms] = await Promise.all([
        fetchApprovedMarketing(range),
        fetchPlatforms(true),
      ]);
      const grand = sumBDT(rows);
      let reportNumber = "—";
      let createdAt = new Date().toISOString();
      if (canExport) {
        try {
          const logged = await logReportExport({
            reportType: `marketing_${type}`,
            title: `${meta.label} (${formatRangeLabel(range)})`,
            rangeFrom: range.from,
            rangeTo: range.to,
            filters: { module: "marketing", report: type, preset },
            expenseCount: rows.length,
            totalAmount: grand,
          });
          reportNumber = logged.report_number;
          createdAt = logged.created_at;
          void logActivity({
            action: "export",
            entityType: "report",
            entityLabel: `${reportNumber} · ${meta.label}`,
            metadata: { count: rows.length, total: grand },
          });
        } catch {
          /* archive is best-effort */
        }
      }
      setGenerated({
        type,
        rows,
        platforms,
        reportNumber,
        generatedAt: formatDateTime(createdAt),
        generatedBy: profile?.full_name?.trim() || profile?.email || "—",
        rangeLabel: formatRangeLabel(range),
      });
      toast.success(
        reportNumber === "—" ? "Report generated." : `Report ${reportNumber} generated and archived.`,
      );
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
    const { rows, platforms } = generated;
    const grand = sumBDT(rows);
    let headers: string[] = [];
    let body: (string | number)[][] = [];
    if (type === "summary" || type === "platform") {
      const ps = buildPlatformSummary(rows, platforms);
      headers = ["Platform", "Currencies", "Costs", "Converted BDT", "% of total"];
      body = ps.rows.map((p) => [
        p.name,
        p.currencies.join(" / "),
        p.count,
        p.total,
        `${p.percentage.toFixed(1)}%`,
      ]);
      body.push(["Grand Total", "", rows.length, grand, "100.0%"]);
    } else if (type === "campaign") {
      const cs = buildCampaignSummary(rows, platforms);
      headers = ["Campaign", "Platform", "Costs", "Converted BDT", "% of total"];
      body = cs.map((c) => [c.name, c.platformName, c.count, c.total, `${c.percentage.toFixed(1)}%`]);
      body.push(["Grand Total", "", rows.length, grand, "100.0%"]);
    } else {
      const cur = buildCurrencySummary(rows);
      headers = ["Currency", "Costs", "Original total", "Avg rate", "Converted BDT", "% of total"];
      body = cur.map((c) => [
        c.currency,
        c.count,
        c.originalTotal,
        c.avgRate.toFixed(4),
        c.convertedTotal,
        `${c.percentage.toFixed(1)}%`,
      ]);
      body.push(["Grand Total (BDT)", rows.length, "", "", grand, "100.0%"]);
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
        title="Marketing Reports"
        description="Finance-grade marketing reports. Every total is approved spend in BDT."
        actions={
          <Button variant="outline" asChild>
            <Link to="/marketing">
              <ArrowLeft className="h-4 w-4" />
              Marketing
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
              <Select value={type} onValueChange={(v) => setType(v as MkReportType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
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
          reportName={REPORT_TYPES.find((t) => t.value === generated.type)!.label}
          reportNumber={generated.reportNumber}
          generatedAt={generated.generatedAt}
          generatedBy={generated.generatedBy}
          dateRangeLabel={generated.rangeLabel}
        >
          <MarketingReportSwitch report={generated} />
        </ReportDocument>
      )}
    </div>
  );
}

function MarketingReportSwitch({ report }: { report: Generated }) {
  const { type, rows, platforms } = report;
  const platformSummary = useMemo(() => buildPlatformSummary(rows, platforms), [rows, platforms]);
  const campaigns = useMemo(() => buildCampaignSummary(rows, platforms), [rows, platforms]);
  const currencies = useMemo(() => buildCurrencySummary(rows), [rows]);
  const grand = sumBDT(rows);

  if (rows.length === 0) return <EmptyReportNote />;

  if (type === "summary") {
    return (
      <table className="report-table w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-border">
            <th className={th}>Platform</th>
            <th className={th + " text-right"}>Costs</th>
            <th className={th + " text-right"}>Converted BDT</th>
            <th className={th + " text-right"}>% of total</th>
          </tr>
        </thead>
        <tbody>
          {platformSummary.rows.map((p) => (
            <tr key={p.id ?? "none"} className="border-b border-border">
              <td className={td}>{p.name}</td>
              <td className={num}>{p.count}</td>
              <td className={num}>{formatBDT(p.total)}</td>
              <td className={num}>{p.percentage.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-foreground/70 font-semibold">
            <td className={td + " font-semibold"}>Grand Total</td>
            <td className={num + " font-semibold"}>{rows.length}</td>
            <td className={num + " font-semibold"}>{formatBDT(grand)}</td>
            <td className={num + " font-semibold"}>100.0%</td>
          </tr>
        </tfoot>
      </table>
    );
  }

  if (type === "platform") {
    return (
      <table className="report-table w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-border">
            <th className={th}>Platform</th>
            <th className={th}>Currencies</th>
            <th className={th + " text-right"}>Costs</th>
            <th className={th + " text-right"}>Converted BDT</th>
            <th className={th + " text-right"}>% of total</th>
          </tr>
        </thead>
        <tbody>
          {platformSummary.rows.map((p) => (
            <tr key={p.id ?? "none"} className="border-b border-border">
              <td className={td}>{p.name}</td>
              <td className={td}>{p.currencies.join(", ")}</td>
              <td className={num}>{p.count}</td>
              <td className={num}>{formatBDT(p.total)}</td>
              <td className={num}>{p.percentage.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-foreground/70 font-semibold">
            <td className={td + " font-semibold"} colSpan={3}>Grand Total</td>
            <td className={num + " font-semibold"}>{formatBDT(grand)}</td>
            <td className={num + " font-semibold"}>100.0%</td>
          </tr>
        </tfoot>
      </table>
    );
  }

  if (type === "campaign") {
    return (
      <table className="report-table w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-border">
            <th className={th}>Campaign</th>
            <th className={th}>Platform</th>
            <th className={th + " text-right"}>Costs</th>
            <th className={th + " text-right"}>Converted BDT</th>
            <th className={th + " text-right"}>% of total</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c, i) => (
            <tr key={`${c.platformId}-${c.name}-${i}`} className="border-b border-border break-inside-avoid">
              <td className={td}>{c.name}</td>
              <td className={td}>{c.platformName}</td>
              <td className={num}>{c.count}</td>
              <td className={num}>{formatBDT(c.total)}</td>
              <td className={num}>{c.percentage.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-foreground/70 font-semibold">
            <td className={td + " font-semibold"} colSpan={3}>Grand Total</td>
            <td className={num + " font-semibold"}>{formatBDT(grand)}</td>
            <td className={num + " font-semibold"}>100.0%</td>
          </tr>
        </tfoot>
      </table>
    );
  }

  return (
    <table className="report-table w-full border-collapse">
      <thead>
        <tr className="border-b-2 border-border">
          <th className={th}>Currency</th>
          <th className={th + " text-right"}>Costs</th>
          <th className={th + " text-right"}>Original total</th>
          <th className={th + " text-right"}>Avg rate</th>
          <th className={th + " text-right"}>Converted BDT</th>
          <th className={th + " text-right"}>% of total</th>
        </tr>
      </thead>
      <tbody>
        {currencies.map((c) => (
          <tr key={c.currency} className="border-b border-border">
            <td className={td}>{c.currency}</td>
            <td className={num}>{c.count}</td>
            <td className={num}>{formatMoney(c.originalTotal, c.currency)}</td>
            <td className={num}>{c.avgRate.toFixed(4)}</td>
            <td className={num}>{formatBDT(c.convertedTotal)}</td>
            <td className={num}>{c.percentage.toFixed(1)}%</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-foreground/70 font-semibold">
          <td className={td + " font-semibold"} colSpan={4}>Grand Total (BDT)</td>
          <td className={num + " font-semibold"}>{formatBDT(grand)}</td>
          <td className={num + " font-semibold"}>100.0%</td>
        </tr>
      </tfoot>
    </table>
  );
}
