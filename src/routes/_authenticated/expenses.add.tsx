import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
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
    Promise.all([fetchCategories(), fetchSubcategories()])
      .then(([c, s]) => {
        setCategories(c);
        setSubs(s);
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
    setForm((f) => ({ ...f, ...p }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!form.category_id || !form.subcategory_id) {
      toast.error("Please select a category and subcategory.");
      return;
    }
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }

    setSaving(true);
    // Submissions move straight into the approval queue: Submitted → Pending Approval.
    const finalStatus = form.status === "submitted" ? "pending_approval" : form.status;
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        expense_number: "", // replaced by DB trigger with EXP-YYYY-000001
        expense_date: form.expense_date,
        category_id: form.category_id,
        subcategory_id: form.subcategory_id,
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