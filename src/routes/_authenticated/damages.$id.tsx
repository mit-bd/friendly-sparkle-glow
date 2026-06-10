import { createFileRoute } from "@/lib/router"
import { createFileRoute, Link, useRouter } from "@/lib/router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Download, Eye, FileText, Loader2, Pencil, Trash2, PackageX } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { StatusBadge } from "@/components/StatusBadge";
import { AttachmentUploader, type AttachmentValue } from "@/components/AttachmentUploader";
import { DamageFields, type DamageFormValues } from "@/components/loss/DamageFields";
import { LossApprovalPanel } from "@/components/loss/LossApprovalPanel";
import { LossDiscussion } from "@/components/loss/LossDiscussion";
import { ExpenseTimeline } from "@/components/expenses/ExpenseTimeline";
import { ChangeHistory } from "@/components/audit/ChangeHistory";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth-context";
import { getDownloadUrl, getSignedUrl, removeFile } from "@/lib/storage";
import { fetchFieldChanges, type FieldChange } from "@/lib/audit";
import { ATTACHMENT_BUCKET, fetchUserNames, formatDate, formatDateTime } from "@/lib/expenses";
import type { ExpenseEvent } from "@/lib/approvals";
import {
  addDamageAttachment, deleteLossAttachment, fetchDamage, fetchDamageAttachments, fetchDamageEvents, fetchDamageTypes,
  formatTk, setLossStatus, updateDamage, type DamageRecord, type DamageType, type LossAttachment, type LossEvent,
} from "@/lib/loss";

export const Route = createFileRoute("/_authenticated/damages/$id")({
  head: () => ({ meta: [{ title: "Damage Details — Motion IT BD" }] }),
  component: DamageDetailsPage,
});

function DamageDetailsPage() {
  const { id } = Route.useParams();
  const { user, isAdmin, can, canAccessModule } = useAuth();
  const router = useRouter();

  const [record, setRecord] = useState<DamageRecord | null>(null);
  const [attachments, setAttachments] = useState<LossAttachment[]>([]);
  const [types, setTypes] = useState<DamageType[]>([]);
  const [events, setEvents] = useState<LossEvent[]>([]);
  const [changes, setChanges] = useState<FieldChange[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const rec = await fetchDamage(id).catch(() => null);
    if (!rec) { setNotFound(true); setLoading(false); return; }
    setRecord(rec);
    const [tp, atts, evts, fch] = await Promise.all([
      fetchDamageTypes(true).catch(() => [] as DamageType[]),
      fetchDamageAttachments(id).catch(() => [] as LossAttachment[]),
      fetchDamageEvents(id).catch(() => [] as LossEvent[]),
      fetchFieldChanges("damage", id).catch(() => [] as FieldChange[]),
    ]);
    setTypes(tp); setAttachments(atts); setEvents(evts); setChanges(fch);
    const ids = [
      rec.created_by, rec.updated_by, rec.submitted_by, rec.approved_by, rec.rejected_by, rec.deleted_by, rec.restored_by,
      ...evts.map((e) => e.actor_id), ...fch.map((c) => c.changed_by),
    ].filter(Boolean) as string[];
    setNames(await fetchUserNames(ids));
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (!canAccessModule("damages")) {
    return (<div className="space-y-8"><PageHeader title="Damage Details" /><NoAccess /></div>);
  }
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full rounded-lg" />
        <div className="grid gap-6 lg:grid-cols-3"><Skeleton className="h-72 rounded-lg lg:col-span-2" /><Skeleton className="h-72 rounded-lg" /></div>
      </div>
    );
  }
  if (notFound || !record) {
    return (
      <div className="space-y-8">
        <PageHeader title="Damage Details" />
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 px-6 py-20 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-md bg-muted text-muted-foreground"><PackageX className="h-7 w-7" /></span>
          <h2 className="mt-5 text-lg font-medium text-foreground">Damage not found</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">This damage may have been removed or you don't have access to it.</p>
          <Button className="mt-5" asChild><Link to="/damages">Back to all damages</Link></Button>
        </div>
      </div>
    );
  }

  const isOwner = record.created_by === user?.id;
  const canApprove = isAdmin || can("damages", "approve");
  const isLocked = record.status === "approved";
  const canEdit = isLocked ? canApprove : isAdmin || (isOwner && can("damages", "edit"));
  const canComment = isAdmin || can("damages", "view") || isOwner;
  const isOpenForReview = ["submitted", "pending_approval", "revision_requested"].includes(record.status);
  const typeName = record.type_id ? types.find((t) => t.id === record.type_id)?.name : null;
  const timelineEvents = events.filter((e) => e.action !== "comment");
  const commentEvents = events.filter((e) => e.action === "comment");

  async function moveToDeleted() {
    if (!user || !record) return;
    setBusy(true);
    try {
      await setLossStatus("damage", record.id, "deleted", user.id, record.status);
      toast.success("Damage moved to deleted.");
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed."); }
    finally { setBusy(false); }
  }

  async function addAttachment(value: AttachmentValue | null) {
    if (!value || !user || !record) return;
    try { await addDamageAttachment(record.id, value, user.id); toast.success("Attachment added."); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed to add attachment."); }
  }
  async function deleteAttachment(att: LossAttachment) {
    try {
      await removeFile(ATTACHMENT_BUCKET, att.file_path);
      await deleteLossAttachment("damage", att.id);
      toast.success("Attachment removed."); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to remove attachment."); }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={record.damage_number}
        description={`Created ${formatDate(record.created_at)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" asChild><Link to="/damages"><ArrowLeft className="h-4 w-4" />Back</Link></Button>
            {canEdit && (<Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" />Edit</Button>)}
          </div>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Current status</span>
            <StatusBadge status={record.status} />
            {isLocked && (<span className="text-xs text-muted-foreground">· Locked after approval</span>)}
          </div>
          <div className="flex flex-wrap gap-2">
            {canApprove && isOpenForReview && (
              <LossApprovalPanel kind="damage" record={{ id: record.id, number: record.damage_number, status: record.status }} onDone={load} />
            )}
            {canEdit && record.status !== "deleted" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={busy}><Trash2 className="h-4 w-4" />Move to Deleted</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Move this damage to Deleted?</AlertDialogTitle>
                    <AlertDialogDescription>It will be hidden from the main list and excluded from reports. This can be restored later from the recycle bin.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={moveToDeleted}>Move to Deleted</AlertDialogAction>
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
            <CardHeader><CardTitle className="text-base">Damage information</CardTitle></CardHeader>
            <CardContent className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <Field label="Damage number" value={record.damage_number} />
              <Field label="Damage date" value={formatDate(record.damage_date)} />
              <Field label="Product" value={record.product_name || "—"} />
              <Field label="Quantity" value={String(record.quantity)} />
              <Field label="Damage type" value={typeName ?? "—"} />
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground">Damage value</p>
                <p className="mt-0.5 text-2xl font-semibold tabular-nums text-brand-gradient">{formatTk(record.damage_value)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
            <CardContent><p className="whitespace-pre-wrap text-sm text-foreground">{record.notes || "—"}</p></CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Approval history</CardTitle></CardHeader>
            <CardContent><ExpenseTimeline events={timelineEvents as unknown as ExpenseEvent[]} names={names} /></CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Change history</CardTitle></CardHeader>
            <CardContent><ChangeHistory changes={changes} names={names} /></CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Discussion</CardTitle></CardHeader>
            <CardContent><LossDiscussion kind="damage" recordId={record.id} comments={commentEvents} names={names} canComment={canComment} onPosted={load} /></CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Attachments</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {attachments.length === 0 && !canEdit && (<p className="text-sm text-muted-foreground">No attachments.</p>)}
              {attachments.map((att) => (<AttachmentRow key={att.id} att={att} canEdit={canEdit} onDelete={() => deleteAttachment(att)} />))}
              {canEdit && (<AttachmentUploader value={null} onChange={addAttachment} prefix={`${user?.id ?? "u"}/`} />)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Audit trail</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <Field label="Created by" value={record.created_by ? names[record.created_by] ?? "—" : "—"} />
              <Field label="Created date" value={formatDateTime(record.created_at)} />
              <Field label="Submitted by" value={record.submitted_by ? names[record.submitted_by] ?? "—" : "—"} />
              <Field label="Submitted at" value={formatDateTime(record.submitted_at)} />
              {record.approved_at && (<><Field label="Approved by" value={record.approved_by ? names[record.approved_by] ?? "—" : "—"} /><Field label="Approved at" value={formatDateTime(record.approved_at)} /></>)}
              {record.rejected_at && (<><Field label="Rejected by" value={record.rejected_by ? names[record.rejected_by] ?? "—" : "—"} /><Field label="Rejected at" value={formatDateTime(record.rejected_at)} /></>)}
              {record.deleted_at && (<><Field label="Deleted by" value={record.deleted_by ? names[record.deleted_by] ?? "—" : "—"} /><Field label="Deleted at" value={formatDateTime(record.deleted_at)} /></>)}
              {record.restored_at && (<><Field label="Restored by" value={record.restored_by ? names[record.restored_by] ?? "—" : "—"} /><Field label="Restored at" value={formatDateTime(record.restored_at)} /></>)}
              <Field label="Last updated by" value={record.updated_by ? names[record.updated_by] ?? "—" : "—"} />
              <Field label="Last updated date" value={formatDateTime(record.updated_at)} />
            </CardContent>
          </Card>
        </div>
      </div>

      {canEdit && (
        <EditDamageDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          record={record}
          types={types}
          onSaved={() => { setEditOpen(false); load(); router.invalidate(); }}
        />
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (<div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 text-sm font-medium text-foreground">{value}</p></div>);
}

function AttachmentRow({ att, canEdit, onDelete }: { att: LossAttachment; canEdit: boolean; onDelete: () => void }) {
  const isImage = att.mime_type?.startsWith("image/");
  const [thumb, setThumb] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (isImage) getSignedUrl(ATTACHMENT_BUCKET, att.file_path).then((u) => active && setThumb(u));
    return () => { active = false; };
  }, [att.file_path, isImage]);
  async function open(download: boolean) {
    const url = download ? await getDownloadUrl(ATTACHMENT_BUCKET, att.file_path, att.file_name ?? undefined) : await getSignedUrl(ATTACHMENT_BUCKET, att.file_path);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-background p-2.5">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-muted">
        {isImage && thumb ? (<img src={thumb} alt={att.file_name ?? "attachment"} className="h-full w-full object-cover" />) : (<FileText className="h-5 w-5 text-muted-foreground" />)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{att.file_name ?? "Attachment"}</p>
        <div className="mt-1 flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Preview" onClick={() => open(false)}><Eye className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Download" onClick={() => open(true)}><Download className="h-4 w-4" /></Button>
          {canEdit && (<Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" aria-label="Remove attachment" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>)}
        </div>
      </div>
    </div>
  );
}

function EditDamageDialog({ open, onClose, record, types, onSaved }: { open: boolean; onClose: () => void; record: DamageRecord; types: DamageType[]; onSaved: () => void; }) {
  const [form, setForm] = useState<DamageFormValues>(toForm(record));
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setForm(toForm(record)); }, [open, record]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.product_name.trim()) { toast.error("Please enter a product name."); return; }
    const value = Number(form.damage_value);
    if (!Number.isFinite(value) || value < 0) { toast.error("Please enter a valid damage value."); return; }
    setSaving(true);
    try {
      await updateDamage(record.id, {
        damage_date: form.damage_date,
        type_id: form.type_id || null,
        product_name: form.product_name.trim(),
        quantity: Number(form.quantity) || 0,
        damage_value: value,
        notes: form.notes.trim() || null,
        status: form.status,
      });
      toast.success("Damage updated.");
      onSaved();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to update damage."); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Edit {record.damage_number}</DialogTitle></DialogHeader>
        <form onSubmit={handleSave} className="space-y-5">
          <DamageFields value={form} onChange={(p) => setForm((f) => ({ ...f, ...p }))} types={types} extraStatuses={[record.status]} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Save changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function toForm(record: DamageRecord): DamageFormValues {
  return {
    damage_date: record.damage_date,
    type_id: record.type_id ?? "",
    product_name: record.product_name ?? "",
    quantity: String(record.quantity ?? ""),
    damage_value: String(record.damage_value ?? ""),
    notes: record.notes ?? "",
    status: record.status,
  };
}