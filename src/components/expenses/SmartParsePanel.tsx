import { Sparkles, ArrowRight, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { INTENT_META, type ParsedTransaction } from "@/lib/assistant";

/**
 * AI Summary card shown beneath the Expense Description after a voice/typed
 * capture is parsed. For real expenses it offers a one-tap autofill; for
 * loan-style transactions it routes to Receivables/Payables (smart routing).
 */
export function SmartParsePanel({
  parsed,
  parsing,
  onApplyExpense,
  onRoute,
  routing,
}: {
  parsed: ParsedTransaction | null;
  parsing: boolean;
  onApplyExpense: () => void;
  onRoute: () => void;
  routing: boolean;
}) {
  if (parsing) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2.5 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Understanding your input…
      </div>
    );
  }
  if (!parsed) return null;

  const isExpense = parsed.intent === "expense" || parsed.intent === "unknown";

  return (
    <div className="mt-2 space-y-2 rounded-md border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">AI Summary</span>
        <Badge className={cn("border-transparent", INTENT_META[parsed.intent].badge)}>
          {INTENT_META[parsed.intent].label}
        </Badge>
      </div>
      <div className="flex items-start gap-2 rounded-md bg-brand-gradient-soft p-2.5 text-sm">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-to" />
        <p className="font-medium text-foreground">{parsed.summary}</p>
      </div>
      {isExpense ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onApplyExpense}
          className="w-full"
        >
          Apply to expense form
        </Button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            This looks like a {parsed.intent === "payable" || parsed.intent === "payment" ? "borrowing" : "lending"}{" "}
            transaction, not an expense. Create it in the right ledger instead.
          </p>
          <Button
            type="button"
            size="sm"
            onClick={onRoute}
            disabled={routing}
            className="w-full bg-brand-gradient text-brand-foreground hover:opacity-90"
          >
            {routing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            Create {INTENT_META[parsed.intent].route === "receivable" ? "Receivable" : "Payable"}
          </Button>
        </div>
      )}
    </div>
  );
}