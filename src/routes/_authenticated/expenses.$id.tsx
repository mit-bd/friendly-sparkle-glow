import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  Pencil,
  CheckCircle2,
  XCircle,
  Trash2,
  FileText,
  Download,
  Eye,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { StatusBadge } from "@/components/StatusBadge";
import { AttachmentUploader, type AttachmentValue } from "@/components/AttachmentUploader";
import { ExpenseFields, type ExpenseFormValues } from "@/components/expenses/ExpenseFields";
import { ApprovalPanel } from "@/components/expenses/ApprovalPanel";
import { ExpenseTimeline } from "@/components/expenses/ExpenseTimeline";
import { ExpenseDiscussion } from "@/components/expenses/ExpenseDiscussion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getDownloadUrl, getSignedUrl, removeFile } from "@/lib/storage";
import {
  fetchExpenseEvents,
  logExpenseEvent,
  type ExpenseEvent,
} from "@/lib/approvals";
import {
  ATTACHMENT_BUCKET,
  fetchCategories,
  fetchSubcategories,
  fetchUserNames,
  formatCurrency,
  formatDate,
  formatDateTime,
  type Expense,
  type ExpenseAttachment,
  type ExpenseCategory,
  type ExpenseSubcategory,
} from "@/lib/expenses";

export const Route = createFileRoute("/_authenticated/expenses/$id")({
  head: () => ({ meta: [{ title: "Expense Details — Motion IT BD" }] }),
  component: ExpenseDetailsPage,
});

function ExpenseDetailsPage() {
  const { id } = Route.useParams();
  const { user, isAdmin, can, canAccessModule } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();

  const [expense, setExpense] = useState<Expense | null>(null);
  const [attachments, setAttachments] = useState<ExpenseAttachment[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [subs, setSubs] = useState<ExpenseSubcategory[]>([]);
  const [events, setEvents] = useState<ExpenseEvent[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("expenses").select("*").eq("id", id).maybeSingle();
    if (error || !data) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const exp = data as Expense;
    setExpense(exp);
    const [cats, subcats, atts, evts] = await Promise.all([
      fetchCategories(true),
      fetchSubcategories(true),
      supabase
        .from("expense_attachments")
        .select("*")
        .eq("expense_id", id)
        .order("created_at"),
      fetchExpenseEvents(id).catch(() => [] as ExpenseEvent[]),
    ]);
    setCategories(cats);
    setSubs(subcats);
    setAttachments((atts.data ?? []) as ExpenseAttachment[]);
    setEvents(evts);
    const ids = [
      exp.created_by,
      exp.updated_by,
      exp.submitted_by,
      exp.approved_by,
      exp.rejected_by,
      ...evts.map((e) => e.actor_id),
    ].filter(Boolean) as string[];
    setNames(await fetchUserNames(ids));
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!canAccessModule("expenses")) {
    return (
      <div className="space-y-8">
        <PageHeader title="Expense Details" />
        <NoAccess />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full rounded-lg" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-72 rounded-lg lg:col-span-2" />
          <Skeleton className="h-72 rounded-lg" />
        </div>
      </div>
    );
  }

  if (notFound || !expense) {
    return (
      <div className="space-y-8">
        <PageHeader title="Expense Details" />
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 px-6 py-20 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Receipt className="h-7 w-7" />
          </span>
          <h2 className="mt-5 text-lg font-medium text-foreground">Expense not found</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            This expense may have been removed or you don't have access to it.
          </p>
          <Button className="mt-5" asChild>
            <Link to="/expenses">Back to all expenses</Link>
          </Button>
        </div>
      </div>
    );
  }

  const isOwner = expense.created_by === user?.id;
  const canApprove = isAdmin || can("expenses", "approve");
  const isLocked = expense.status === "approved";
  // Approved expenses are locked: only admins / approvers can modify them.
  const canEdit = isLocked
    ? canApprove
    : isAdmin || (isOwner && can("expenses", "edit"));
  const canComment = isAdmin || can("expenses", "view") || isOwner;
  const isOpenForReview = ["submitted", "pending_approval", "revision_requested"].includes(
    expense.status,
  );
  const catName = expense.category_id ? categories.find((c) => c.id === expense.category_id)?.name : null;
  const subName = expense.subcategory_id ? subs.find((s) => s.id === expense.subcategory_id)?.name : null;

  async function setStatus(status: Expense["status"]) {
    setBusy(true);
    const { error } = await supabase.from("expenses").update({ status }).eq("id", expense!.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Status updated.");
    load();
  }

  async function addAttachment(value: AttachmentValue | null) {
    if (!value || !user) return;
    const { error } = await supabase.from("expense_attachments").insert({
      expense_id: expense!.id,
      file_path: value.path,
      file_name: value.name,
      mime_type: value.mime,
      size_bytes: value.size,
      created_by: user.id,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Attachment added.");
    load();
  }

  async function deleteAttachment(att: ExpenseAttachment) {
    await removeFile(ATTACHMENT_BUCKET, att.file_path);
    const { error } = await supabase.from("expense_attachments").delete().eq("id", att.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Attachment removed.");
    load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={expense.expense_number}
        description={`Submitted ${formatDate(expense.created_at)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" asChild>
              <Link to="/expenses">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
            </Button>
            {canEdit && (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            )}
          </div>
        }
      />

      {/* Status & approval bar */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Current status</span>
            <StatusBadge status={expense.status} />
          </div>
          <div className="flex flex-wrap gap-2">
            {canApprove && !["approved", "rejected", "deleted"].includes(expense.status) && (
              <>
                <Button size="sm" disabled={busy} onClick={() => setStatus("approved")}>
                  <CheckCircle2 className="h-4 w-4" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setStatus("rejected")}
                  className="text-destructive hover:text-destructive"
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </Button>
              </>
            )}
            {canEdit && expense.status !== "deleted" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={busy}>
                    <Trash2 className="h-4 w-4" />
                    Move to Deleted
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Move this expense to Deleted?</AlertDialogTitle>
                    <AlertDialogDescription>
                      It will be hidden from the main list and excluded from reports. This can be
                      restored later from the recycle bin.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => setStatus("deleted")}>
                      Move to Deleted
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Expense information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <Field label="Expense number" value={expense.expense_number} />
              <Field label="Expense date" value={formatDate(expense.expense_date)} />
              <Field label="Category" value={catName ?? "—"} />
              <Field label="Subcategory" value={subName ?? "—"} />
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground">Amount</p>
                <p className="mt-0.5 text-2xl font-semibold tabular-nums text-brand-gradient">
                  {formatCurrency(expense.amount)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Description & notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground">Description</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                  {expense.description || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                  {expense.notes || "—"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Attachments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {attachments.length === 0 && !canEdit && (
                <p className="text-sm text-muted-foreground">No attachments.</p>
              )}
              {attachments.map((att) => (
                <AttachmentRow key={att.id} att={att} canEdit={canEdit} onDelete={() => deleteAttachment(att)} />
              ))}
              {canEdit && (
                <AttachmentUploader value={null} onChange={addAttachment} prefix={`${user?.id ?? "u"}/`} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Audit trail</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <Field label="Created by" value={expense.created_by ? names[expense.created_by] ?? "—" : "—"} />
              <Field label="Created date" value={formatDateTime(expense.created_at)} />
              <Field label="Last updated by" value={expense.updated_by ? names[expense.updated_by] ?? "—" : "—"} />
              <Field label="Last updated date" value={formatDateTime(expense.updated_at)} />
            </CardContent>
          </Card>
        </div>
      </div>

      {canEdit && (
        <EditExpenseDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          expense={expense}
          categories={categories}
          subcategories={subs}
          onSaved={() => {
            setEditOpen(false);
            load();
            router.invalidate();
          }}
        />
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function AttachmentRow({
  att,
  canEdit,
  onDelete,
}: {
  att: ExpenseAttachment;
  canEdit: boolean;
  onDelete: () => void;
}) {
  const isImage = att.mime_type?.startsWith("image/");
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (isImage) getSignedUrl(ATTACHMENT_BUCKET, att.file_path).then((u) => active && setThumb(u));
    return () => {
      active = false;
    };
  }, [att.file_path, isImage]);

  async function open(download: boolean) {
    const url = download
      ? await getDownloadUrl(ATTACHMENT_BUCKET, att.file_path, att.file_name ?? undefined)
      : await getSignedUrl(ATTACHMENT_BUCKET, att.file_path);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-background p-2.5">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-muted">
        {isImage && thumb ? (
          <img src={thumb} alt={att.file_name ?? "attachment"} className="h-full w-full object-cover" />
        ) : (
          <FileText className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{att.file_name ?? "Attachment"}</p>
        <div className="mt-1 flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Preview" onClick={() => open(false)}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Download" onClick={() => open(true)}>
            <Download className="h-4 w-4" />
          </Button>
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              aria-label="Remove attachment"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function EditExpenseDialog({
  open,
  onClose,
  expense,
  categories,
  subcategories,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  expense: Expense;
  categories: ExpenseCategory[];
  subcategories: ExpenseSubcategory[];
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ExpenseFormValues>({
    expense_date: expense.expense_date,
    category_id: expense.category_id ?? "",
    subcategory_id: expense.subcategory_id ?? "",
    amount: String(expense.amount),
    description: expense.description ?? "",
    notes: expense.notes ?? "",
    status: expense.status,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        expense_date: expense.expense_date,
        category_id: expense.category_id ?? "",
        subcategory_id: expense.subcategory_id ?? "",
        amount: String(expense.amount),
        description: expense.description ?? "",
        notes: expense.notes ?? "",
        status: expense.status,
      });
    }
  }, [open, expense]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
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
    const { error } = await supabase
      .from("expenses")
      .update({
        expense_date: form.expense_date,
        category_id: form.category_id,
        subcategory_id: form.subcategory_id,
        amount,
        description: form.description.trim() || null,
        notes: form.notes.trim() || null,
        status: form.status,
      })
      .eq("id", expense.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Expense updated.");
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit {expense.expense_number}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-5">
          <ExpenseFields
            value={form}
            onChange={(p) => setForm((f) => ({ ...f, ...p }))}
            categories={categories}
            subcategories={subcategories}
            extraStatuses={[expense.status]}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}