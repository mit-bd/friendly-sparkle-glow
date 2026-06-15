import { createFileRoute, useNavigate, Link } from "@/lib/router";
import { useEffect, useState } from "react";
import { Loader2, FilePlus2, Hash, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AttachmentUploader, type AttachmentValue } from "@/components/AttachmentUploader";
import { ExpenseFields, type ExpenseFormValues } from "@/components/expenses/ExpenseFields";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { logExpenseEvent } from "@/lib/approvals";
import { logActivity } from "@/lib/audit";
import {
  fetchClassificationHistory,
  recordClassificationFeedback,
  createAiSubcategory,
  type ClassificationFeedback,
  type Suggestion,
} from "@/lib/ai-classify";
import { AiClassificationPanel } from "@/components/expenses/AiClassificationPanel";
import { SmartParsePanel } from "@/components/expenses/SmartParsePanel";
import { parseTransaction, type ParsedTransaction } from "@/lib/assistant";
import { createReceivable, createPayable } from "@/lib/finance";
import {
  fetchCategories,
  fetchSubcategories,
  type ExpenseCategory,
  type ExpenseSubcategory,
} from "@/lib/expenses";

export const Route = createFileRoute("/_authenticated/expenses/add")({
  head: () => ({ meta: [{ title: "Add Expense — Motion IT BD" }] }),
  component: AddExpensePage,
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function AddExpensePage() {
  const { can, isAdmin, user, profile } = useAuth();
  const navigate = useNavigate();
  const canCreate = isAdmin || can("expenses", "edit");

  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [subs, setSubs] = useState<ExpenseSubcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attachment, setAttachment] = useState<AttachmentValue | null>(null);
  const [history, setHistory] = useState<ClassificationFeedback[]>([]);
  /** Pending AI-proposed new subcategory (created on save). */
  const [pendingNewSub, setPendingNewSub] = useState<{ categoryId: string; name: string } | null>(null);
  /** The suggestion the user last accepted, kept for audit + learning. */
  const [acceptedSuggestion, setAcceptedSuggestion] = useState<Suggestion | null>(null);
  /** Voice / AI smart-parse state. */
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedTransaction | null>(null);
  const [routing, setRouting] = useState(false);

  const [form, setForm] = useState<ExpenseFormValues>({
    expense_date: todayISO(),
    category_id: "",
    subcategory_id: "",
    amount: "",
    description: "",
    notes: "",
    status: "submitted",
  });

  useEffect(() => {
    Promise.all([fetchCategories(), fetchSubcategories(), fetchClassificationHistory()])
      .then(([c, s, h]) => {
        setCategories(c);
        setSubs(s);
        setHistory(h);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load form data."))
      .finally(() => setLoading(false));
  }, []);

  if (!canCreate) {
    return (
      <div className="space-y-8">
        <PageHeader title="Add Expense" />
        <NoAccess />
      </div>
    );
  }

  function patch(p: Partial<ExpenseFormValues>) {
    // Any manual change to category/subcategory clears a pending AI-proposed sub.
    if (p.category_id !== undefined || p.subcategory_id !== undefined) {
      setPendingNewSub(null);
    }
    setForm((f) => ({ ...f, ...p }));
  }

  function applySuggestion(s: Suggestion) {
    setForm((f) => ({
      ...f,
      category_id: s.categoryId ?? f.category_id,
      subcategory_id: s.subcategoryId ?? "",
    }));
    setAcceptedSuggestion(s);
    if (!s.subcategoryId && s.proposeSubcategoryName && s.categoryId) {
      setPendingNewSub({ categoryId: s.categoryId, name: s.proposeSubcategoryName });
    } else {
      setPendingNewSub(null);
    }
  }

  // Live dictation already streams text straight into the description field, so
  // here we only run the AI smart-parse on the final transcript (intent /
  // receivable-payable detection). The description is left untouched.
  async function onVoiceFinal(text: string) {
    if (!text.trim()) return;
    setParsing(true);
    setParsed(null);
    try {
      const result = await parseTransaction(text, {
        categories: categories.map((c) => c.name),
      });
      setParsed(result);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not understand the voice input.");
    } finally {
      setParsing(false);
    }
  }

  function applyParsedExpense() {
    if (!parsed) return;
    const match = categories.find(
      (c) => c.name.toLowerCase() === (parsed.category_name || "").toLowerCase(),
    );
    setForm((f) => ({
      ...f,
      description: parsed.description?.trim() || f.description,
      amount: parsed.amount != null ? String(parsed.amount) : f.amount,
      expense_date: parsed.date || f.expense_date,
      notes: parsed.notes?.trim() || f.notes,
      category_id: match?.id ?? f.category_id,
      subcategory_id: match ? "" : f.subcategory_id,
    }));
    setParsed(null);
    toast.success("Form filled from your input.");
  }

  async function routeParsedLoan() {
    if (!parsed || !user) return;
    const amount = Number(parsed.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Could not detect a valid amount.");
      return;
    }
    setRouting(true);
    try {
      const lend = parsed.intent === "receivable" || parsed.intent === "collection";
      const base = {
        party_name: parsed.person_name?.trim() || parsed.description || "Unknown",
        party_type: parsed.party_type?.trim() || "other",
        contact_person: null,
        mobile: null,
        email: null,
        reference_number: null,
        amount,
        due_date: parsed.due_date || null,
        notes: parsed.notes || parsed.description || null,
      };
      if (lend) {
        const rec = await createReceivable({ ...base, collected_amount: 0 }, user.id);
        toast.success(`Receivable ${rec.receivable_number} created.`);
        navigate({ to: "/finance/receivables/$id", params: { id: rec.id } });
      } else {
        const pay = await createPayable({ ...base, paid_amount: 0 }, user.id);
        toast.success(`Payable ${pay.payable_number} created.`);
        navigate({ to: "/finance/payables/$id", params: { id: pay.id } });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the record.");
    } finally {
      setRouting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!form.category_id || (!form.subcategory_id && !pendingNewSub)) {
      toast.error("Please select a category and subcategory.");
      return;
    }
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }

    setSaving(true);

    // Resolve subcategory: create the AI-proposed one when needed.
    let subcategoryId = form.subcategory_id;
    let createdSub: { id: string; name: string } | null = null;
    if (!subcategoryId && pendingNewSub) {
      createdSub = await createAiSubcategory({
        categoryId: pendingNewSub.categoryId,
        name: pendingNewSub.name,
        createdBy: user.id,
      });
      if (!createdSub) {
        setSaving(false);
        toast.error("Could not create the suggested subcategory. Please pick one manually.");
        return;
      }
      subcategoryId = createdSub.id;
      await logActivity({
        action: "create",
        entityType: "subcategory",
        entityId: createdSub.id,
        entityLabel: createdSub.name,
        metadata: { ai_generated: true, category_id: pendingNewSub.categoryId },
      });
    }

    // Submissions move straight into the approval queue: Submitted → Pending Approval.
    const finalStatus = form.status === "submitted" ? "pending_approval" : form.status;
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        expense_number: "", // replaced by DB trigger with EXP-YYYY-000001
        expense_date: form.expense_date,
        category_id: form.category_id,
        subcategory_id: subcategoryId,
        amount,
        description: form.description.trim() || null,
        notes: form.notes.trim() || null,
        status: finalStatus,
        created_by: user.id,
      })
      .select("id, expense_number")
      .single();

    if (error || !data) {
      setSaving(false);
      toast.error(error?.message ?? "Failed to create expense.");
      return;
    }

    // Learning layer + audit: record whether the AI suggestion was accepted or overridden.
    if (acceptedSuggestion || form.description.trim()) {
      const overridden =
        !!acceptedSuggestion &&
        (acceptedSuggestion.categoryId !== form.category_id ||
          (acceptedSuggestion.subcategoryId
            ? acceptedSuggestion.subcategoryId !== subcategoryId
            : false));
      await recordClassificationFeedback({
        description: form.description,
        suggestedCategoryId: acceptedSuggestion?.categoryId ?? null,
        suggestedSubcategoryId: acceptedSuggestion?.subcategoryId ?? null,
        chosenCategoryId: form.category_id,
        chosenSubcategoryId: subcategoryId,
        createdBy: user.id,
      });
      if (acceptedSuggestion) {
        await logActivity({
          action: "update",
          entityType: "expense",
          entityId: data.id,
          entityLabel: data.expense_number,
          metadata: {
            ai_event: overridden ? "suggestion_overridden" : "suggestion_accepted",
            suggested_category_id: acceptedSuggestion.categoryId,
            chosen_category_id: form.category_id,
            confidence: acceptedSuggestion.confidence,
          },
        });
      }
    }

    // Record the opening entries in the permanent approval history.
    try {
      await logExpenseEvent({
        expenseId: data.id,
        actorId: user.id,
        action: "created",
        toStatus: finalStatus,
      });
      if (finalStatus !== "draft") {
        await logExpenseEvent({
          expenseId: data.id,
          actorId: user.id,
          action: "submitted",
          fromStatus: "draft",
          toStatus: finalStatus,
        });
      }
    } catch {
      /* best-effort history */
    }

    if (attachment) {
      const { error: attErr } = await supabase.from("expense_attachments").insert({
        expense_id: data.id,
        file_path: attachment.path,
        file_name: attachment.name,
        mime_type: attachment.mime,
        size_bytes: attachment.size,
        created_by: user.id,
      });
      if (attErr) toast.error(`Expense saved, but attachment failed: ${attErr.message}`);
    }

    setSaving(false);
    toast.success(`Expense ${data.expense_number} submitted.`);
    navigate({ to: "/expenses/$id", params: { id: data.id } });
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Add Expense"
        description="Submit a new expense. It must be approved before counting in reports."
        actions={
          <Button variant="outline" asChild>
            <Link to="/expenses">
              <ArrowLeft className="h-4 w-4" />
              All expenses
            </Link>
          </Button>
        }
      />

      {loading ? (
        <Skeleton className="h-[560px] w-full rounded-lg" />
      ) : (
        <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Expense details</CardTitle>
              </CardHeader>
              <CardContent>
                <ExpenseFields
                  value={form}
                  onChange={patch}
                  categories={categories}
                  subcategories={subs}
                  descriptionDictation={{ onFinal: onVoiceFinal, busy: parsing }}
                  afterDescription={
                    <>
                      <SmartParsePanel
                        parsed={parsed}
                        parsing={parsing}
                        onApplyExpense={applyParsedExpense}
                        onRoute={routeParsedLoan}
                        routing={routing}
                      />
                      <AiClassificationPanel
                        description={form.description}
                        categories={categories}
                        subcategories={subs}
                        history={history}
                        currentCategoryId={form.category_id}
                        currentSubcategoryId={form.subcategory_id}
                        onApply={applySuggestion}
                      />
                    </>
                  }
                />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Reference</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex items-start gap-3 rounded-md bg-brand-gradient-soft p-3">
                  <Hash className="mt-0.5 h-4 w-4 text-brand-to" />
                  <div>
                    <p className="font-medium text-foreground">Expense number</p>
                    <p className="text-muted-foreground">
                      Auto-generated on save (EXP-{new Date().getFullYear()}-000001)
                    </p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Created by</p>
                  <p className="font-medium text-foreground">
                    {profile?.full_name?.trim() || user?.email}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Attachment</CardTitle>
              </CardHeader>
              <CardContent>
                <AttachmentUploader
                  value={attachment}
                  onChange={setAttachment}
                  prefix={`${user?.id ?? "u"}/`}
                />
              </CardContent>
            </Card>

            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FilePlus2 className="h-4 w-4" />
              )}
              Submit expense
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}