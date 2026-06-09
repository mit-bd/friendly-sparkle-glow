import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import {
  Wallet,
  Building2,
  Activity,
  Megaphone,
  Package,
  Undo2,
  PackageX,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/expenses";
import { formatPct, type Kpi, type KpiKey } from "@/lib/intelligence";

const ICONS: Record<KpiKey, LucideIcon> = {
  total: Wallet,
  fixed: Building2,
  variable: Activity,
  marketing: Megaphone,
  product: Package,
  returnLoss: Undo2,
  damageLoss: PackageX,
};

export function KpiGrid({ kpis, loading }: { kpis: Kpi[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((k) => {
        const Icon = ICONS[k.key];
        // For costs/losses, an increase (up) is unfavourable.
        const bad = k.direction === "up" && k.upIsBad;
        const good = k.direction === "down" && k.upIsBad;
        const tone = bad ? "text-destructive" : good ? "text-success" : "text-muted-foreground";
        const Arrow =
          k.direction === "up" ? ArrowUpRight : k.direction === "down" ? ArrowDownRight : Minus;
        return (
          <Card key={k.key} className="relative overflow-hidden">
            <span className="absolute inset-x-0 top-0 h-1 bg-brand-gradient" aria-hidden />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{k.label}</CardTitle>
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-gradient-soft text-brand">
                <Icon className="h-3.5 w-3.5" />
              </span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tracking-tight tabular-nums">
                {formatCurrency(k.current)}
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className={cn("flex items-center gap-0.5 text-xs font-medium", tone)}>
                  <Arrow className="h-3.5 w-3.5" />
                  {formatPct(k.changePct)}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  prev {formatCurrency(k.previous)}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}