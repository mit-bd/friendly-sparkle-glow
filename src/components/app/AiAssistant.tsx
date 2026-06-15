import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  X,
  Send,
  Loader2,
  Wand2,
  MessageSquare,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useNavigate } from "@/lib/router";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { VoiceButton } from "@/components/voice/VoiceButton";
import {
  parseTransaction,
  askAssistant,
  INTENT_META,
  type ParsedTransaction,
} from "@/lib/assistant";
import {
  createReceivable,
  createPayable,
  fetchReceivables,
  fetchPayables,
} from "@/lib/finance";
import { fetchCategories, type ExpenseCategory } from "@/lib/expenses";

type Tab = "entry" | "ask";
interface ChatMsg {
  role: "user" | "assistant";
  text: string;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function AiAssistant() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("entry");

  // Shared context for better parsing.
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [parties, setParties] = useState<string[]>([]);

  // Smart entry state.
  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedTransaction | null>(null);
  const [saving, setSaving] = useState(false);

  // Ask state.
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    fetchCategories().then(setCategories).catch(() => {});
    Promise.all([fetchReceivables(), fetchPayables()])
      .then(([r, p]) => {
        const names = [...new Set([...r, ...p].map((x) => x.party_name).filter(Boolean))];
        setParties(names.slice(0, 80));
      })
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, asking]);

  async function runParse(input?: string) {
    const value = (input ?? text).trim();
    if (!value) return;
    setText(value);
    setParsing(true);
    setParsed(null);
    try {
      const result = await parseTransaction(value, {
        categories: categories.map((c) => c.name),
        parties,
      });
      setParsed(result);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not understand that.");
    } finally {
      setParsing(false);
    }
  }

  function patchParsed(p: Partial<ParsedTransaction>) {
    setParsed((cur) => (cur ? { ...cur, ...p } : cur));
  }

  function resetEntry() {
    setText("");
    setParsed(null);
  }

  async function confirmСreateGuard() {
    /* placeholder to avoid accidental name clashes */
  }

  async function confirmCreate() {
    if (!parsed || !user) return;
    const amount = Number(parsed.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Please set a valid amount.");
      return;
    }
    setSaving(true);
    try {
      const intent = parsed.intent;
      if (intent === "receivable" || intent === "collection") {
        const rec = await createReceivable(
          {
            party_name: parsed.person_name?.trim() || parsed.description || "Unknown",
            party_type: parsed.party_type?.trim() || "other",
            contact_person: null,
            mobile: null,
            email: null,
            reference_number: null,
            amount,
            collected_amount: 0,
            due_date: parsed.due_date || null,
            notes: parsed.notes || parsed.description || null,
          },
          user.id,
        );
        toast.success(`Receivable ${rec.receivable_number} created (pending approval).`);
        setOpen(false);
        resetEntry();
        navigate({ to: "/finance/receivables/$id", params: { id: rec.id } });
        return;
      }
      if (intent === "payable" || intent === "payment") {
        const pay = await createPayable(
          {
            party_name: parsed.person_name?.trim() || parsed.description || "Unknown",
            party_type: parsed.party_type?.trim() || "other",
            contact_person: null,
            mobile: null,
            email: null,
            reference_number: null,
            amount,
            paid_amount: 0,
            due_date: parsed.due_date || null,
            notes: parsed.notes || parsed.description || null,
          },
          user.id,
        );
        toast.success(`Payable ${pay.payable_number} created (pending approval).`);
        setOpen(false);
        resetEntry();
        navigate({ to: "/finance/payables/$id", params: { id: pay.id } });
        return;
      }
      // expense (and unknown -> treated as expense)
      const match = categories.find(
        (c) => c.name.toLowerCase() === (parsed.category_name || "").toLowerCase(),
      );
      const { data, error } = await supabase
        .from("expenses")
        .insert({
          expense_number: "",
          expense_date: parsed.date || todayISO(),
          category_id: match?.id ?? null,
          subcategory_id: null,
          amount,
          description: parsed.description?.trim() || null,
          notes: parsed.notes?.trim() || null,
          status: "pending_approval",
          created_by: user.id,
        })
        .select("id, expense_number")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Failed to create expense.");
      toast.success(`Expense ${data.expense_number} created (pending approval).`);
      setOpen(false);
      resetEntry();
      navigate({ to: "/expenses/$id", params: { id: data.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the record.");
    } finally {
      setSaving(false);
    }
  }

  async function send(q?: string) {
    const value = (q ?? question).trim();
    if (!value) return;
    setMessages((m) => [...m, { role: "user", text: value }]);
    setQuestion("");
    setAsking(true);
    try {
      const { answer } = await askAssistant(value);
      setMessages((m) => [...m, { role: "assistant", text: answer }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not get an answer.";
      setMessages((m) => [...m, { role: "assistant", text: `⚠️ ${msg}` }]);
    } finally {
      setAsking(false);
    }
  }

  const SUGGESTED = [
    "আমার কাছে কার সবচেয়ে বেশি পাওনা আছে?",
    "আমি কার কাছে সবচেয়ে বেশি ধারী?",
    "এই মাসে কত টাকা খরচ হয়েছে?",
    "Show overdue payments.",
  ];

  return (
    <>
      {/* Floating launcher */}
      {!open && (
        <Button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-brand-gradient text-brand-foreground shadow-lg hover:opacity-90"
          aria-label="Open AI assistant"
        >
          <Sparkles className="h-6 w-6" />
        </Button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[min(640px,calc(100vh-3rem))] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between bg-brand-gradient px-4 py-3 text-brand-foreground">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              <span className="font-semibold">AI Assistant</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              className="h-8 w-8 text-brand-foreground hover:bg-white/20"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Tabs */}
          <div className="grid grid-cols-2 border-b border-border">
            <button
              onClick={() => setTab("entry")}
              className={cn(
                "flex items-center justify-center gap-2 py-2.5 text-sm font-medium",
                tab === "entry" ? "border-b-2 border-brand-to text-foreground" : "text-muted-foreground",
              )}
            >
              <Wand2 className="h-4 w-4" /> Smart Entry
            </button>
            <button
              onClick={() => setTab("ask")}
              className={cn(
                "flex items-center justify-center gap-2 py-2.5 text-sm font-medium",
                tab === "ask" ? "border-b-2 border-brand-to text-foreground" : "text-muted-foreground",
              )}
            >
              <MessageSquare className="h-4 w-4" /> Ask
            </button>
          </div>

          {/* Smart Entry */}
          {tab === "entry" && (
            <div className="flex min-h-0 flex-1 flex-col">
              <ScrollArea className="flex-1">
                <div className="space-y-4 p-4">
                  <p className="text-xs text-muted-foreground">
                    Speak or type in Bangla, English or Banglish. e.g. "রাকিবকে ৫০০ টাকা ধার দিলাম" or
                    "Gave Rafi 300 taka".
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Describe the transaction</Label>
                      <VoiceButton onResult={(t) => runParse(t)} onInterim={(t) => setText(t)} busy={parsing} />
                    </div>
                    <Textarea
                      rows={2}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="e.g. আজকে রাকিবকে ৫০০ টাকা ধার দিলাম"
                    />
                    <Button
                      onClick={() => runParse()}
                      disabled={parsing || !text.trim()}
                      className="w-full bg-brand-gradient text-brand-foreground hover:opacity-90"
                    >
                      {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                      Analyze
                    </Button>
                  </div>

                  {parsed && (
                    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
                      <div className="flex items-center justify-between">
                        <Badge className={cn("border-transparent", INTENT_META[parsed.intent].badge)}>
                          {INTENT_META[parsed.intent].label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {Math.round((parsed.confidence || 0) * 100)}% confident
                        </span>
                      </div>
                      <div className="flex items-start gap-2 rounded-md bg-brand-gradient-soft p-2.5 text-sm">
                        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-to" />
                        <p className="font-medium text-foreground">{parsed.summary}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">{parsed.intent === "expense" ? "Description" : "Person / Party"}</Label>
                          <Input
                            value={parsed.intent === "expense" ? parsed.description : parsed.person_name ?? ""}
                            onChange={(e) =>
                              parsed.intent === "expense"
                                ? patchParsed({ description: e.target.value })
                                : patchParsed({ person_name: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Amount (৳)</Label>
                          <Input
                            type="number"
                            value={parsed.amount ?? ""}
                            onChange={(e) => patchParsed({ amount: e.target.value === "" ? null : Number(e.target.value) })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Date</Label>
                          <Input
                            type="date"
                            value={parsed.date ?? todayISO()}
                            onChange={(e) => patchParsed({ date: e.target.value })}
                          />
                        </div>
                        {parsed.intent === "expense" && (
                          <div className="col-span-2 space-y-1">
                            <Label className="text-xs">Category</Label>
                            <Select
                              value={
                                categories.find(
                                  (c) => c.name.toLowerCase() === (parsed.category_name || "").toLowerCase(),
                                )?.id || undefined
                              }
                              onValueChange={(v) =>
                                patchParsed({ category_name: categories.find((c) => c.id === v)?.name ?? null })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Uncategorised" />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        {(parsed.intent === "receivable" || parsed.intent === "payable") && (
                          <div className="col-span-2 space-y-1">
                            <Label className="text-xs">Due date (optional)</Label>
                            <Input
                              type="date"
                              value={parsed.due_date ?? ""}
                              onChange={(e) => patchParsed({ due_date: e.target.value || null })}
                            />
                          </div>
                        )}
                      </div>

                      {(parsed.intent === "collection" || parsed.intent === "payment") && (
                        <p className="rounded-md bg-warning/10 p-2 text-xs text-warning-foreground">
                          This is a repayment. Creating a record here opens the matching ledger so you can record the
                          settlement against the original entry.
                        </p>
                      )}

                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={resetEntry} disabled={saving}>
                          Discard
                        </Button>
                        <Button
                          className="flex-1 bg-brand-gradient text-brand-foreground hover:opacity-90"
                          onClick={confirmCreate}
                          disabled={saving}
                        >
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          Confirm & Create
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Ask */}
          {tab === "ask" && (
            <div className="flex min-h-0 flex-1 flex-col">
              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages.length === 0 && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">Ask about your ledger — answered from your real data.</p>
                    <div className="flex flex-wrap gap-2">
                      {SUGGESTED.map((s) => (
                        <button
                          key={s}
                          onClick={() => send(s)}
                          className="rounded-full border border-border bg-muted/40 px-3 py-1.5 text-left text-xs hover:bg-muted"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      "max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm",
                      m.role === "user"
                        ? "ml-auto bg-brand-gradient text-brand-foreground"
                        : "bg-muted text-foreground",
                    )}
                  >
                    {m.text}
                  </div>
                ))}
                {asking && (
                  <div className="flex w-fit items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
                  </div>
                )}
              </div>
              <div className="border-t border-border p-3">
                <div className="flex items-end gap-2">
                  <VoiceButton onResult={(t) => send(t)} showLang />
                  <Input
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    placeholder="Ask anything…"
                    disabled={asking}
                  />
                  <Button
                    size="icon"
                    onClick={() => send()}
                    disabled={asking || !question.trim()}
                    className="bg-brand-gradient text-brand-foreground hover:opacity-90"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* keep tree-shaker friendly imports referenced */
void ArrowRight;
void confirmСreateGuard;