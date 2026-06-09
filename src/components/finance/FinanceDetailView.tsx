import { useCallback, useEffect, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Download, Eye, FileText, Loader2, Pencil, Plus, Trash2, Ban, Wallet } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { StatusBadge } from "@/components/StatusBadge";
import { SettlementBadge } from "@/components/finance/SettlementBadge";
import { FinanceApprovalPanel } from "@/components/finance/FinanceApprovalPanel";
import { FinanceFields, emptyFinanceForm, type FinanceFormValues } from "@/components/finance/FinanceFields";
import { AttachmentUploader, type AttachmentValue } from "@/components/AttachmentUploader";
import { ExpenseTimeline } from "@/components/expenses/ExpenseTimeline";
import { ChangeHistory } from "@/components/audit/ChangeHistory";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth-context";
import { getDownloadUrl, getSignedUrl, removeFile } from "@/lib/storage";
import { fetchFieldChanges, type FieldChange } from "@/lib/audit";
import { fetchUserNames, formatDate, formatDateTime } from "@/lib/expenses";
import type { ExpenseEvent } from "@/lib/approvals";
import {
  addAttachment, addCollection, addPayment, asExpenseStatus, deleteAttachment, fetchAttachments, fetchCollections,
  fetchEvents, fetchPayable, fetchPayments, fetchReceivable, formatTk, partyTypeLabel, postComment, setCancelled, softDelete,
  updatePayable, updateReceivable, type FinanceAttachment, type FinanceEvent, type FinanceKind, type FinanceSettlement,
  type Payable, type Receivable,
} from "@/lib/finance";

const BUCKET = "expense-attachments" as const;

interface Norm {
  id: string; number: string; party_name: string; party_type: string; contact_person: string | null;
  mobile: string | null; email: string | null; reference_number: string | null; amount: number; settled: number;
  due_amount: number; due_date: string | null; notes: string | null; status: string; approval_status: any;
  created_by: string | null; created_at: string; updated_by: string | null; updated_at: string;
  submitted_by: string | null; submitted_at: string | null; approved_by: string | null; approved_at: string | null;
  rejected_by: string | null; rejected_at: string | null; deleted_at: string | null;
}

function toNorm(kind: FinanceKind, r: Receivable | Payable): Norm {
  const settled = kind === "receivable" ? (r as Receivable).collected_amount : (r as Payable).paid_amount;
  const number = kind === "receivable" ? (r as Receivable).receivable_number : (r as Payable).payable_number;
  return { ...(r as any), number, settled };
}

export function FinanceDetailView({ kind, id }: { kind: FinanceKind; id: string }) {
  const { user, isAdmin, can, canAccessModule } = useAuth();
  const router = useRouter();
  const label = kind === "receivable" ? "Receivable" : "Payable";
  const settledWord = kind === "receivable" ? "Collected" : "Paid";

  const [rec, setRec] = useState<Norm | null>(null);
  const [settlements, setSettlements] = useState<FinanceSettlement[]>([]);
  const [attachments, setAttachments] = useState<FinanceAttachment[]>([]);
  const [events, setEvents] = useState<FinanceEvent[]>([]);
  const [changes, setChanges] = useState<FieldChange[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const raw = kind === "receivable" ? await fetchReceivable(id).catch(() => null) : await fetchPayable(id).catch(() => null);
    if (!raw) { setNotFound(true); setLoading(false); return; }
    const n = toNorm(kind, raw);
    setRec(n);
    const [sts, atts, evts, fch] = await Promise.all([
      kind === "receivable" ? fetchCollections(id) : fetchPayments(id),
      fetchAttachments(kind, id).catch(() => [] as FinanceAttachment[]),
      fetchEvents(kind, id).catch(() => [] as FinanceEvent[]),
      fetchFieldChanges(kind, id).catch(() => [] as FieldChange[]),
    ]);
    setSettlements(sts); setAttachments(atts); setEvents(evts); setChanges(fch);
    const ids = [n.created_by, n.updated_by, n.submitted_by, n.approved_by, n.rejected_by, ...evts.map((e) => e.actor_id), ...fch.map((c) => c.changed_by), ...sts.map((s) => s.created_by)].filter(Boolean) as string[];
    setNames(await fetchUserNames(ids));
    setLoading(false);
  }, [id, kind]);

  useEffect(() => { load(); }, [load]);

  if (!canAccessModule("finance")) return (<div className="space-y-8"><PageHeader title={`${label} Details`} /><NoAccess /></div>);
  if (loading) return (<div className="space-y-6"><Skeleton className="h-16 w-full rounded-lg" /><div className="grid gap-6 lg:grid-cols-3"><Skeleton className="h-72 rounded-lg lg:col-span-2" /><Skeleton className="h-72 rounded-lg" /></div></div>);
  if (notFound || !rec) {
    const backTo = kind === "receivable" ? "/finance/receivables" : "/finance/payables";
    return (
      <div className="space-y-8">
        <PageHeader title={`${label} Details`} />
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 px-6 py-20 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-md bg-muted text-muted-foreground"><Wallet className="h-7 w-7" /></span>
          <h2 className="mt-5 text-lg font-medium text-foreground">{label} not found</h2>
          <Button className="mt-5" asChild><Link to={backTo}>Back to {label.toLowerCase()}s</Link></Button>
        </div>
      </div>
    );
  }

  const isOwner = rec.created_by === user?.id;
  const canApprove = isAdmin || can("finance", "approve");
  const isLocked = rec.approval_status === "approved";
  const canEdit = isLocked ? canApprove : isAdmin || (isOwner && can("finance", "edit"));
  const canSettle = (isAdmin || can("finance", "edit") || can("finance", "approve")) && rec.approval_status === "approved" && rec.status !== "received" && rec.status !== "paid" && rec.status !== "cancelled";
  const canComment = isAdmin || can("finance", "view") || isOwner;
  const isOpenForReview = ["pending_approval", "revision_requested"].includes(rec.approval_status);
  const timelineEvents = events.filter((e) => e.action !== "comment");
  const commentEvents = events.filter((e) => e.action === "comment");
  const backTo = kind === "receivable" ? "/finance/receivables" : "/finance/payables";

  async function doDelete() {
    if (!rec) return;
    setBusy(true);
    try { await softDelete(kind, rec.id); toast.success(`${label} moved to recycle bin.`); router.navigate({ to: backTo }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed."); setBusy(false); }
  }
  async function doCancel() {
    if (!rec) return;
    setBusy(true);
    try { await setCancelled(kind, rec.id); toast.success(`${label} cancelled.`); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed."); }
    finally { setBusy(false); }
  }
  async function addRecordAttachment(value: AttachmentValue | null) {
    if (!value || !user || !rec) return;
    try { await addAttachment(kind, rec.id, value, user.id); toast.success("Attachment added."); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed."); }
  }
  async function removeRecordAttachment(att: FinanceAttachment) {
    try { await removeFile(BUCKET, att.file_path); await deleteAttachment(kind, att.id); toast.success("Attachment removed."); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed."); }
  }
  async function comment(body: string) {
    if (!user || !rec) return;
    try { await postComment(kind, rec.id, user.id, body); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed."); }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={rec.number}
        description={`${rec.party_name} · ${partyTypeLabel(kind, rec.party_type)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" asChild><Link to={backTo}><ArrowLeft className="h-4 w-4" />Back</Link></Button>
            {canEdit && <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" />Edit</Button>}
          </div>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">Approval</span>
            <StatusBadge status={asExpenseStatus(rec.approval_status)} />
            <span className="text-sm text-muted-foreground">Settlement</span>
            <SettlementBadge kind={kind} status={rec.status} />
          </div>
          <div className="flex flex-wrap gap-2">
            {canApprove && isOpenForReview && (
              <FinanceApprovalPanel kind={kind} record={{ id: rec.id, number: rec.number, status: rec.approval_status }} onDone={load} />
            )}
            {canSettle && <Button size="sm" onClick={() => setSettleOpen(true)}><Plus className="h-4 w-4" />Add {kind === "receivable" ? "collection" : "payment"}</Button>}
            {canEdit && rec.status !== "cancelled" && (
              <AlertDialog>
                <AlertDialogTrigger asChild><Button size="sm" variant="ghost" disabled={busy}><Ban className="h-4 w-4" />Cancel</Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Cancel this {label.toLowerCase()}?</AlertDialogTitle><AlertDialogDescription>It will be excluded from outstanding totals but kept for records.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Keep</AlertDialogCancel><AlertDialogAction onClick={doCancel}>Cancel record</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild><Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={busy}><Trash2 className="h-4 w-4" />Delete</Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Move to recycle bin?</AlertDialogTitle><AlertDialogDescription>This {label.toLowerCase()} can be restored later from the recycle bin.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={doDelete}>Delete</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle className="text-base">{label} information</CardTitle></CardHeader>
            <CardContent className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <Field label="Party name" value={rec.party_name} />
              <Field label="Party type" value={partyTypeLabel(kind, rec.party_type)} />
              <Field label="Contact person" value={rec.contact_person || "—"} />
              <Field label="Mobile" value={rec.mobile || "—"} />
              <Field label="Email" value={rec.email || "—"} />
              <Field label="Reference number" value={rec.reference_number || "—"} />
              <Field label="Total amount" value={formatTk(rec.amount)} />
              <Field label={`${settledWord} amount`} value={formatTk(rec.settled)} />
              <Field label="Due date" value={formatDate(rec.due_date)} />
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground">Remaining balance</p>
                <p className="mt-0.5 text-2xl font-semibold tabular-nums text-brand-gradient">{formatTk(rec.due_amount)}</p>
              </div>
              <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">Notes</p><p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{rec.notes || "—"}</p></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">{kind === "receivable" ? "Collections" : "Payments"}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {settlements.length === 0 ? (<p className="text-sm text-muted-foreground">No {kind === "receivable" ? "collections" : "payments"} recorded yet.</p>) : settlements.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium tabular-nums text-foreground">{formatTk(s.amount)}</p>
                    <p className="truncate text-xs text-muted-foreground">{formatDate(s.date)}{s.notes ? ` · ${s.notes}` : ""} · {s.created_by ? names[s.created_by] ?? "—" : "—"}</p>
                  </div>
                  {s.file_path && <SettlementFile path={s.file_path} name={s.file_name} />}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card><CardHeader><CardTitle className="text-base">Approval & activity history</CardTitle></CardHeader><CardContent><ExpenseTimeline events={timelineEvents as unknown as ExpenseEvent[]} names={names} /></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Change history</CardTitle></CardHeader><CardContent><ChangeHistory changes={changes} names={names} /></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Discussion</CardTitle></CardHeader><CardContent><Discussion comments={commentEvents} names={names} canComment={canComment} onPost={comment} /></CardContent></Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Attachments</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {attachments.length === 0 && !canEdit && <p className="text-sm text-muted-foreground">No attachments.</p>}
              {attachments.map((att) => (<AttachmentRow key={att.id} att={att} canEdit={canEdit} onDelete={() => removeRecordAttachment(att)} />))}
              {canEdit && <AttachmentUploader value={null} onChange={addRecordAttachment} prefix={`${user?.id ?? "u"}/`} />}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Audit trail</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <Field label="Created by" value={rec.created_by ? names[rec.created_by] ?? "—" : "—"} />
              <Field label="Created at" value={formatDateTime(rec.created_at)} />
              <Field label="Submitted at" value={formatDateTime(rec.submitted_at)} />
              {rec.approved_at && (<><Field label="Approved by" value={rec.approved_by ? names[rec.approved_by] ?? "—" : "—"} /><Field label="Approved at" value={formatDateTime(rec.approved_at)} /></>)}
              {rec.rejected_at && (<><Field label="Rejected by" value={rec.rejected_by ? names[rec.rejected_by] ?? "—" : "—"} /><Field label="Rejected at" value={formatDateTime(rec.rejected_at)} /></>)}
              <Field label="Last updated" value={formatDateTime(rec.updated_at)} />
            </CardContent>
          </Card>
        </div>
      </div>

      {canEdit && editOpen && (
        <EditDialog kind={kind} rec={rec} onClose={() => setEditOpen(false)} onSaved={() => { setEditOpen(false); load(); router.invalidate(); }} />
      )}
      {canSettle && settleOpen && (
        <SettleDialog kind={kind} recordId={rec.id} max={rec.due_amount} userId={user?.id ?? ""} onClose={() => setSettleOpen(false)} onSaved={() => { setSettleOpen(false); load(); }} />
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (<div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 text-sm font-medium text-foreground">{value}</p></div>);
}

function SettlementFile({ path, name }: { path: string; name: string | null }) {
  async function open() { const url = await getSignedUrl(BUCKET, path); if (url) window.open(url, "_blank", "noopener,noreferrer"); }
  return (<Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={name ?? "attachment"} onClick={open}><FileText className="h-4 w-4" /></Button>);
}

function AttachmentRow({ att, canEdit, onDelete }: { att: FinanceAttachment; canEdit: boolean; onDelete: () => void }) {
  const isImage = att.mime_type?.startsWith("image/");
  const [thumb, setThumb] = useState<string | null>(null);
  useEffect(() => { let active = true; if (isImage) getSignedUrl(BUCKET, att.file_path).then((u) => active && setThumb(u)); return () => { active = false; }; }, [att.file_path, isImage]);
  async function open(download: boolean) {
    const url = download ? await getDownloadUrl(BUCKET, att.file_path, att.file_name ?? undefined) : await getSignedUrl(BUCKET, att.file_path);
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
          {canEdit && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" aria-label="Remove" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>}
        </div>
      </div>
    </div>
  );
}

function Discussion({ comments, names, canComment, onPost }: { comments: FinanceEvent[]; names: Record<string, string>; canComment: boolean; onPost: (body: string) => void }) {
  const [body, setBody] = useState("");
  return (
    <div className="space-y-4">
      {comments.length === 0 ? (<p className="text-sm text-muted-foreground">No comments yet.</p>) : comments.map((c) => (
        <div key={c.id} className="rounded-md border border-border bg-background p-3">
          <p className="text-xs text-muted-foreground">{c.actor_id ? names[c.actor_id] ?? "—" : "—"} · {formatDateTime(c.created_at)}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{c.notes}</p>
        </div>
      ))}
      {canComment && (
        <div className="space-y-2">
          <Textarea rows={3} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a comment…" />
          <Button size="sm" disabled={!body.trim()} onClick={() => { onPost(body.trim()); setBody(""); }}>Post comment</Button>
        </div>
      )}
    </div>
  );
}

function EditDialog({ kind, rec, onClose, onSaved }: { kind: FinanceKind; rec: Norm; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<FinanceFormValues>({
    ...emptyFinanceForm(kind),
    party_name: rec.party_name, party_type: rec.party_type, contact_person: rec.contact_person ?? "",
    mobile: rec.mobile ?? "", email: rec.email ?? "", reference_number: rec.reference_number ?? "",
    amount: String(rec.amount), settled: String(rec.settled), due_date: rec.due_date ?? "", notes: rec.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const patch = (p: Partial<FinanceFormValues>) => setForm((f) => ({ ...f, ...p }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.party_name.trim()) { toast.error("Please enter a party name."); return; }
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) { toast.error("Please enter a valid amount."); return; }
    setSaving(true);
    try {
      const base = {
        party_name: form.party_name.trim(), party_type: form.party_type,
        contact_person: form.contact_person.trim() || null, mobile: form.mobile.trim() || null,
        email: form.email.trim() || null, reference_number: form.reference_number.trim() || null,
        amount, due_date: form.due_date || null, notes: form.notes.trim() || null,
      };
      if (kind === "receivable") await updateReceivable(rec.id, base);
      else await updatePayable(rec.id, base);
      toast.success(`${rec.number} updated.`);
      onSaved();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to update."); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Edit {rec.number}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-5">
          <FinanceFields kind={kind} value={form} onChange={patch} />
          <p className="text-xs text-muted-foreground">{kind === "receivable" ? "Collected" : "Paid"} amount changes through collections/payments, not here.</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Save changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SettleDialog({ kind, recordId, max, userId, onClose, onSaved }: { kind: FinanceKind; recordId: string; max: number; userId: string; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [attachment, setAttachment] = useState<AttachmentValue | null>(null);
  const [saving, setSaving] = useState(false);
  const word = kind === "receivable" ? "collection" : "payment";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) { toast.error("Enter a valid amount."); return; }
    if (amt > max + 0.001) { toast.error(`Amount exceeds remaining balance (${formatTk(max)}).`); return; }
    setSaving(true);
    try {
      const file = attachment ? { path: attachment.path, name: attachment.name, mime: attachment.mime, size: attachment.size } : null;
      if (kind === "receivable") await addCollection(recordId, { amount: amt, date, notes: notes.trim() || null, file }, userId);
      else await addPayment(recordId, { amount: amt, date, notes: notes.trim() || null, file }, userId);
      toast.success(`${word[0].toUpperCase()}${word.slice(1)} recorded.`);
      onSaved();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed."); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add {word}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="settle-amt">Amount (max {formatTk(max)})</Label><Input id="settle-amt" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="settle-date">{kind === "receivable" ? "Collection" : "Payment"} date</Label><Input id="settle-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="settle-notes">Notes</Label><Textarea id="settle-notes" rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <div className="space-y-2"><Label>Attachment</Label><AttachmentUploader value={attachment} onChange={setAttachment} prefix={`${userId}/`} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Record {word}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}