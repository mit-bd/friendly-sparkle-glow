import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/analytics/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { formatRangeLabel, type DateRange } from "@/lib/analytics";
import { formatDate } from "@/lib/expenses";
import { fetchApprovedReturns, fetchReturnReasons, returnTotals, formatTk, type ReturnReason, type ReturnRecord } from "@/lib/loss";

export const Route = createFileRoute("/_authenticated/returns/reason/$id")({
  validateSearch: (s: Record<string, unknown>): DateRange => ({
    from: typeof s.from === "string" ? s.from : "",
    to: typeof s.to === "string" ? s.to : "",
  }),
  head: () => ({ meta: [{ title: "Return Reason — Motion IT BD" }] }),
  component: ReturnReasonDrilldown,
});

function ReturnReasonDrilldown() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const { canAccessModule } = useAuth();
  const range: DateRange = {
    from: search.from || new Date().toISOString().slice(0, 10),
    to: search.to || new Date().toISOString().slice(0, 10),
  };

  const [approved, setApproved] = useState<ReturnRecord[]>([]);
  const [reasons, setReasons] = useState<ReturnReason[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true; setLoading(true);
    Promise.all([fetchApprovedReturns(range), fetchReturnReasons(true)])
      .then(([a, rs]) => { if (!active) return; setApproved(a); setReasons(rs); })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load returns."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to]);

  const rows = useMemo(() => approved.filter((r) => r.reason_id === id), [approved, id]);
  const totals = useMemo(() => returnTotals(rows), [rows]);
  const reasonName = reasons.find((r) => r.id === id)?.name ?? "Return reason";

  if (!canAccessModule("returns")) {
    return (<div className="space-y-8"><PageHeader title="Return Reason" /><NoAccess /></div>);
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit gap-1.5">
        <Link to="/returns"><ArrowLeft className="h-4 w-4" /> Back to returns</Link>
      </Button>
      <PageHeader title={reasonName} description={`Approved returns · ${formatRangeLabel(range)}`} />

      {loading ? (
        <Skeleton className="h-32 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState icon={Undo2} title="No approved returns for this reason." description="There are no approved returns with this reason in the selected range." />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Returns" value={String(totals.count)} />
            <Stat label="Total loss" value={formatTk(totals.loss)} />
            <Stat label="Recoverable" value={formatTk(totals.recoverable)} />
            <Stat label="Net loss" value={formatTk(totals.netLoss)} />
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Approved returns</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Return No.</TableHead><TableHead>Date</TableHead><TableHead>Product</TableHead><TableHead className="text-right">Loss</TableHead><TableHead className="text-right">Recoverable</TableHead><TableHead className="text-right">Net loss</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium"><Link to="/returns/$id" params={{ id: r.id }} className="hover:text-brand-to hover:underline">{r.return_number}</Link></TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(r.return_date)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{r.product_name || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatTk(r.loss_amount)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatTk(r.recoverable_amount)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatTk(r.net_loss_amount)}</TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div></CardContent></Card>
  );
}