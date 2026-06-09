import { Sparkles, TrendingDown, TrendingUp, Minus } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Insight } from "@/lib/intelligence";

export function ManagementSummary({ insights }: { insights: Insight[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-brand" />
          Management Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {insights.map((ins, i) => {
            const Icon = ins.tone === "negative" ? TrendingUp : ins.tone === "positive" ? TrendingDown : Minus;
            const tone =
              ins.tone === "negative"
                ? "text-destructive"
                : ins.tone === "positive"
                  ? "text-success"
                  : "text-muted-foreground";
            return (
              <li key={i} className="flex items-start gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone)} />
                <span>{ins.text}</span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}