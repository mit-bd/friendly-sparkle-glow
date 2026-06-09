import { useState } from "react";
import { CheckCircle2, XCircle, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { logFinanceEvent, setApproval, type ApprovalStatus, type FinanceKind } from "@/lib/finance";

type Decision = "approved" | "rejected" | "revision_requested";
const META: Record<Decision, { label: string; title: string; notesRequired: boolean; placeholder: string }> = {
  approved: { label: "Approve", title: "Approve record", notesRequired: false, placeholder: "Optional note, e.g. Verified against invoice." },
  rejected: { label: "Reject", title: "Reject record", notesRequired: true, placeholder: "Reason for rejection (required)" },
  revision_requested: { label: "Request Revision", title: "Request revision", notesRequired: true, placeholder: "What needs to change?" },
};

export function FinanceApprovalPanel({
  kind,
  record,
  onDone,
}: {
  kind: FinanceKind;
  record: { id: string; number: string; status: ApprovalStatus };
  onDone: () => void;
}) {
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
    try {
      await setApproval(kind, record.id, decision);
      try {
        await logFinanceEvent(kind, record.id, { actorId: user.id, action: decision, fromStatus: record.status, toStatus: decision, notes: notes.trim() || null });
      } catch { /* best-effort history */ }
      setDecision(null);
      toast.success(`${meta.label} recorded.`);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
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
            <Label htmlFor="fin-approval-notes">Notes{decision && META[decision].notesRequired ? " (required)" : " (optional)"}</Label>
            <Textarea id="fin-approval-notes" rows={4} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={decision ? META[decision].placeholder : ""} />
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