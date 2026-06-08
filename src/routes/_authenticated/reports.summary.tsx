import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileDown, FileSpreadsheet, Loader2, Printer, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  CategoryBody,
  LedgerBody,
  SubcategoryBody,
  SummaryBody,
} from "@/components/reports/ReportBodies";
import { useAuth } from "@/lib/auth-context";
import { useTaxonomy, useApprovedExpenses } from "@/hooks/use-analytics";
import {
  DEFAULT_PRESET,
  formatRangeLabel,
  resolveRange,
  type DateRange,
  type RangePreset,
} from "@/lib/analytics";
import {
  buildCategoryReport,
  buildSubcategoryReport,
  buildSummary,
  fetchApprovedByIds,
  fetchApprovedForReport,
  filterByKeywords,
  logReportExport,
  MARKETING_KEYWORDS,
  RETURN_DAMAGE_KEYWORDS,
  REPORT_TYPES,
  REPORT_TYPE_LABELS,
  type ReportExpense,
  type ReportType,
} from "@/lib/reports";
import type { ExpenseCategory, ExpenseSubcategory } from "@/lib/expenses";
import { fetchUserNames, formatCurrency, formatDate, formatDateTime } from "@/lib/expenses";
import { logActivity } from "@/lib/audit";
import { downloadCsv } from "@/lib/report-csv";

export const Route = createFileRoute("/_authenticated/reports/summary")({
  head: () => ({ meta: [{ title: "Reports Center — Motion IT BD" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    type: typeof search.type === "string" ? (search.type as ReportType) : undefined,
    from: typeof search.from === "string" ? search.from : undefined,
    to: typeof search.to === "string" ? search.to : undefined,
    ids: typeof search.ids === "string" ? search.ids : undefined,
    rnum: typeof search.rnum === "string" ? search.rnum : undefined,
    gen: typeof search.gen === "string" ? search.gen : undefined,
    by: typeof search.by === "string" ? search.by : undefined,
  }),
  component: ReportsCenterPage,
});

interface GeneratedReport {
  type: ReportType;
  rows: ReportExpense[];
  categories: ExpenseCategory[];
  subcategories: ExpenseSubcategory[];
  userNames: Record<string, string>;
  total: number;
  count: number;
  reportNumber: string;
  generatedAt: string;
  generatedBy: string;
  rangeLabel?: string;
}

function ReportsCenterPage() {
  const { canAccessModule, profile } = useAuth();
  const taxonomy = useTaxonomy();
  const search = Route.useSearch();

  const [reportType, setReportType] = useState<ReportType>("summary");
  const [preset, setPreset] = useState<RangePreset>(DEFAULT_PRESET);
  const [range, setRange] = useState<DateRange>(resolveRange(DEFAULT_PRESET));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectSearch, setSelectSearch] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedReport | null>(null);
  const [autoRan, setAutoRan] = useState(false);

  // Approved rows for the Selected Expenses picker (only loaded in that mode).
  const picker = useApprovedExpenses(range);
  const isSelected = reportType === "selected";

  useEffect(() => {
    setGenerated(null);
  }, [reportType]);

  // "Print Again / Download Again" from Export History: rebuild a report from
  // URL params, reusing the original report number (no new archive entry).
  useEffect(() => {
    if (autoRan || !search.rnum || !search.type || !taxonomy.data) return;
    setAutoRan(true);
    const type = search.type as ReportType;
    setReportType(type);
    const cats = taxonomy.data.categories;
    const subs = taxonomy.data.subcategories;
    (async () => {
      setGenerating(true);
      try {
        let rows: ReportExpense[];
        let usedRange: DateRange | null = null;
        if (type === "selected") {
          const ids = (search.ids ?? "").split(",").filter(Boolean);
          setSelectedIds(new Set(ids));
          rows = await fetchApprovedByIds(ids);
        } else if (search.from && search.to) {
          usedRange = { from: search.from, to: search.to };
          setPreset("custom");
          setRange(usedRange);
          rows = await fetchApprovedForReport(usedRange);
          if (type === "marketing")
            rows = filterByKeywords(rows, cats, subs, MARKETING_KEYWORDS);
          if (type === "return_damage")
            rows = filterByKeywords(rows, cats, subs, RETURN_DAMAGE_KEYWORDS);
        } else {
          rows = [];
        }
        const total = rows.reduce((a, r) => a + Number(r.amount || 0), 0);
        const userNames = await fetchUserNames(
          rows.map((r) => r.approved_by).filter(Boolean) as string[],
        );
        setGenerated({
          type,
          rows,
          categories: cats,
          subcategories: subs,
          userNames,
          total,
          count: rows.length,
          reportNumber: search.rnum!,
          generatedAt: formatDateTime(search.gen ?? new Date().toISOString()),
          generatedBy: search.by || "—",
          rangeLabel: usedRange ? formatRangeLabel(usedRange) : "Selected expenses",
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load report.");
      } finally {
        setGenerating(false);
      }
    })();
  }, [autoRan, search, taxonomy.data]);

  if (!canAccessModule("reports")) {
    return (
      <div className="space-y-8">
        <PageHeader title="Reports Center" />
        <NoAccess />
      </div>
    );
  }

  const categories = taxonomy.data?.categories ?? [];
  const subcategories = taxonomy.data?.subcategories ?? [];

  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const subName = new Map(subcategories.map((s) => [s.id, s.name]));

  const pickerRows = (picker.data ?? []).filter((r) => {
    const q = selectSearch.trim().toLowerCase();
    if (!q) return true;
    const hay = [
      r.expense_number,
      r.description ?? "",
      r.category_id ? catName.get(r.category_id) ?? "" : "",
      r.subcategory_id ? subName.get(r.subcategory_id) ?? "" : "",
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });

  const toggleId = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allPickerSelected =
    pickerRows.length > 0 && pickerRows.every((r) => selectedIds.has(r.id));
  const toggleAll = () =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPickerSelected) pickerRows.forEach((r) => next.delete(r.id));
      else pickerRows.forEach((r) => next.add(r.id));
      return next;
    });

  async function handleGenerate(reuse?: { number: string; createdAt: string; by: string }) {
    if (isSelected && selectedIds.size === 0) {
      toast.error("Select at least one approved expense.");
      return;
    }
    setGenerating(true);
    try {
      let rows: ReportExpense[];
      let usedRange: DateRange | null = range;
      if (isSelected) {
        rows = await fetchApprovedByIds([...selectedIds]);
        usedRange = null;
      } else {
        rows = await fetchApprovedForReport(range);
        if (reportType === "marketing")
          rows = filterByKeywords(rows, categories, subcategories, MARKETING_KEYWORDS);
        if (reportType === "return_damage")
          rows = filterByKeywords(rows, categories, subcategories, RETURN_DAMAGE_KEYWORDS);
      }

      const total = rows.reduce((a, r) => a + Number(r.amount || 0), 0);
      const userNames = await fetchUserNames(
        rows.map((r) => r.approved_by).filter(Boolean) as string[],
      );

      let reportNumber = reuse?.number ?? "";
      let createdAt = reuse?.createdAt ?? new Date().toISOString();
      if (!reuse) {
        const logged = await logReportExport({
          reportType,
          title: REPORT_TYPE_LABELS[reportType],
          rangeFrom: usedRange?.from ?? null,
          rangeTo: usedRange?.to ?? null,
          filters: isSelected ? { ids: [...selectedIds] } : { preset },
          expenseCount: rows.length,
          totalAmount: total,
        });
        reportNumber = logged.report_number;
        createdAt = logged.created_at;
        void logActivity({
          action: "export",
          entityType: "report",
          entityLabel: `${reportNumber} · ${REPORT_TYPE_LABELS[reportType]}`,
          metadata: { count: rows.length, total },
        });
      }

      setGenerated({
        type: reportType,
        rows,
        categories,
        subcategories,
        userNames,
        total,
        count: rows.length,
        reportNumber,
        generatedAt: formatDateTime(createdAt),
        generatedBy: reuse?.by || profile?.full_name?.trim() || profile?.email || "—",
        rangeLabel: usedRange ? formatRangeLabel(usedRange) : "Selected expenses",
      });
      if (!reuse) toast.success(`Report ${reportNumber} generated and archived.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate report.");
    } finally {
      setGenerating(false);
    }
  }

  const handlePrint = () => {
    if (generated)
      void logActivity({
        action: "print",
        entityType: "report",
        entityLabel: `${generated.reportNumber} · ${REPORT_TYPE_LABELS[generated.type]}`,
      });
    window.print();
  };
  const handleExportPdf = () => {
    if (generated)
      void logActivity({
        action: "export",
        entityType: "report",
        entityLabel: `${generated.reportNumber} · ${REPORT_TYPE_LABELS[generated.type]}`,
        metadata: { format: "pdf" },
      });
    toast.message("Use the print dialog's \u201cSave as PDF\u201d to export.");
    window.print();
  };

  const handleExportCsv = () => {
    if (!generated) return;
    const { type, rows, categories: cats, subcategories: subs, userNames } = generated;
    let headers: string[] = [];
    let body: (string | number)[][] = [];
    if (type === "summary") {
      const { rows: srows, grandTotal } = buildSummary(rows, cats);
      headers = ["Category", "Count", "Total", "Percentage"];
      body = srows.map((r) => [r.name, r.count, r.total, `${r.percentage.toFixed(1)}%`]);
      body.push(["Grand Total", rows.length, grandTotal, "100.0%"]);
    } else if (type === "category") {
      const { rows: crows } = buildCategoryReport(rows, cats, subs);
      headers = ["Category", "Subcategory", "Count", "Total"];
      crows.forEach((c) =>
        c.subcategories.forEach((s) => body.push([c.name, s.name, s.count, s.total])),
      );
    } else if (type === "subcategory") {
      const { rows: scrows } = buildSubcategoryReport(rows, subs, cats);
      headers = ["Subcategory", "Category", "Expense No.", "Date", "Description", "Amount"];
      scrows.forEach((sc) =>
        sc.expenses.forEach((e) =>
          body.push([sc.name, sc.categoryName, e.expense_number, e.expense_date, e.description ?? "", e.amount]),
        ),
      );
    } else {
      const catName = new Map(cats.map((c) => [c.id, c.name]));
      const subName = new Map(subs.map((s) => [s.id, s.name]));
      headers = [
        "Expense No.", "Date", "Category", "Subcategory", "Description",
        "Amount", "Approved By", "Approval Date",
      ];
      body = rows.map((e) => [
        e.expense_number,
        e.expense_date,
        e.category_id ? catName.get(e.category_id) ?? "" : "",
        e.subcategory_id ? subName.get(e.subcategory_id) ?? "" : "",
        e.description ?? "",
        e.amount,
        e.approved_by ? userNames[e.approved_by] ?? "" : "",
        e.approved_at ?? "",
      ]);
    }
    downloadCsv(
      `motion-it-bd-${REPORT_TYPE_LABELS[type].toLowerCase().replace(/\s+/g, "-")}`,
      headers,
      body,
    );
    void logActivity({
      action: "export",
      entityType: "report",
      entityLabel: `${generated.reportNumber} · ${REPORT_TYPE_LABELS[type]}`,
      metadata: { format: "csv" },
    });
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Reports Center"
        description="Generate, print and export branded, approval-only financial reports."
      />

      <Card className="no-print">
        <CardHeader>
          <CardTitle className="text-base">Build a report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Report type</Label>
              <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
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
              <p className="text-xs text-muted-foreground">
                {REPORT_TYPES.find((t) => t.value === reportType)?.description}
              </p>
            </div>
            {!isSelected && (
              <div className="space-y-2">
                <Label>Date range</Label>
                <DateRangeFilter
                  preset={preset}
                  range={range}
                  onChange={(p, r) => {
                    setPreset(p);
                    setRange(r);
                  }}
                />
              </div>
            )}
          </div>

          {isSelected && (
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Label className="m-0">Select approved expenses</Label>
                <DateRangeFilter
                  preset={preset}
                  range={range}
                  onChange={(p, r) => {
                    setPreset(p);
                    setRange(r);
                  }}
                />
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={selectSearch}
                  onChange={(e) => setSelectSearch(e.target.value)}
                  placeholder="Search by number, description, category…"
                  className="pl-9"
                />
              </div>
              <div className="rounded-lg border border-border">
                <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-3 py-2">
                  <Checkbox checked={allPickerSelected} onCheckedChange={toggleAll} />
                  <span className="text-xs font-medium text-muted-foreground">
                    {selectedIds.size} selected · {pickerRows.length} approved in range
                  </span>
                </div>
                <ScrollArea className="h-64">
                  {picker.isLoading ? (
                    <div className="flex justify-center py-10">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : pickerRows.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      No approved expenses in this range.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {pickerRows.map((r) => (
                        <li key={r.id} className="flex items-center gap-3 px-3 py-2">
                          <Checkbox
                            checked={selectedIds.has(r.id)}
                            onCheckedChange={() => toggleId(r.id)}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">
                              {r.expense_number}
                              <span className="ml-2 font-normal text-muted-foreground">
                                {r.category_id ? catName.get(r.category_id) ?? "" : ""}
                              </span>
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {formatDate(r.expense_date)} · {r.description || "—"}
                            </p>
                          </div>
                          <span className="shrink-0 text-sm font-medium tabular-nums">
                            {formatCurrency(r.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </ScrollArea>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => handleGenerate()} disabled={generating} className="bg-brand-gradient text-primary-foreground">
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Generate Report
            </Button>
            {generated && (
              <>
                <Button variant="outline" onClick={handlePrint}>
                  <Printer className="h-4 w-4" />
                  Print
                </Button>
                <Button variant="outline" onClick={handleExportPdf}>
                  <FileDown className="h-4 w-4" />
                  Export PDF
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {generated && (
        <ReportDocument
          reportName={REPORT_TYPE_LABELS[generated.type]}
          reportNumber={generated.reportNumber}
          generatedAt={generated.generatedAt}
          generatedBy={generated.generatedBy}
          dateRangeLabel={generated.rangeLabel}
        >
          <ReportBodySwitch report={generated} />
        </ReportDocument>
      )}
    </div>
  );
}

function ReportBodySwitch({ report }: { report: GeneratedReport }) {
  const { type, rows, categories, subcategories, userNames } = report;
  if (type === "summary") {
    const { rows: srows, grandTotal } = buildSummary(rows, categories);
    return <SummaryBody rows={srows} grandTotal={grandTotal} />;
  }
  if (type === "category") {
    const { rows: crows, grandTotal } = buildCategoryReport(rows, categories, subcategories);
    return <CategoryBody rows={crows} grandTotal={grandTotal} />;
  }
  if (type === "subcategory") {
    const { rows: scrows, grandTotal } = buildSubcategoryReport(rows, subcategories, categories);
    return (
      <SubcategoryBody
        rows={scrows}
        grandTotal={grandTotal}
        categories={categories}
        subcategories={subcategories}
      />
    );
  }
  // approved, marketing, return_damage, selected -> line-item ledger
  return (
    <LedgerBody
      rows={rows}
      categories={categories}
      subcategories={subcategories}
      userNames={userNames}
    />
  );
}
