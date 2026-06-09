import { AlertTriangle, ShieldCheck, TrendingDown, TrendingUp } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/expenses";
import { formatPct, type Anomaly } from "@/lib/intelligence";

export function AnomalyPanel({ anomalies }: { anomalies: Anomaly[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Anomaly Detection</CardTitle>
        <Badge variant="outline" className="gap-1">
          <AlertTriangle className="h-3.5 w-3.5" />
          {anomalies.length} flagged
        </Badge>
      </CardHeader>
      <CardContent>
        {anomalies.length === 0 ? (
          <div className="flex items-center gap-2 rounded-md border border-success/40 bg-success/10 px-3 py-3 text-sm text-success">
            <ShieldCheck className="h-4 w-4" />
            No abnormal cost movements detected this month.
          </div>
        ) : (
          <ul className="space-y-2">
            {anomalies.map((a) => {
              const up = a.direction === "increase";
              const Icon = up ? TrendingUp : TrendingDown;
              const tone = a.severity === "critical" ? "border-destructive/50 bg-destructive/10" : "border-warning/50 bg-warning/10";
              const text = a.severity === "critical" ? "text-destructive" : "text-warning";
              return (
                <li key={a.key} className={cn("rounded-md border px-3 py-2.5", tone)}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <Icon className={cn("h-4 w-4 shrink-0", text)} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{a.label}</span>
                        <span className="block text-xs text-muted-foreground">{a.scope}</span>
                      </span>
                    </span>
                    <span className={cn("shrink-0 text-sm font-semibold", text)}>
                      {up ? "Abnormal increase" : "Sharp drop"} {formatPct(a.changePct)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                    Average {formatCurrency(a.average)} · Current {formatCurrency(a.current)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}