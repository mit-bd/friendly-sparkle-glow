import { createFileRoute, Link } from "@/lib/router";
import { useEffect, useMemo, useState } from "react";
import { TrendingDown, Undo2, PackageX, Coins, Layers } from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { EmptyState } from "@/components/analytics/EmptyState";
import { DateRangeFilter } from "@/components/analytics/DateRangeFilter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { DEFAULT_PRESET, resolveRange, type DateRange, type RangePreset } from "@/lib/analytics";
import {
  fetchApprovedReturns,
  fetchApprovedDamages,
  buildCombinedMonthly,
  returnTotals,
  sumBy,
  formatTk,
  type ReturnRecord,
  type DamageRecord,
} from "@/lib/loss";

export const Route = createFileRoute("/_authenticated/loss")({
  head: () => ({ meta: [{ title: "Loss Management — Motion IT BD" }] }),
  component: LossDashboard,
});

function LossDashboard() {
  const { canAccessModule } = useAuth();
  const allowed = canAccessModule("returns") || canAccessModule("damages");
  const [preset, setPreset] = useState<RangePreset>(DEFAULT_PRESET);
  const [range, setRange] = useState<DateRange>(resolveRange(DEFAULT_PRESET));
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [damages, setDamages] = useState<DamageRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    setLoading(true);
    Promise.all([fetchApprovedReturns(range), fetchApprovedDamages(range)])
      .then(([r, d]) => {
        if (!active) return;
        setReturns(r);
        setDamages(d);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load loss data."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [range, allowed]);

  const retTotals = useMemo(() => returnTotals(returns), [returns]);
  const damageValue = useMemo(() => sumBy(damages, (r) => r.damage_value), [damages]);
  const combined = retTotals.netLoss + damageValue;
  const monthly = useMemo(() => buildCombinedMonthly(returns, damages), [returns, damages]);
  const retPct = combined > 0 ? (retTotals.netLoss / combined) * 100 : 0;
  const dmgPct = combined > 0 ? (damageValue / combined) * 100 : 0;

  if (!allowed) {
    return (
      <div className="space-y-8">
        <PageHeader title="Loss Management" />
        <NoAccess />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loss Management"
        description="Combined operational loss from approved returns and damages."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/returns">Returns</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/damages">Damages</Link>
            </Button>
          </div>
        }
      />

      <DateRangeFilter preset={preset} range={range} onChange={(p, r) => { setPreset(p); setRange(r); }} />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard icon={Undo2} label="Total return loss" value={formatTk(retTotals.netLoss)} hint={`${returns.length} returns`} />
            <MetricCard icon={PackageX} label="Total damage loss" value={formatTk(damageValue)} hint={`${damages.length} damages`} />
            <MetricCard icon={TrendingDown} label="Combined loss" value={formatTk(combined)} hint="Returns + damages" />
          </div>

          {combined === 0 ? (
            <EmptyState
              icon={Coins}
              title="No approved losses in this range"
              description="Approved returns and damages will appear here as combined loss."
            />
          ) : (
            <>
              <div className="grid gap-6 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base">Monthly loss trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={monthly} margin={{ left: 8, right: 8 }}>
                        <CartesianGrid vertical={false} strokeOpacity={0.15} />
                        <XAxis dataKey="label" fontSize={11} />
                        <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} fontSize={11} />
                        <Tooltip formatter={(v: number) => formatTk(v)} />
                        <Legend />
                        <Bar dataKey="returns" name="Return loss" stackId="a" fill="var(--chart-1)" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="damages" name="Damage loss" stackId="a" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Loss percentage breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Breakdown label="Net return loss" value={formatTk(retTotals.netLoss)} pct={retPct} tone="bg-chart-1" />
                    <Breakdown label="Damage loss" value={formatTk(damageValue)} pct={dmgPct} tone="bg-chart-2" />
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Layers className="h-4 w-4 text-brand" /> Top loss sources
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source</TableHead>
                        <TableHead className="text-right">Records</TableHead>
                        <TableHead className="text-right">Loss</TableHead>
                        <TableHead className="text-right">% of combined</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">
                          <Link to="/returns" className="hover:text-brand-to hover:underline">Returns (net loss)</Link>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{returns.length}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{formatTk(retTotals.netLoss)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{retPct.toFixed(1)}%</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">
                          <Link to="/damages" className="hover:text-brand-to hover:underline">Damages</Link>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{damages.length}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{formatTk(damageValue)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{dmgPct.toFixed(1)}%</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Undo2;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-gradient-soft text-brand">
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <p className="mt-3 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function Breakdown({ label, value, pct, tone }: { label: string; value: string; pct: number; tone: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground">{label}</span>
        <span className="font-medium tabular-nums">{value}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${tone}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <p className="text-right text-xs text-muted-foreground">{pct.toFixed(1)}%</p>
    </div>
  );
}
