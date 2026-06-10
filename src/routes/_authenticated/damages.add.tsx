import { createFileRoute } from "@/lib/router"
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
import { DamageFields, type DamageFormValues } from "@/components/loss/DamageFields";
import { useAuth } from "@/lib/auth-context";
import { addDamageAttachment, createDamage, fetchDamageTypes, type DamageType } from "@/lib/loss";

export const Route = createFileRoute("/_authenticated/damages/add")({
  head: () => ({ meta: [{ title: "Add Damage — Motion IT BD" }] }),
  component: AddDamagePage,
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function AddDamagePage() {
  const { can, isAdmin, user, profile } = useAuth();
  const navigate = useNavigate();
  const canCreate = isAdmin || can("damages", "edit");

  const [types, setTypes] = useState<DamageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attachment, setAttachment] = useState<AttachmentValue | null>(null);
  const [form, setForm] = useState<DamageFormValues>({
    damage_date: todayISO(), type_id: "", product_name: "", quantity: "1", damage_value: "", notes: "", status: "submitted",
  });

  useEffect(() => {
    fetchDamageTypes()
      .then(setTypes)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load form data."))
      .finally(() => setLoading(false));
  }, []);

  if (!canCreate) {
    return (<div className="space-y-8"><PageHeader title="Add Damage" /><NoAccess /></div>);
  }

  function patch(p: Partial<DamageFormValues>) {
    setForm((f) => ({ ...f, ...p }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!form.product_name.trim()) { toast.error("Please enter a product name."); return; }
    const value = Number(form.damage_value);
    if (!Number.isFinite(value) || value < 0) { toast.error("Please enter a valid damage value."); return; }
    setSaving(true);
    try {
      const created = await createDamage({
        damage_date: form.damage_date,
        type_id: form.type_id || null,
        product_name: form.product_name.trim(),
        quantity: Number(form.quantity) || 0,
        damage_value: value,
        notes: form.notes.trim() || null,
        status: form.status,
      }, user.id);
      if (attachment) {
        try { await addDamageAttachment(created.id, attachment, user.id); }
        catch (attErr) { toast.error(`Damage saved, but attachment failed: ${attErr instanceof Error ? attErr.message : "error"}`); }
      }
      toast.success(`Damage ${created.damage_number} submitted.`);
      navigate({ to: "/damages/$id", params: { id: created.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create damage.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Add Damage"
        description="Record damaged inventory. It must be approved before counting toward loss totals."
        actions={
          <Button variant="outline" asChild>
            <Link to="/damages"><ArrowLeft className="h-4 w-4" />All damages</Link>
          </Button>
        }
      />
      {loading ? (
        <Skeleton className="h-[560px] w-full rounded-lg" />
      ) : (
        <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Damage details</CardTitle></CardHeader>
              <CardContent>
                <DamageFields value={form} onChange={patch} types={types} />
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
                    <p className="font-medium text-foreground">Damage number</p>
                    <p className="text-muted-foreground">Auto-generated on save (DMG-{new Date().getFullYear()}-000001)</p>
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
              Submit damage
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}