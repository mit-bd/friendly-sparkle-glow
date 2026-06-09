import { HeartPulse } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { HealthScore } from "@/lib/intelligence";

const BAND_TONE: Record<HealthScore["band"], string> = {
  Excellent: "text-success",
  Good: "text-chart-2",
  Warning: "text-warning",
  Critical: "text-destructive",
};

export function HealthScoreCard({ health }: { health: HealthScore }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HeartPulse className="h-4 w-4 text-brand" />
          Expense Health Score
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-4xl font-bold tabular-nums">{health.score}</p>
            <p className="text-xs text-muted-foreground">out of 100</p>
          </div>
          <span className={cn("text-lg font-semibold", BAND_TONE[health.band])}>{health.band}</span>
        </div>
        <Progress value={health.score} className="h-2" />
        <div className="space-y-2">
          {health.factors.map((f) => (
            <div key={f.label}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">{f.label}</span>
                <span className="text-muted-foreground">
                  {f.detail} · {f.score}/100
                </span>
              </div>
              <Progress value={f.score} className="mt-1 h-1.5" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}