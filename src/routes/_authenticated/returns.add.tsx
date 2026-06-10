import { createFileRoute, Link, useNavigate } from "@/lib/router";
import { useEffect, useState } from "react";
import { ArrowLeft, FilePlus2, Hash, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AttachmentUploader, type AttachmentValue } from "@/components/AttachmentUploader";
import { ReturnFields, type ReturnFormValues } from "@/components/loss/ReturnFields";
import { useAuth } from "@/lib/auth-context";
import { fetchCategories, type ExpenseCategory } from "@/lib/expenses";
import { addReturnAttachment, createReturn, fetchReturnReasons, type ReturnReason } from "@/lib/loss";

export const Route = createFileRoute("/_authenticated/returns/add")({
  head: () => ({ meta: [{ title: "Add Return — Motion IT BD" }] }),
  component: AddReturnPage,
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function AddReturnPage() {
  const { can, isAdmin, user, profile } = useAuth();
  const navigate = useNavigate();
  const canCreate = isAdmin || can("returns", "edit");

  const [reasons, setReasons] = useState<ReturnReason[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attachment, setAttachment] = useState<AttachmentValue | null>(null);
  const [form, setForm] = useState<ReturnFormValues>({
    return_date: todayISO(), category_id: "", reason_id: "", product_name: "", quantity: "1",
    customer_notes: "", loss_amount: "", recoverable_amount: "", notes: "", status: "submitted",
  });

  useEffect(() => {
    Promise.all([fetchReturnReasons(), fetchCategories()])
      .then(([r, c]) => { setReasons(r); setCategories(c); })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load form data."))
      .finally(() => setLoading(false));
  }, []);

  if (!canCreate) {
    return (<div className="space-y-8"><PageHeader title="Add Return" /><NoAccess /></div>);
  }

  function patch(p: Partial<ReturnFormValues>) {
    setForm((f) => ({ ...f, ...p }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!form.product_name.trim()) { toast.error("Please enter a product name."); return; }
    const loss = Number(form.loss_amount);
    if (!Number.isFinite(loss) || loss < 0) { toast.error("Please enter a valid loss amount."); return; }
    setSaving(true);
    try {
      const created = await createReturn({
        return_date: form.return_date,
        category_id: form.category_id || null,
        reason_id: form.reason_id || null,
        product_name: form.product_name.trim(),
        quantity: Number(form.quantity) || 0,
        customer_notes: form.customer_notes.trim() || null,
        loss_amount: loss,
        recoverable_amount: Number(form.recoverable_amount) || 0,
        notes: form.notes.trim() || null,
        status: form.status,
      }, user.id);
      if (attachment) {
        try { await addReturnAttachment(created.id, attachment, user.id); }
        catch (attErr) { toast.error(`Return saved, but attachment failed: ${attErr instanceof Error ? attErr.message : "error"}`); }
      }
      toast.success(`Return ${created.return_number} submitted.`);
      navigate({ to: "/returns/$id", params: { id: created.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create return.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Add Return"
        description="Record a returned item. It must be approved before counting toward loss totals."
        actions={
          <Button variant="outline" asChild>
            <Link to="/returns"><ArrowLeft className="h-4 w-4" />All returns</Link>
          </Button>
        }
      />
      {loading ? (
        <Skeleton className="h-[560px] w-full rounded-lg" />
      ) : (
        <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Return details</CardTitle></CardHeader>
              <CardContent>
                <ReturnFields value={form} onChange={patch} reasons={reasons} categories={categories} />
              </CardContent>
            </Card>
          </div>
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Reference</CardTitle></CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex items-start gap-3 rounded-md bg-brand-gradient-soft p-3">
                  <Hash className="mt-0.5 h-4 w-4 text-brand-to" />
                  <div>
                    <p className="font-medium text-foreground">Return number</p>
                    <p className="text-muted-foreground">Auto-generated on save (RET-{new Date().getFullYear()}-000001)</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Created by</p>
                  <p className="font-medium text-foreground">{profile?.full_name?.trim() || user?.email}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Attachment</CardTitle></CardHeader>
              <CardContent>
                <AttachmentUploader value={attachment} onChange={setAttachment} prefix={`${user?.id ?? "u"}/`} />
              </CardContent>
            </Card>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />}
              Submit return
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}