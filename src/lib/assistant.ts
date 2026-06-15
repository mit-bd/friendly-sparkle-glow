import { supabase } from "@/integrations/supabase/client";

export type TransactionIntent =
  | "expense"
  | "receivable"
  | "payable"
  | "collection"
  | "payment"
  | "unknown";

export interface ParsedTransaction {
  intent: TransactionIntent;
  person_name: string | null;
  party_type: string | null;
  amount: number | null;
  date: string | null;
  due_date: string | null;
  description: string;
  category_name: string | null;
  notes: string | null;
  summary: string;
  confidence: number;
}

export const INTENT_META: Record<
  TransactionIntent,
  { label: string; route: string; badge: string }
> = {
  expense: { label: "Expense", route: "expense", badge: "bg-chart-4/15 text-chart-4" },
  receivable: { label: "Receivable · You lent", route: "receivable", badge: "bg-chart-2/15 text-chart-2" },
  payable: { label: "Payable · You borrowed", route: "payable", badge: "bg-destructive/15 text-destructive" },
  collection: { label: "Collection · Repaid to you", route: "receivable", badge: "bg-chart-2/15 text-chart-2" },
  payment: { label: "Payment · You repaid", route: "payable", badge: "bg-chart-1/15 text-chart-1" },
  unknown: { label: "Unrecognised", route: "expense", badge: "bg-muted text-muted-foreground" },
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

interface ParseContext {
  categories?: string[];
  parties?: string[];
}

/** Send raw (voice or typed) text to the AI parser for smart structuring + routing. */
export async function parseTransaction(
  text: string,
  ctx: ParseContext = {},
): Promise<ParsedTransaction> {
  const { data, error } = await supabase.functions.invoke("ai-assistant", {
    body: {
      action: "parse",
      text,
      today: todayISO(),
      categories: ctx.categories ?? [],
      parties: ctx.parties ?? [],
    },
  });
  if (error) throw new Error(error.message || "Could not reach the AI assistant.");
  if (data?.error) throw new Error(data.error);
  return data.result as ParsedTransaction;
}

export interface AskResult {
  answer: string;
}

/** Ask a free-form question answered against the user's actual ledger. */
export async function askAssistant(question: string): Promise<AskResult> {
  const { data, error } = await supabase.functions.invoke("ai-assistant", {
    body: { action: "ask", question },
  });
  if (error) throw new Error(error.message || "Could not reach the AI assistant.");
  if (data?.error) throw new Error(data.error);
  return { answer: data.answer as string };
}