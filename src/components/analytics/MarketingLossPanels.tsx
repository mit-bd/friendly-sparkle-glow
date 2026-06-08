import { Megaphone, AlertTriangle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/expenses";
import type { ExpenseCategory, ExpenseSubcategory } from "@/lib/expenses";
import {
  buildSubcategorySummary,
  sumAmount,
  type AnalyticsExpense,
} from "@/lib/analytics";
import { EmptyState } from "./EmptyState";

function rowsForCategoryKeywords(
  rows: AnalyticsExpense[],
  categories: ExpenseCategory[],
  keywords: string[],
) {
  const ids = new Set(
    categories
      .filter((c) => keywords.some((k) => c.name.toLowerCase().includes(k)))
      .map((c) => c.id),
  );
  return rows.filter((r) => r.category_id && ids.has(r.category_id));
}

interface PanelProps {
  rows: AnalyticsExpense[];
  categories: ExpenseCategory[];
  subcategories: ExpenseSubcategory[];
}

/** Marketing analytics — total + per-platform (subcategory) breakdown. */
export function MarketingPanel({ rows, categories, subcategories }: PanelProps) {
  const mkRows = rowsForCategoryKeywords(rows, categories, ["marketing"]);
  const total = sumAmount(mkRows);
  const breakdown = buildSubcategorySummary(mkRows, subcategories, categories);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Marketing Analytics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-brand-gradient-soft p-4">
          <div className="text-xs font-medium text-muted-foreground">Marketing Cost Total</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{formatCurrency(total)}</div>
          {/* Structure reserved for future multi-currency marketing spend. */}
          <div className="mt-0.5 text-xs text-muted-foreground">Base currency · BDT</div>
        </div>
        {breakdown.length === 0 ? (
          <EmptyState icon={Megaphone} title="No marketing spend in range." />
        ) : (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Platform Breakdown</div>
            {breakdown.map((b) => (
              <div key={b.id ?? b.name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate">{b.name}</span>
                  <span className="font-medium tabular-nums">{formatCurrency(b.total)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-brand-gradient"
                    style={{ width: `${total > 0 ? Math.max((b.total / total) * 100, 1.5) : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Loss analytics — returns, damages and overall loss & adjustment summary. */
export function LossPanel({ rows, categories, subcategories }: PanelProps) {
  const lossRows = rowsForCategoryKeywords(rows, categories, ["loss", "adjustment"]);
  const breakdown = buildSubcategorySummary(lossRows, subcategories, categories);
  const sumKw = (kw: string[]) =>
    sumAmount(
      lossRows.filter((r) => {
        const sub = subcategories.find((s) => s.id === r.subcategory_id);
        return sub && kw.some((k) => sub.name.toLowerCase().includes(k));
      }),
    );
  const returnTotal = sumKw(["return", "refund"]);
  const damageTotal = sumKw(["damage"]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Loss & Adjustment Analytics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border p-3">
            <div className="text-xs text-muted-foreground">Return Cost Total</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">
              {formatCurrency(returnTotal)}
            </div>
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="text-xs text-muted-foreground">Damage Cost Total</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">
              {formatCurrency(damageTotal)}
            </div>
          </div>
        </div>
        {breakdown.length === 0 ? (
          <EmptyState icon={AlertTriangle} title="No losses recorded in range." />
        ) : (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Loss & Adjustment Summary</div>
            {breakdown.map((b) => (
              <div
                key={b.id ?? b.name}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
              >
                <span className="truncate">{b.name}</span>
                <span className="font-medium tabular-nums">{formatCurrency(b.total)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}