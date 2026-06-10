import { createFileRoute } from '@tanstack/react-router'
import { createFileRoute, Link, useParams } from "@/lib/router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Wallet,
  CheckCircle2,
  CircleDollarSign,
  Plus,
  Loader2,
  Receipt,
  Ban,
  FileText,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { EmptyState } from "@/components/analytics/EmptyState";
import { SettlementBadge } from "@/components/fixed-costs/SettlementBadge";
import { AttachmentUploader, type AttachmentValue } from "@/components/AttachmentUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/expenses";
import {
  fetchFixedCostRecord,
  fetchFixedCostPayments,
  fetchTemplates,
  addFixedCostPayment,
  deleteFixedCostPayment,
  rejectFixedCost,
  remainingOf,
  settlementOf,
  type FixedCostRecord,
  type FixedCostPayment,
  type FixedCostTemplate,
} from "@/lib/fixed-costs";

export const Route = createFileRoute("/_authenticated/fixed-costs/$id")({
  head: () => ({ meta: [{ title: "Fixed Cost Detail — Motion IT BD" }] }),
  component: FixedCostDetail,
});

function FixedCostDetail() {
  const { id } = useParams({ from: "/_authenticated/fixed-costs/$id" });
  const { user, canAccessModule, can, isAdmin } = useAuth();

  const [record, setRecord] = useState<FixedCostRecord | null>(null);
  const [payments, setPayments] = useState<FixedCostPayment[]>([]);
  const [templates, setTemplates] = useState<FixedCostTemplate[]>([]);
  const [directory, setDirectory] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [payOpen, setPayOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const canSettle = isAdmin || can("fixed_costs", "edit") || can("fixed_costs", "approve");

  async function load() {
    setLoading(true);
    try {
      const [rec, pays, tpls] = await Promise.all([
        fetchFixedCostRecord(id),
        fetchFixedCostPayments(id),
        fetchTemplates(),
      ]);
      setRecord(rec);
      setPayments(pays);
      setTemplates(tpls);
      const { data: dir } = await supabase.rpc("list_directory");
      setDirectory(new Map((dir ?? []).map((d: { id: string; full_name: string | null }) => [d.id, d.full_name ?? "User"])));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load fixed cost.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const templateName = useMemo(() => {
    const m = new Map(templates.map((t) => [t.id, t.name]));
    return record?.fixed_cost_template_id ? m.get(record.fixed_cost_template_id) ?? "Fixed Cost" : "Fixed Cost";
  }, [templates, record]);

  if (!canAccessModule("fixed_costs")) {
    return (
      <div className="space-y-8">
        <PageHeader title="Fixed Cost" />
        <NoAccess />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="space-y-6">
        <PageHeader title="Fixed Cost" />
        <EmptyState icon={Receipt} title="Record not found" description="This fixed cost no longer exists." />
        <Button variant="outline" asChild><Link to="/fixed-costs"><ArrowLeft className="h-4 w-4" />Back to overview</Link></Button>
      </div>
    );
  }

  const remaining = remainingOf(record);
  const settlement = settlementOf(record);
  const settled = settlement === "paid" || settlement === "rejected";

  async function handleReject() {
    if (!record) return;
    try {
      await rejectFixedCost(record);
      toast.success("Fixed cost rejected.");
      setRejectOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reject.");
    }
  }

  async function handleDeletePayment(pid: string) {
    try {
      await deleteFixedCostPayment(pid);
      toast.success("Payment removed.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove payment.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={templateName}
        description={`${record.expense_number} · ${(record.period_month ?? record.expense_date).slice(0, 7)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" asChild>
              <Link to="/fixed-costs"><ArrowLeft className="h-4 w-4" />Back</Link>
            </Button>
            {canSettle && !settled && (
              <Button onClick={() => setPayOpen(true)}>
                <Plus className="h-4 w-4" />Record payment
              </Button>
            )}
            {canSettle && !settled && settlement === "generated" && (
              <Button variant="outline" onClick={() => setRejectOpen(true)} className="text-destructive hover:text-destructive">
                <Ban className="h-4 w-4" />Reject
              </Button>
            )}
          </div>
        }
      />

      <div className="flex items-center gap-2">
        <SettlementBadge status={record.fc_settlement_status} />
        {record.description && <span className="text-sm text-muted-foreground">{record.description}</span>}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard icon={Wallet} label="Total amount" value={formatCurrency(record.amount)} />
        <SummaryCard icon={CheckCircle2} label="Paid amount" value={formatCurrency(record.fc_paid_amount)} tone="success" />
        <SummaryCard icon={CircleDollarSign} label="Remaining amount" value={formatCurrency(remaining)} tone={remaining > 0 ? "warning" : "muted"} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Payment timeline</CardTitle></CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <EmptyState icon={Receipt} title="No payments yet" description="Record a payment to start settling this fixed cost." />
          ) : (
            <ol className="relative space-y-4 border-l border-border pl-6">
              {payments.map((p) => (
                <li key={p.id} className="relative">
                  <span className="absolute -left-[27px] flex h-5 w-5 items-center justify-center rounded-full bg-brand-gradient text-brand-foreground">
                    <CircleDollarSign className="h-3 w-3" />
                  </span>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold tabular-nums text-foreground">{formatCurrency(p.amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(p.payment_date)}
                        {p.reference_number ? ` · Ref ${p.reference_number}` : ""}
                        {p.created_by ? ` · ${directory.get(p.created_by) ?? "User"}` : ""}
                      </p>
                      {p.notes && <p className="mt-1 text-xs text-foreground">{p.notes}</p>}
                      {p.file_name && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <FileText className="h-3 w-3" />{p.file_name}
                        </p>
                      )}
                    </div>
                    {isAdmin && (
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDeletePayment(p.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {payOpen && user && (
        <PaymentDialog
          expenseId={record.id}
          max={remaining}
          userId={user.id}
          onClose={() => setPayOpen(false)}
          onSaved={async () => { setPayOpen(false); await load(); }}
        />
      )}

      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject this fixed cost?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be excluded from settlement analytics. This does not delete the record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject}>Reject</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone = "brand",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: "brand" | "success" | "warning" | "muted";
}) {
  const toneClass =
    tone === "success"
      ? "bg-success/15 text-success"
      : tone === "warning"
        ? "bg-warning/15 text-warning"
        : tone === "muted"
          ? "bg-muted text-muted-foreground"
          : "bg-brand-gradient-soft text-brand";
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <span className={`flex h-8 w-8 items-center justify-center rounded-md ${toneClass}`}>
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <p className="mt-3 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function PaymentDialog({
  expenseId,
  max,
  userId,
  onClose,
  onSaved,
}: {
  expenseId: string;
  max: number;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [attachment, setAttachment] = useState<AttachmentValue | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) { toast.error("Enter a valid amount."); return; }
    if (amt > max + 0.001) { toast.error(`Amount exceeds remaining balance (${formatCurrency(max)}).`); return; }
    setSaving(true);
    try {
      const file = attachment ? { path: attachment.path, name: attachment.name, mime: attachment.mime, size: attachment.size } : null;
      await addFixedCostPayment(expenseId, {
        amount: amt,
        payment_date: date,
        reference_number: reference.trim() || null,
        notes: notes.trim() || null,
        file,
      }, userId);
      toast.success("Payment recorded.");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fc-amt">Payment amount (max {formatCurrency(max)})</Label>
            <Input id="fc-amt" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fc-date">Payment date</Label>
            <Input id="fc-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fc-ref">Reference number</Label>
            <Input id="fc-ref" value={reference} maxLength={120} onChange={(e) => setReference(e.target.value)} placeholder="Cheque / transaction ref" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fc-notes">Notes</Label>
            <Textarea id="fc-notes" rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Attachment</Label>
            <AttachmentUploader value={attachment} onChange={setAttachment} prefix={`${userId}/`} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Record payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}