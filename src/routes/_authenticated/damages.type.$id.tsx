import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, PackageX } from "lucide-react";
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
import { fetchApprovedDamages, fetchDamageTypes, sumBy, formatTk, type DamageType, type DamageRecord } from "@/lib/loss";

export const Route = createFileRoute("/_authenticated/damages/type/$id")({
  validateSearch: (s: Record<string, unknown>): DateRange => ({
    from: typeof s.from === "string" ? s.from : "",
    to: typeof s.to === "string" ? s.to : "",
  }),
  head: () => ({ meta: [{ title: "Damage Type — Motion IT BD" }] }),
  component: DamageTypeDrilldown,
});

function DamageTypeDrilldown() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const { canAccessModule } = useAuth();
  const range: DateRange = {
    from: search.from || new Date().toISOString().slice(0, 10),
    to: search.to || new Date().toISOString().slice(0, 10),
  };

  const [approved, setApproved] = useState<DamageRecord[]>([]);
  const [types, setTypes] = useState<DamageType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true; setLoading(true);
    Promise.all([fetchApprovedDamages(range), fetchDamageTypes(true)])
      .then(([a, t]) => { if (!active) return; setApproved(a); setTypes(t); })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load damages."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to]);

  const rows = useMemo(() => approved.filter((r) => r.type_id === id), [approved, id]);
  const totalValue = useMemo(() => sumBy(rows, (r) => r.damage_value), [rows]);
  const typeName = types.find((t) => t.id === id)?.name ?? "Damage type";

  if (!canAccessModule("damages")) {
    return (<div className="space-y-8"><PageHeader title="Damage Type" /><NoAccess /></div>);
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit gap-1.5">
        <Link to="/damages"><ArrowLeft className="h-4 w-4" /> Back to damages</Link>
      </Button>
      <PageHeader title={typeName} description={`Approved damages · ${formatRangeLabel(range)}`} />

      {loading ? (
        <Skeleton className="h-32 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState icon={PackageX} title="No approved damages for this type." description="There are no approved damages with this type in the selected range." />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Damages" value={String(rows.length)} />
            <Stat label="Damage value" value={formatTk(totalValue)} />
            <Stat label="Avg per record" value={formatTk(rows.length ? totalValue / rows.length : 0)} />
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Approved damages</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Damage No.</TableHead><TableHead>Date</TableHead><TableHead>Product</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Damage value</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium"><Link to="/damages/$id" params={{ id: r.id }} className="hover:text-brand-to hover:underline">{r.damage_number}</Link></TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(r.damage_date)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{r.product_name || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.quantity}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatTk(r.damage_value)}</TableCell>
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