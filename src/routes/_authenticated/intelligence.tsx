import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileDown, FileSpreadsheet, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { Button } from "@/components/ui/button";
import { DateRangeFilter } from "@/components/analytics/DateRangeFilter";
import { useAuth } from "@/lib/auth-context";
import { useTaxonomy } from "@/hooks/use-analytics";
import {
  DEFAULT_PRESET,
  formatRangeLabel,
  resolveRange,
  type DateRange,
  type RangePreset,
} from "@/lib/analytics";
import {
  useIntelData,
  useIntelHistory,
  useIntelMarketing,
  useIntelPrevious,
} from "@/hooks/use-intelligence";
import {
  buildComposition,
  buildCategoryPerformance,
  buildFixedVariableSeries,
  buildInsights,
  buildKpis,
  buildMetricTrends,
  buildSubcategoryPerformance,
  buildTotals,
  computeHealthScore,
  detectAnomalies,
  buildSeries,
  type Granularity,
  type IntelDataset,
} from "@/lib/intelligence";
import { buildCombinedMonthly, type CombinedMonthly } from "@/lib/loss";
import { fetchAllPlatforms } from "@/lib/marketing";
import { logReportExport } from "@/lib/reports";
import { logActivity } from "@/lib/audit";
import { formatCurrency, formatDateTime } from "@/lib/expenses";
import { downloadCsv } from "@/lib/report-csv";

import { KpiGrid } from "@/components/intelligence/KpiGrid";
import { CompositionCharts } from "@/components/intelligence/CompositionCharts";
import { MomTrends } from "@/components/intelligence/MomTrends";
import { CategoryPerformance } from "@/components/intelligence/CategoryPerformance";
import { SubcategoryIntel } from "@/components/intelligence/SubcategoryIntel";
import { FixedVsVariable } from "@/components/intelligence/FixedVsVariable";
import { LossImpact } from "@/components/intelligence/LossImpact";
import { MarketingIntel } from "@/components/intelligence/MarketingIntel";
import { AnomalyPanel } from "@/components/intelligence/AnomalyPanel";
import { ManagementSummary } from "@/components/intelligence/ManagementSummary";
import { HealthScoreCard } from "@/components/intelligence/HealthScoreCard";
import {
  IntelReportDocument,
  type IntelReportModel,
} from "@/components/intelligence/IntelReportDocument";

export const Route = createFileRoute("/_authenticated/intelligence")({
  head: () => ({ meta: [{ title: "Executive Analytics — Motion IT BD" }] }),
  component: IntelligencePage,
});

const EMPTY_DATASET: IntelDataset = { expenses: [], returns: [], damages: [] };

function IntelligencePage() {
  const { canAccessModule, can, profile } = useAuth();
  const [preset, setPreset] = useState<RangePreset>(DEFAULT_PRESET);
  const [range, setRange] = useState<DateRange>(resolveRange(DEFAULT_PRESET));
  const [granularity, setGranularity] = useState<Granularity>("monthly");
  const [report, setReport] = useState<IntelReportModel | null>(null);
  const [exporting, setExporting] = useState(false);

  const taxonomy = useTaxonomy();
  const current = useIntelData(range);
  const previous = useIntelPrevious(range);
  const history = useIntelHistory(12);
  const marketing = useIntelMarketing(range);
  const platformsQ = useQuery({
    queryKey: ["intel", "platforms"],
    queryFn: fetchAllPlatforms,
    staleTime: 5 * 60_000,
  });

  const canExport = can("reports", "export");

  const categories = taxonomy.data?.categories ?? [];
  const subcategories = taxonomy.data?.subcategories ?? [];
  const curData = current.data ?? EMPTY_DATASET;
  const prevData = previous.data ?? EMPTY_DATASET;
  const histData = history.data ?? EMPTY_DATASET;

  const loading = current.isLoading || taxonomy.isLoading;

  const totals = useMemo(() => buildTotals(curData, categories), [curData, categories]);
  const prevTotals = useMemo(() => buildTotals(prevData, categories), [prevData, categories]);
  const kpis = useMemo(() => buildKpis(totals, prevTotals), [totals, prevTotals]);
  const composition = useMemo(() => buildComposition(totals), [totals]);

  const trends = useMemo(
    () => buildMetricTrends(histData, categories, granularity),
    [histData, categories, granularity],
  );
  const categoryPerf = useMemo(
    () => buildCategoryPerformance(curData.expenses, prevData.expenses, categories),
    [curData.expenses, prevData.expenses, categories],
  );
  const subcategoryPerf = useMemo(
    () => buildSubcategoryPerformance(curData.expenses, prevData.expenses, subcategories, categories),
    [curData.expenses, prevData.expenses, subcategories, categories],
  );
  const fixedVarSeries = useMemo(
    () => buildFixedVariableSeries(histData.expenses, categories, "monthly"),
    [histData.expenses, categories],
  );
  const lossMonthly: CombinedMonthly[] = useMemo(
    () => buildCombinedMonthly(histData.returns, histData.damages),
    [histData.returns, histData.damages],
  );
  const anomalies = useMemo(
    () => detectAnomalies(histData, categories, subcategories),
    [histData, categories, subcategories],
  );
  const insights = useMemo(() => buildInsights(kpis, anomalies), [kpis, anomalies]);
  const monthlyTotals = useMemo(
    () => buildSeries(histData.expenses, (e) => e.expense_date, (e) => Number(e.amount || 0), "monthly"),
    [histData.expenses],
  );
  const health = useMemo(
    () => computeHealthScore(totals, kpis, monthlyTotals, composition),
    [totals, kpis, monthlyTotals, composition],
  );

  if (!canAccessModule("reports") && !canAccessModule("dashboard")) {
    return (
      <div className="space-y-8">
        <PageHeader title="Executive Analytics" />
        <NoAccess />
      </div>
    );
  }

  function buildModel(reportNumber: string, generatedAt: string): IntelReportModel {
    return {
      reportNumber,
      generatedAt,
      generatedBy: profile?.full_name?.trim() || profile?.email || "—",
      rangeLabel: formatRangeLabel(range),
      totals,
      kpis,
      composition,
      categoryPerf,
      anomalies,
      insights,
      health,
    };
  }

  async function handlePrintPdf(kind: "print" | "pdf") {
    setExporting(true);
    try {
      const logged = await logReportExport({
        reportType: "executive_analytics",
        title: "Executive Expense Intelligence Report",
        rangeFrom: range.from,
        rangeTo: range.to,
        filters: { preset },
        expenseCount: curData.expenses.length,
        totalAmount: totals.grandOutflow,
      });
      setReport(buildModel(logged.report_number, formatDateTime(logged.created_at)));
      void logActivity({
        action: kind === "pdf" ? "export" : "print",
        entityType: "report",
        entityLabel: `${logged.report_number} · Executive Analytics`,
        metadata: { format: kind === "pdf" ? "pdf" : "print", total: totals.grandOutflow },
      });
      // Wait for the print sheet to render before invoking the dialog.
      setTimeout(() => {
        if (kind === "pdf") toast.message("Use the print dialog's “Save as PDF” to export.");
        window.print();
      }, 120);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate analytics report.");
    } finally {
      setExporting(false);
    }
  }

  function handleCsv() {
    const headers = ["Section", "Item", "Value", "Detail"];
    const rows: (string | number)[][] = [];
    kpis.forEach((k) =>
      rows.push(["KPI", k.label, k.current, `Change ${k.changePct.toFixed(1)}% (prev ${k.previous})`]),
    );
    composition.forEach((c) =>
      rows.push(["Composition", c.name, c.value, `${c.percentage.toFixed(1)}%`]),
    );
    categoryPerf.slice(0, 15).forEach((c) =>
      rows.push(["Category", c.name, c.total, `Growth ${c.growthPct.toFixed(1)}%`]),
    );
    anomalies.forEach((a) =>
      rows.push(["Anomaly", `${a.label} (${a.scope})`, a.current, `${a.direction} ${a.changePct.toFixed(1)}% vs avg ${a.average.toFixed(0)}`]),
    );
    rows.push(["Health", "Overall Score", health.score, health.band]);
    downloadCsv("motion-it-bd-executive-analytics", headers, rows);
    void logActivity({
      action: "export",
      entityType: "report",
      entityLabel: "Executive Analytics",
      metadata: { format: "csv", total: totals.grandOutflow },
    });
    toast.success("Analytics exported to CSV.");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Executive Analytics"
        description="Management decision-support: KPIs, composition, trends, anomalies and health — approved data only."
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between no-print">
        <DateRangeFilter
          preset={preset}
          range={range}
          onChange={(p, r) => {
            setPreset(p);
            setRange(r);
          }}
        />
        {canExport && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handlePrintPdf("print")} disabled={exporting}>
              {exporting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Printer className="mr-1.5 h-4 w-4" />}
              Print
            </Button>
            <Button variant="outline" size="sm" onClick={() => handlePrintPdf("pdf")} disabled={exporting}>
              <FileDown className="mr-1.5 h-4 w-4" />
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handleCsv}>
              <FileSpreadsheet className="mr-1.5 h-4 w-4" />
              CSV
            </Button>
          </div>
        )}
      </div>

      <div className="no-print space-y-6">
        <KpiGrid kpis={kpis} loading={loading} />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <CompositionCharts slices={composition} />
          </div>
          <HealthScoreCard health={health} />
        </div>

        <MomTrends trends={trends} granularity={granularity} onGranularity={setGranularity} />

        <div className="grid gap-6 lg:grid-cols-2">
          <CategoryPerformance rows={categoryPerf} range={range} />
          <SubcategoryIntel rows={subcategoryPerf} range={range} />
        </div>

        <FixedVsVariable totals={totals} series={fixedVarSeries} />

        <div className="grid gap-6 lg:grid-cols-2">
          <LossImpact monthly={lossMonthly} returnLoss={totals.returnLoss} damageLoss={totals.damageLoss} />
          <MarketingIntel rows={marketing.data ?? []} platforms={platformsQ.data ?? []} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <AnomalyPanel anomalies={anomalies} />
          <ManagementSummary insights={insights} />
        </div>
      </div>

      {report && (
        <div className="print-only hidden">
          <IntelReportDocument model={report} />
        </div>
      )}
    </div>
  );
}