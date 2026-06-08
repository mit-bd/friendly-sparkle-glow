import { useState } from "react";
import { CheckCircle2, XCircle, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { logReturnEvent, logDamageEvent, type LossKind } from "@/lib/loss";
import type { ExpenseStatus } from "@/lib/expenses";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
type Decision = "approved" | "rejected" | "revision_requested";
const META: Record<Decision, { label: string; title: string; notesRequired: boolean; placeholder: string }> = {
  approved: { label: "Approve", title: "Approve record", notesRequired: false, placeholder: "Optional note, e.g. Loss verified." },
  rejected: { label: "Reject", title: "Reject record", notesRequired: true, placeholder: "Reason for rejection (required)" },
  revision_requested: { label: "Request Revision", title: "Request revision", notesRequired: true, placeholder: "What needs to change?" },
};
export function LossApprovalPanel({ kind, record, onDone }: { kind: LossKind; record: { id: string; number: string; status: ExpenseStatus }; onDone: () => void; }) {
  const { user } = useAuth();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  function open(d: Decision) { setDecision(d); setNotes(""); }
  async function confirm() {
    if (!decision || !user) return;
    const meta = META[decision];
    if (meta.notesRequired && !notes.trim()) { toast.error("A note is required for this action."); return; }
    setBusy(true);
    const table = kind === "return" ? "returns" : "damages";
    const from = record.status;
    const { error } = await db.from(table).update({ status: decision }).eq("id", record.id);
    if (error) { setBusy(false); toast.error(error.message); return; }
    try {
      const payload = { actorId: user.id, action: decision, fromStatus: from, toStatus: decision, notes: notes.trim() || null };
      if (kind === "return") await logReturnEvent({ returnId: record.id, ...payload });
      else await logDamageEvent({ damageId: record.id, ...payload });
    } catch { /* best-effort */ }
    setBusy(false); setDecision(null); toast.success(`${meta.label} recorded.`); onDone();
  }
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={() => open("approved")}><CheckCircle2 className="h-4 w-4" />Approve</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => open("revision_requested")}><RotateCcw className="h-4 w-4" />Request Revision</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => open("rejected")} className="text-destructive hover:text-destructive"><XCircle className="h-4 w-4" />Reject</Button>
      </div>
      <Dialog open={decision !== null} onOpenChange={(o) => !o && setDecision(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{decision ? META[decision].title : ""}</DialogTitle>
            <DialogDescription>{record.number} — add a note to keep a permanent record of this decision.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="loss-approval-notes">Notes{decision && META[decision].notesRequired ? " (required)" : " (optional)"}</Label>
            <Textarea id="loss-approval-notes" rows={4} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={decision ? META[decision].placeholder : ""} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecision(null)} disabled={busy}>Cancel</Button>
            <Button onClick={confirm} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{decision ? META[decision].label : "Confirm"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
