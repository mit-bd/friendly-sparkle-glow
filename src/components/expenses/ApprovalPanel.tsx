import { useState } from "react";
import { CheckCircle2, XCircle, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { logExpenseEvent, type ExpenseAction } from "@/lib/approvals";
import type { Expense, ExpenseStatus } from "@/lib/expenses";

type Decision = "approved" | "rejected" | "revision_requested";

const DECISION_META: Record<
  Decision,
  { label: string; action: ExpenseAction; title: string; notesRequired: boolean; placeholder: string }
> = {
  approved: {
    label: "Approve",
    action: "approved",
    title: "Approve expense",
    notesRequired: false,
    placeholder: "Optional note, e.g. \"Amount verified.\"",
  },
  rejected: {
    label: "Reject",
    action: "rejected",
    title: "Reject expense",
    notesRequired: true,
    placeholder: "Reason for rejection (required)",
  },
  revision_requested: {
    label: "Request Revision",
    action: "revision_requested",
    title: "Request revision",
    notesRequired: true,
    placeholder: "What needs to change? e.g. \"Please attach the invoice.\"",
  },
};

export function ApprovalPanel({
  expense,
  onDone,
  compact,
}: {
  expense: Expense;
  onDone: () => void;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  function open(d: Decision) {
    setDecision(d);
    setNotes("");
  }

  async function confirm() {
    if (!decision || !user) return;
    const meta = DECISION_META[decision];
    if (meta.notesRequired && !notes.trim()) {
      toast.error("A note is required for this action.");
      return;
    }
    setBusy(true);
    const from = expense.status as ExpenseStatus;
    const { error } = await supabase
      .from("expenses")
      .update({ status: decision })
      .eq("id", expense.id);
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    try {
      await logExpenseEvent({
        expenseId: expense.id,
        actorId: user.id,
        action: meta.action,
        fromStatus: from,
        toStatus: decision,
        notes: notes.trim() || null,
      });
    } catch {
      /* history is best-effort; status already changed */
    }
    setBusy(false);
    setDecision(null);
    toast.success(`${meta.label} recorded.`);
    onDone();
  }

  return (
    <>
      <div className={compact ? "flex flex-wrap gap-2" : "flex flex-wrap gap-2"}>
        <Button size="sm" disabled={busy} onClick={() => open("approved")}>
          <CheckCircle2 className="h-4 w-4" />
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => open("revision_requested")}
        >
          <RotateCcw className="h-4 w-4" />
          Request Revision
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => open("rejected")}
          className="text-destructive hover:text-destructive"
        >
          <XCircle className="h-4 w-4" />
          Reject
        </Button>
      </div>

      <Dialog open={decision !== null} onOpenChange={(o) => !o && setDecision(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{decision ? DECISION_META[decision].title : ""}</DialogTitle>
            <DialogDescription>
              {expense.expense_number} — add a note to keep a permanent record of this decision.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="approval-notes">
              Notes{decision && DECISION_META[decision].notesRequired ? " (required)" : " (optional)"}
            </Label>
            <Textarea
              id="approval-notes"
              rows={4}
              maxLength={2000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={decision ? DECISION_META[decision].placeholder : ""}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecision(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={confirm} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {decision ? DECISION_META[decision].label : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}