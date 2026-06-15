import { useMemo } from "react";
import { Sparkles, Wand2, AlertTriangle, PlusCircle, Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  classify,
  type ClassificationFeedback,
  type Suggestion,
} from "@/lib/ai-classify";
import type { ExpenseCategory, ExpenseSubcategory } from "@/lib/expenses";

interface AiClassificationPanelProps {
  description: string;
  categories: ExpenseCategory[];
  subcategories: ExpenseSubcategory[];
  history: ClassificationFeedback[];
  currentCategoryId: string;
  currentSubcategoryId: string;
  onApply: (s: Suggestion) => void;
}

function confidenceTone(c: number): string {
  if (c >= 85) return "bg-chart-2/15 text-chart-2";
  if (c >= 60) return "bg-chart-1/15 text-chart-1";
  return "bg-warning/15 text-warning";
}

export function AiClassificationPanel({
  description,
  categories,
  subcategories,
  history,
  currentCategoryId,
  currentSubcategoryId,
  onApply,
}: AiClassificationPanelProps) {
  const suggestion = useMemo(
    () => classify({ description, categories, subcategories, history }),
    [description, categories, subcategories, history],
  );

  if (!description.trim()) {
    return (
      <div className="flex items-start gap-3 rounded-md border border-dashed border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        <Sparkles className="mt-0.5 h-4 w-4 text-brand-to" />
        <p>Start typing a description (e.g. "Facebook Ads June Campaign") and a smart category suggestion will appear here.</p>
      </div>
    );
  }

  if (!suggestion || (!suggestion.categoryId && !suggestion.isFixedCost)) {
    return (
      <div className="flex items-start gap-3 rounded-md border border-dashed border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        <Sparkles className="mt-0.5 h-4 w-4 text-muted-foreground" />
        <p>No confident match yet — keep typing or pick a category manually.</p>
      </div>
    );
  }

  const alreadyApplied =
    !!suggestion.categoryId &&
    currentCategoryId === suggestion.categoryId &&
    (suggestion.subcategoryId
      ? currentSubcategoryId === suggestion.subcategoryId
      : true);

  return (
    <div className="space-y-3 rounded-md border border-brand-to/30 bg-brand-gradient-soft p-3">
      {suggestion.categoryId && (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Wand2 className="h-4 w-4 text-brand-to" />
              AI Suggestion
            </span>
            <Badge
              variant="outline"
              className={`border-transparent font-medium ${confidenceTone(suggestion.confidence)}`}
            >
              {suggestion.confidence}% confidence
            </Badge>
          </div>

          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Suggested Category</p>
              <Badge variant="outline" className="border-brand-to/40 bg-background font-medium text-foreground">
                {suggestion.categoryName}
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Suggested Subcategory</p>
              {suggestion.subcategoryName ? (
                <Badge variant="outline" className="border-brand-to/40 bg-background font-medium text-foreground">
                  {suggestion.subcategoryName}
                </Badge>
              ) : suggestion.proposeSubcategoryName ? (
                <Badge variant="outline" className="border-dashed border-chart-1/50 bg-background font-medium text-chart-1">
                  <PlusCircle className="mr-1 h-3 w-3" />
                  Create "{suggestion.proposeSubcategoryName}"
                </Badge>
              ) : (
                <span className="text-xs text-muted-foreground">Pick a subcategory</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => onApply(suggestion)}
              disabled={alreadyApplied}
            >
              <Check className="h-4 w-4" />
              {alreadyApplied ? "Suggestion applied" : "Accept suggestion"}
            </Button>
            <span className="text-xs text-muted-foreground">
              You can still change the category or subcategory below.
            </span>
          </div>
        </>
      )}

      {suggestion.isFixedCost && (
        <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-2.5 text-xs text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p>
            This appears to be a <span className="font-medium">Fixed Cost</span> item. Consider managing
            it through Fixed Cost Management for recurring automation. You can still continue here.
          </p>
        </div>
      )}
    </div>
  );
}
