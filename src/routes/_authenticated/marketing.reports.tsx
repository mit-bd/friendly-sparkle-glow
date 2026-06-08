import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Printer, FileBarChart } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { EmptyState } from "@/components/analytics/EmptyState";
import { DateRangeFilter } from "@/components/analytics/DateRangeFilter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  DEFAULT_PRESET,
  resolveRange,
  formatRangeLabel,
  type DateRange,
  type RangePreset,
} from "@/lib/analytics";
import { formatDate } from "@/lib/expenses";
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

function MarketingReports() {
  const { canAccessModule, can, isAdmin } = useAuth();
  const canExport = isAdmin || can("reports", "view") || can("reports", "export");

  const [type, setType] = useState<MkReportType>("summary");
  const [preset, setPreset] = useState<RangePreset>(DEFAULT_PRESET);
  const [range, setRange] = useState<DateRange>(resolveRange(DEFAULT_PRESET));
  const [rows, setRows] = useState<MarketingExpense[]>([]);
  const [platforms, setPlatforms] = useState<MarketingPlatform[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([fetchApprovedMarketing(range), fetchPlatforms(true)])
      .then(([r, p]) => {
        if (!active) return;
        setRows(r);
        setPlatforms(p);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load report data."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [range]);

  const platformSummary = useMemo(() => buildPlatformSummary(rows, platforms), [rows, platforms]);
  const campaigns = useMemo(() => buildCampaignSummary(rows, platforms), [rows, platforms]);
  const currencies = useMemo(() => buildCurrencySummary(rows), [rows]);
  const grand = sumBDT(rows);
  const meta = REPORT_TYPES.find((t) => t.value === type)!;

  async function handlePrint() {
    if (canExport) {
      try {
        await supabase.rpc("log_report_export", {
          _report_type: `marketing_${type}`,
          _title: `${meta.label} (${formatRangeLabel(range)})`,
          _range_from: range.from,
          _range_to: range.to,
          _filters: { module: "marketing", report: type },
          _expense_count: rows.length,
          _total_amount: grand,
        } as never);
      } catch {
        /* archive is best-effort */
      }
    }
    window.print();
  }

  if (!canAccessModule("marketing")) {
    return (
      <div className="space-y-8">
        <PageHeader title="Marketing Reports" />
        <NoAccess />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="print:hidden">
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
      </div>

      <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <Select value={type} onValueChange={(v) => setType(v as MkReportType)}>
          <SelectTrigger className="sm:w-[320px]">
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
        <DateRangeFilter preset={preset} range={range} onChange={(p, r) => { setPreset(p); setRange(r); }} />
      </div>

      {loading ? (
        <Skeleton className="h-96 w-full rounded-lg" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={FileBarChart}
          title="No approved marketing costs in this range"
          description="Adjust the date range to generate a report."
        />
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">{meta.label}</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {meta.description} · {formatRangeLabel(range)}
              </p>
            </div>
            <Button size="sm" onClick={handlePrint} className="print:hidden">
              <Printer className="h-4 w-4" />
              Print / PDF
            </Button>
          </CardHeader>
          <CardContent>
            {type === "summary" && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Platform</TableHead>
                    <TableHead className="text-right">Costs</TableHead>
                    <TableHead className="text-right">Converted BDT</TableHead>
                    <TableHead className="text-right">% of total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {platformSummary.rows.map((p) => (
                    <TableRow key={p.id ?? "none"}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.count}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatBDT(p.total)}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.percentage.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-semibold">Grand total</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{rows.length}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatBDT(grand)}</TableCell>
                    <TableCell className="text-right font-semibold">100%</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            )}

            {type === "platform" && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Platform</TableHead>
                    <TableHead>Currencies</TableHead>
                    <TableHead className="text-right">Costs</TableHead>
                    <TableHead className="text-right">Converted BDT</TableHead>
                    <TableHead className="text-right">% of total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {platformSummary.rows.map((p) => (
                    <TableRow key={p.id ?? "none"}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{p.currencies.join(", ")}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.count}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatBDT(p.total)}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.percentage.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3} className="font-semibold">Grand total</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatBDT(grand)}</TableCell>
                    <TableCell className="text-right font-semibold">100%</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            )}

            {type === "campaign" && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead className="text-right">Costs</TableHead>
                    <TableHead className="text-right">Converted BDT</TableHead>
                    <TableHead className="text-right">% of total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((c, i) => (
                    <TableRow key={`${c.platformId}-${c.name}-${i}`}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.platformName}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.count}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatBDT(c.total)}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.percentage.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3} className="font-semibold">Grand total</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatBDT(grand)}</TableCell>
                    <TableCell className="text-right font-semibold">100%</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            )}

            {type === "currency" && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Currency</TableHead>
                    <TableHead className="text-right">Costs</TableHead>
                    <TableHead className="text-right">Original total</TableHead>
                    <TableHead className="text-right">Avg rate</TableHead>
                    <TableHead className="text-right">Converted BDT</TableHead>
                    <TableHead className="text-right">% of total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currencies.map((c) => (
                    <TableRow key={c.currency}>
                      <TableCell className="font-medium">{c.currency}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.count}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(c.originalTotal, c.currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{c.avgRate.toFixed(4)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatBDT(c.convertedTotal)}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.percentage.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={4} className="font-semibold">Grand total (BDT)</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatBDT(grand)}</TableCell>
                    <TableCell className="text-right font-semibold">100%</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
