import { createFileRoute, Link } from "@/lib/router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Megaphone, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { EmptyState } from "@/components/analytics/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { formatRangeLabel, type DateRange } from "@/lib/analytics";
import { formatDate } from "@/lib/expenses";
import {
  fetchApprovedMarketing,
  fetchPlatforms,
  buildCampaignSummary,
  formatBDT,
  formatMoney,
  sumBDT,
  type MarketingExpense,
} from "@/lib/marketing";

export const Route = createFileRoute("/_authenticated/marketing/platform/$id")({
  validateSearch: (s: Record<string, unknown>): { from?: string; to?: string } => ({
    from: typeof s.from === "string" ? s.from : undefined,
    to: typeof s.to === "string" ? s.to : undefined,
  }),
  head: () => ({ meta: [{ title: "Platform Detail — Motion IT BD" }] }),
  component: PlatformDetail,
});

function PlatformDetail() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const { canAccessModule } = useAuth();

  const now = new Date();
  const range: DateRange = {
    from: search.from ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
    to: search.to ?? new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10),
  };

  const [rows, setRows] = useState<MarketingExpense[]>([]);
  const [platformName, setPlatformName] = useState("Platform");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([fetchApprovedMarketing(range), fetchPlatforms(true)])
      .then(([r, p]) => {
        if (!active) return;
        setRows(r.filter((x) => x.platform_id === id));
        setPlatformName(p.find((x) => x.id === id)?.name ?? "Platform");
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load platform data."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, range.from, range.to]);

  const campaigns = useMemo(() => buildCampaignSummary(rows, []), [rows]);
  const byCampaign = useMemo(() => {
    const map = new Map<string, MarketingExpense[]>();
    for (const r of rows) {
      const key = r.campaign_name?.trim() || "Unnamed Campaign";
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    return map;
  }, [rows]);

  if (!canAccessModule("marketing")) {
    return (
      <div className="space-y-8">
        <PageHeader title="Platform Detail" />
        <NoAccess />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={platformName}
        description={`Approved campaigns · ${formatRangeLabel(range)}`}
        actions={
          <Button variant="outline" asChild>
            <Link to="/marketing">
              <ArrowLeft className="h-4 w-4" />
              Marketing
            </Link>
          </Button>
        }
      />

      {loading ? (
        <Skeleton className="h-96 w-full rounded-lg" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No approved costs for this platform"
          description="Try a different date range from the overview."
        />
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <p className="text-xs text-muted-foreground">Total platform spend (BDT)</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-brand-gradient">
                  {formatBDT(sumBDT(rows))}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Campaigns</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {campaigns.length}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Campaigns → expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                {campaigns.map((c) => {
                  const list = byCampaign.get(c.name) ?? [];
                  return (
                    <AccordionItem key={c.name} value={c.name}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex w-full items-center justify-between gap-3 pr-2">
                          <span className="font-medium">{c.name}</span>
                          <span className="flex items-center gap-3 text-sm">
                            <span className="text-muted-foreground">{c.count} item{c.count === 1 ? "" : "s"}</span>
                            <span className="font-semibold tabular-nums">{formatBDT(c.total)}</span>
                            <Badge variant="secondary" className="text-[10px]">
                              {c.percentage.toFixed(1)}%
                            </Badge>
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Number</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead className="text-right">Original</TableHead>
                              <TableHead className="text-right">Converted BDT</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="w-10" />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {list.map((e) => (
                              <TableRow key={e.id}>
                                <TableCell className="font-medium">{e.expense_number}</TableCell>
                                <TableCell>{formatDate(e.expense_date)}</TableCell>
                                <TableCell className="text-right tabular-nums text-muted-foreground">
                                  {formatMoney(e.original_amount ?? e.amount, e.currency)}
                                </TableCell>
                                <TableCell className="text-right font-medium tabular-nums">
                                  {formatBDT(e.amount)}
                                </TableCell>
                                <TableCell>
                                  <StatusBadge status={e.status as never} />
                                </TableCell>
                                <TableCell>
                                  <Link
                                    to="/expenses/$id"
                                    params={{ id: e.id }}
                                    className="text-muted-foreground hover:text-brand-to"
                                  >
                                    <ChevronRight className="h-4 w-4" />
                                  </Link>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
