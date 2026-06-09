import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileDown, FileSpreadsheet, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateRangeFilter } from "@/components/analytics/DateRangeFilter";
import { ReportDocument } from "@/components/reports/ReportDocument";
import { useAuth } from "@/lib/auth-context";
import { DEFAULT_PRESET, formatRangeLabel, resolveRange, type DateRange, type RangePreset } from "@/lib/analytics";
import { formatDateTime, formatDate } from "@/lib/expenses";
import { logActivity } from "@/lib/audit";
import { logReportExport } from "@/lib/reports";
import { downloadCsv } from "@/lib/report-csv";
import {
  fetchAllCollections, fetchAllPayments, fetchPayables, fetchReceivables, formatTk, isApprovedActive, partyTypeLabel,
  type Payable, type Receivable,
} from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/finance/reports")({
  head: () => ({ meta: [{ title: "Finance Reports — Motion IT BD" }] }),
  component: FinanceReports,
});

type RType =
  | "receivable_summary" | "payable_summary" | "outstanding_receivables" | "outstanding_payables"
  | "overdue_receivables" | "overdue_payables" | "courier_receivables" | "supplier_liabilities"
  | "collection_history" | "payment_history";

const REPORT_TYPES: { value: RType; label: string }[] = [
  { value: "receivable_summary", label: "Receivable Summary" },
  { value: "payable_summary", label: "Payable Summary" },
  { value: "outstanding_receivables", label: "Outstanding Receivables" },
  { value: "outstanding_payables", label: "Outstanding Payables" },
  { value: "overdue_receivables", label: "Overdue Receivables" },
  { value: "overdue_payables", label: "Overdue Payables" },
  { value: "courier_receivables", label: "Courier Receivables" },
  { value: "supplier_liabilities", label: "Supplier Liabilities" },
  { value: "collection_history", label: "Collection History" },
  { value: "payment_history", label: "Payment History" },
];
const LABELS = Object.fromEntries(REPORT_TYPES.map((t) => [t.value, t.label])) as Record<RType, string>;

interface Built { headers: string[]; rows: (string | number)[][]; total: number; count: number; }

function FinanceReports() {
  const { canAccessModule, can, isAdmin, profile } = useAuth();
  const canExport = isAdmin || can("finance", "export") || can("reports", "export");
  const [type, setType] = useState<RType>("receivable_summary");
  const [preset, setPreset] = useState<RangePreset>(DEFAULT_PRESET);
  const [range, setRange] = useState<DateRange>(resolveRange(DEFAULT_PRESET));
  const [recv, setRecv] = useState<Receivable[]>([]);
  const [pay, setPay] = useState<Payable[]>([]);
  const [collections, setCollections] = useState<{ amount: number; collection_date: string }[]>([]);
  const [payments, setPayments] = useState<{ amount: number; payment_date: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [generated, setGenerated] = useState<{ type: RType; built: Built; reportNumber: string; generatedAt: string; generatedBy: string; rangeLabel: string } | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    Promise.all([fetchReceivables(), fetchPayables(), fetchAllCollections(), fetchAllPayments()])
      .then(([r, p, c, pm]) => { setRecv(r); setPay(p); setCollections(c); setPayments(pm); })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load finance data."))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => setGenerated(null), [type]);

  const inRange = (d: string | null) => !!d && d.slice(0, 10) >= range.from && d.slice(0, 10) <= range.to;

  function build(t: RType): Built {
    const aR = recv.filter(isApprovedActive);
    const aP = pay.filter(isApprovedActive);
    const partyRows = (rows: (Receivable | Payable)[], kind: "receivable" | "payable") => {
      const headers = ["No.", "Party", "Type", "Amount", kind === "receivable" ? "Collected" : "Paid", "Due", "Due Date", "Settlement"];
      const body = rows.map((r) => [
        kind === "receivable" ? (r as Receivable).receivable_number : (r as Payable).payable_number,
        r.party_name, partyTypeLabel(kind, r.party_type), r.amount,
        kind === "receivable" ? (r as Receivable).collected_amount : (r as Payable).paid_amount,
        r.due_amount, r.due_date ?? "", r.status,
      ]);
      return { headers, rows: body, total: rows.reduce((a, r) => a + Number(r.due_amount || 0), 0), count: rows.length };
    };
    switch (t) {
      case "receivable_summary": {
        const rows = aR.filter((r) => inRange(r.created_at));
        const headers = ["No.", "Party", "Type", "Amount", "Collected", "Due", "Status"];
        const body = rows.map((r) => [r.receivable_number, r.party_name, partyTypeLabel("receivable", r.party_type), r.amount, r.collected_amount, r.due_amount, r.status]);
        return { headers, rows: body, total: rows.reduce((a, r) => a + Number(r.amount || 0), 0), count: rows.length };
      }
      case "payable_summary": {
        const rows = aP.filter((r) => inRange(r.created_at));
        const headers = ["No.", "Party", "Type", "Amount", "Paid", "Due", "Status"];
        const body = rows.map((r) => [r.payable_number, r.party_name, partyTypeLabel("payable", r.party_type), r.amount, r.paid_amount, r.due_amount, r.status]);
        return { headers, rows: body, total: rows.reduce((a, r) => a + Number(r.amount || 0), 0), count: rows.length };
      }
      case "outstanding_receivables": return partyRows(aR.filter((r) => r.due_amount > 0), "receivable");
      case "outstanding_payables": return partyRows(aP.filter((r) => r.due_amount > 0), "payable");
      case "overdue_receivables": return partyRows(aR.filter((r) => r.status === "overdue"), "receivable");
      case "overdue_payables": return partyRows(aP.filter((r) => r.status === "overdue"), "payable");
      case "courier_receivables": return partyRows(aR.filter((r) => r.party_type === "courier" && r.due_amount > 0), "receivable");
      case "supplier_liabilities": return partyRows(aP.filter((r) => r.party_type === "supplier" && r.due_amount > 0), "payable");
      case "collection_history": {
        const rows = collections.filter((c) => inRange(c.collection_date));
        return { headers: ["Date", "Amount"], rows: rows.map((c) => [c.collection_date, c.amount]), total: rows.reduce((a, c) => a + Number(c.amount || 0), 0), count: rows.length };
      }
      case "payment_history": {
        const rows = payments.filter((c) => inRange(c.payment_date));
        return { headers: ["Date", "Amount"], rows: rows.map((c) => [c.payment_date, c.amount]), total: rows.reduce((a, c) => a + Number(c.amount || 0), 0), count: rows.length };
      }
    }
  }

  async function generate() {
    setGenerating(true);
    try {
      const built = build(type);
      const logged = await logReportExport({
        reportType: `finance_${type}`, title: LABELS[type], rangeFrom: range.from, rangeTo: range.to,
        filters: { module: "finance" }, expenseCount: built.count, totalAmount: built.total,
      });
      void logActivity({ action: "export", entityType: "report", entityLabel: `${logged.report_number} · ${LABELS[type]}`, metadata: { module: "finance" } });
      setGenerated({ type, built, reportNumber: logged.report_number, generatedAt: formatDateTime(logged.created_at), generatedBy: profile?.full_name?.trim() || profile?.email || "—", rangeLabel: formatRangeLabel(range) });
      toast.success(`Report ${logged.report_number} generated and archived.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate report.");
    } finally {
      setGenerating(false);
    }
  }

  function exportCsv() {
    if (!generated) return;
    const moneyCols = generated.built.headers.map((h) => ["Amount", "Collected", "Paid", "Due"].includes(h));
    const rows = generated.built.rows.map((r) => r.map((c, i) => (moneyCols[i] && typeof c === "number" ? c : c)));
    downloadCsv(`motion-it-bd-${LABELS[generated.type].toLowerCase().replace(/\s+/g, "-")}`, generated.built.headers, rows);
    void logActivity({ action: "export", entityType: "report", entityLabel: `${generated.reportNumber} · ${LABELS[generated.type]}`, metadata: { format: "csv" } });
  }
  function print() { if (generated) void logActivity({ action: "print", entityType: "report", entityLabel: `${generated.reportNumber} · ${LABELS[generated.type]}` }); window.print(); }

  if (!canAccessModule("finance")) return (<div className="space-y-8"><PageHeader title="Finance Reports" /><NoAccess /></div>);

  const moneyHeader = (h: string) => ["Amount", "Collected", "Paid", "Due"].includes(h);

  return (
    <div className="space-y-8">
      <PageHeader title="Finance Reports" description="Branded, approval-only receivable & payable reports with print, PDF and CSV export." />
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
            <div className="space-y-2"><Label>Date range</Label><DateRangeFilter preset={preset} range={range} onChange={(p, r) => { setPreset(p); setRange(r); }} /></div>
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
        <ReportDocument reportName={LABELS[generated.type]} reportNumber={generated.reportNumber} generatedAt={generated.generatedAt} generatedBy={generated.generatedBy} dateRangeLabel={generated.rangeLabel}>
          <Table>
            <TableHeader><TableRow>{generated.built.headers.map((h) => (<TableHead key={h} className={moneyHeader(h) ? "text-right" : ""}>{h}</TableHead>))}</TableRow></TableHeader>
            <TableBody>
              {generated.built.rows.length === 0 ? (
                <TableRow><TableCell colSpan={generated.built.headers.length} className="text-center text-muted-foreground">No records in this range.</TableCell></TableRow>
              ) : generated.built.rows.map((r, i) => (
                <TableRow key={i}>{r.map((c, j) => {
                  const h = generated.built.headers[j];
                  const money = moneyHeader(h);
                  let val: string = String(c ?? "");
                  if (money && typeof c === "number") val = formatTk(c);
                  else if (h === "Due Date" || h === "Date") val = c ? formatDate(String(c)) : "—";
                  else if (h === "Settlement" || h === "Status") val = String(c).replace(/_/g, " ");
                  return (<TableCell key={j} className={money ? "text-right tabular-nums" : ""}>{val}</TableCell>);
                })}</TableRow>
      ))}
            </TableBody>
          </Table>
          <div className="mt-4 flex justify-between border-t border-border pt-3 text-sm font-semibold">
            <span>{generated.built.count} record(s)</span>
            <span className="tabular-nums">Total: {formatTk(generated.built.total)}</span>
          </div>
        </ReportDocument>
      )}
    </div>
  );
}