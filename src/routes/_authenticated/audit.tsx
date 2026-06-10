import { createFileRoute } from "@/lib/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  History,
  Printer,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkActionBar } from "@/components/bulk/BulkActionBar";
import { useBulkExport } from "@/hooks/use-bulk-export";
import type { BulkExportConfig, BulkScope } from "@/lib/bulk-export";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime } from "@/lib/expenses";
import { ReportDocument } from "@/components/reports/ReportDocument";
import { logReportExport } from "@/lib/reports";
import {
  ACTIVITY_ACTION_LABELS,
  ACTIVITY_ENTITY_LABELS,
  ACTIVITY_TONE,
  fetchActivityLogs,
  fetchAllActivityLogs,
  logActivity,
  type ActivityFilters,
  type ActivityLog,
} from "@/lib/audit";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({ meta: [{ title: "Activity Logs — Motion IT BD" }] }),
  component: AuditPage,
});

const PAGE_SIZE = 20;
const ALL = "all";

interface UiFilters {
  actorId: string;
  action: string;
  entityType: string;
  dateFrom: string;
  dateTo: string;
}

const EMPTY: UiFilters = {
  actorId: ALL,
  action: ALL,
  entityType: ALL,
  dateFrom: "",
  dateTo: "",
};

function toQuery(f: UiFilters, search: string): ActivityFilters {
  return {
    actorId: f.actorId === ALL ? undefined : f.actorId,
    action: f.action === ALL ? undefined : f.action,
    entityType: f.entityType === ALL ? undefined : f.entityType,
    dateFrom: f.dateFrom || undefined,
    dateTo: f.dateTo || undefined,
    search: search || undefined,
  };
}

function AuditPage() {
  const { canAccessModule, can, isAdmin, profile } = useAuth();
  const canView = canAccessModule("audit");
  const canExport = isAdmin || can("audit", "export");

  const [rows, setRows] = useState<ActivityLog[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [printDoc, setPrintDoc] = useState<{
    rows: ActivityLog[];
    reportNumber: string;
    generatedAt: string;
    generatedBy: string;
    rangeLabel: string;
  } | null>(null);

  const [actors, setActors] = useState<{ id: string; name: string }[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<UiFilters>(EMPTY);
  const [page, setPage] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    (supabase as any)
      .rpc("list_directory")
      .then(({ data }: { data: { id: string; full_name: string | null; email: string | null }[] | null }) =>
        setActors(
          (data ?? [])
            .slice()
            .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""))
            .map((p) => ({ id: p.id, name: p.full_name?.trim() || p.email || "—" })),
        ),
      );
  }, []);

  const nameMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const a of actors) m[a.id] = a.name;
    return m;
  }, [actors]);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { rows: r, count } = await fetchActivityLogs(toQuery(filters, search), page, PAGE_SIZE);
      setRows(r);
      setTotal(count);
      setNames(nameMap);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load activity logs.");
    } finally {
      setLoading(false);
    }
  }, [filters, search, page, nameMap]);

  useEffect(() => {
    if (canView) load();
  }, [load, canView]);

  // ---- Bulk selection + export (selected current-page rows) ---------------
  const resolveActor = (id: string | null) =>
    !id ? "System" : names[id] ?? nameMap[id] ?? "Unknown";
  const bulkConfig = useMemo<BulkExportConfig<ActivityLog>>(
    () => ({
      module: "audit",
      moduleLabel: "Activity Logs",
      documentTitle: "Bulk Activity Log Report",
      fileBase: "motion-it-bd-audit-logs",
      numberPrefix: "AUD",
      recordLabel: (l) =>
        `${ACTIVITY_ACTION_LABELS[l.action] ?? l.action} · ${l.entity_label ?? ACTIVITY_ENTITY_LABELS[l.entity_type] ?? l.entity_type}`,
      fields: [
        { label: "Date & Time", value: (l) => formatDateTime(l.created_at) },
        { label: "User", value: (l) => resolveActor(l.actor_id) },
        { label: "Action", value: (l) => ACTIVITY_ACTION_LABELS[l.action] ?? l.action },
        { label: "Type", value: (l) => ACTIVITY_ENTITY_LABELS[l.entity_type] ?? l.entity_type },
        { label: "Record", value: (l) => l.entity_label ?? "—" },
        { label: "Details", value: (l) => JSON.stringify(l.metadata ?? {}) },
      ],
    }),
    [names, nameMap],
  );
  const bulk = useBulkExport<ActivityLog>({
    config: bulkConfig,
    getId: (l) => l.id,
    generatedBy: profile?.full_name?.trim() || profile?.email || "—",
    canExport,
  });
  const runBulkSelected = (kind: "print" | "pdf" | "csv") => {
    const sel = rows.filter((l) => bulk.selection.isSelected(l.id));
    const scope: BulkScope = "selected";
    if (kind === "print") bulk.runPrint(sel, scope);
    else if (kind === "pdf") bulk.runPdf(sel, scope);
    else bulk.runCsv(sel, scope);
  };
  const pageAllSelected = rows.length > 0 && rows.every((l) => bulk.selection.isSelected(l.id));

  if (!canView) {
    return (
      <div className="space-y-8">
        <PageHeader title="Activity Logs" />
        <NoAccess />
      </div>
    );
  }

  function setFilter(patch: Partial<UiFilters>) {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(0);
  }

  function actorName(id: string | null) {
    if (!id) return "System";
    return names[id] ?? nameMap[id] ?? "Unknown";
  }

  async function handleExport() {
    setBusy(true);
    try {
      const all = await fetchAllActivityLogs(toQuery(filters, search));
      const header = ["Date & Time", "User", "Action", "Type", "Record", "Details"];
      const lines = all.map((l) => [
        formatDateTime(l.created_at),
        actorName(l.actor_id),
        ACTIVITY_ACTION_LABELS[l.action] ?? l.action,
        ACTIVITY_ENTITY_LABELS[l.entity_type] ?? l.entity_type,
        l.entity_label ?? "",
        JSON.stringify(l.metadata ?? {}),
      ]);
      const csv = [header, ...lines]
        .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `motion-it-bd-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      await logActivity({
        action: "export",
        entityType: "report",
        entityLabel: "Audit logs",
        metadata: { count: all.length, format: "csv" },
      });
      toast.success(`Exported ${all.length} log entries.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePrint() {
    setBusy(true);
    try {
      const all = await fetchAllActivityLogs(toQuery(filters, search));
      let reportNumber = "—";
      let createdAt = new Date().toISOString();
      if (canExport) {
        try {
          const logged = await logReportExport({
            reportType: "audit_activity",
            title: "Activity Log Report",
            rangeFrom: filters.dateFrom || null,
            rangeTo: filters.dateTo || null,
            filters: { module: "audit", search: search || undefined },
            expenseCount: all.length,
            totalAmount: 0,
          });
          reportNumber = logged.report_number;
          createdAt = logged.created_at;
        } catch {
          /* archive is best-effort */
        }
      }
      await logActivity({
        action: "print",
        entityType: "report",
        entityLabel: `${reportNumber} · Activity Logs`,
        metadata: { count: all.length },
      });
      const rangeLabel =
        filters.dateFrom || filters.dateTo
          ? `${filters.dateFrom || "…"} → ${filters.dateTo || "…"}`
          : "All time";
      setPrintDoc({
        rows: all,
        reportNumber,
        generatedAt: formatDateTime(createdAt),
        generatedBy: profile?.full_name?.trim() || profile?.email || "—",
        rangeLabel,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to prepare print.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!printDoc) return;
    const t = setTimeout(() => window.print(), 120);
    return () => clearTimeout(t);
  }, [printDoc]);

  const activeFilterCount = Object.entries(filters).filter(([, v]) => v && v !== ALL).length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity Logs"
        description="A complete, immutable record of every important action across the platform."
        actions={
          canExport && (
            <div className="flex gap-2 print:hidden">
              <Button variant="outline" onClick={handlePrint} disabled={busy}>
                <Printer className="h-4 w-4" />
                Print
              </Button>
              <Button onClick={handleExport} disabled={busy}>
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          )
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center print:hidden">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by expense number, category, record name…"
            className="pl-9"
          />
          {searchInput && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearchInput("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button
          variant="outline"
          onClick={() => setFiltersOpen((o) => !o)}
          className={activeFilterCount ? "border-brand-to/40" : undefined}
        >
          <Filter className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-gradient px-1.5 text-xs font-medium text-brand-foreground">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <CollapsibleContent className="print:hidden">
          <Card>
            <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label>User</Label>
                <Select value={filters.actorId} onValueChange={(v) => setFilter({ actorId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All users</SelectItem>
                    {actors.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Action type</Label>
                <Select value={filters.action} onValueChange={(v) => setFilter({ action: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All actions</SelectItem>
                    {Object.entries(ACTIVITY_ACTION_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Record type</Label>
                <Select value={filters.entityType} onValueChange={(v) => setFilter({ entityType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All types</SelectItem>
                    {Object.entries(ACTIVITY_ENTITY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>From date</Label>
                <Input type="date" value={filters.dateFrom} onChange={(e) => setFilter({ dateFrom: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>To date</Label>
                <Input type="date" value={filters.dateTo} onChange={(e) => setFilter({ dateTo: e.target.value })} />
              </div>
              <div className="flex items-end">
                <Button variant="ghost" onClick={() => { setFilters(EMPTY); setSearchInput(""); }}>
                  <X className="h-4 w-4" />
                  Clear filters
                </Button>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-md" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <History className="h-7 w-7" />
              </span>
              <h2 className="mt-5 text-lg font-medium text-foreground">No activity found</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Try adjusting your filters or date range to see more history.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 print:hidden">
                    <Checkbox
                      checked={pageAllSelected}
                      onCheckedChange={() =>
                        pageAllSelected ? bulk.selection.removeMany(rows) : bulk.selection.addMany(rows)
                      }
                      aria-label="Select all on page"
                    />
                  </TableHead>
                  <TableHead>Date &amp; Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Record</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="print:hidden">
                      <Checkbox
                        checked={bulk.selection.isSelected(l.id)}
                        onCheckedChange={() => bulk.selection.toggle(l.id)}
                        aria-label="Select log entry"
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDateTime(l.created_at)}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-foreground">
                      {actorName(l.actor_id)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                          ACTIVITY_TONE[l.action] ?? "bg-muted text-muted-foreground",
                        )}
                      >
                        {ACTIVITY_ACTION_LABELS[l.action] ?? l.action}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {ACTIVITY_ENTITY_LABELS[l.entity_type] ?? l.entity_type}
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      {l.entity_label ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {!loading && rows.length > 0 && (
        <div className="flex items-center justify-between print:hidden">
          <p className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages} · {total} entries
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {printDoc && (
        <div className="print-only">
          <ReportDocument
            reportName="Activity Log Report"
            reportNumber={printDoc.reportNumber}
            generatedAt={printDoc.generatedAt}
            generatedBy={printDoc.generatedBy}
            dateRangeLabel={printDoc.rangeLabel}
          >
            <ActivityLogPrintTable rows={printDoc.rows} actorName={actorName} />
          </ReportDocument>
        </div>
      )}

      <BulkActionBar
        count={bulk.selection.count}
        canExport={canExport}
        busy={bulk.busy}
        onClear={bulk.selection.clear}
        onPrint={() => runBulkSelected("print")}
        onPdf={() => runBulkSelected("pdf")}
        onCsv={() => runBulkSelected("csv")}
      />
      {bulk.printNode}
    </div>
  );
}

function ActivityLogPrintTable({
  rows,
  actorName,
}: {
  rows: ActivityLog[];
  actorName: (id: string | null) => string;
}) {
  const th = "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
  const td = "px-3 py-2 text-sm text-foreground align-top";
  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
        No activity found for the selected criteria.
      </p>
    );
  }
  return (
    <table className="report-table w-full border-collapse">
      <thead>
        <tr className="border-b-2 border-border">
          <th className={th}>Date &amp; Time</th>
          <th className={th}>User</th>
          <th className={th}>Action</th>
          <th className={th}>Type</th>
          <th className={th}>Record</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((l) => (
          <tr key={l.id} className="border-b border-border break-inside-avoid">
            <td className={td + " whitespace-nowrap"}>{formatDateTime(l.created_at)}</td>
            <td className={td}>{actorName(l.actor_id)}</td>
            <td className={td}>{ACTIVITY_ACTION_LABELS[l.action] ?? l.action}</td>
            <td className={td}>{ACTIVITY_ENTITY_LABELS[l.entity_type] ?? l.entity_type}</td>
            <td className={td}>{l.entity_label ?? "—"}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-foreground/70 font-semibold">
          <td className={td + " font-semibold"} colSpan={5}>
            Total: {rows.length} log entr{rows.length === 1 ? "y" : "ies"}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
