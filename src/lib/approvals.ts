import { supabase } from "@/integrations/supabase/client";
import type { ExpenseStatus } from "@/lib/expenses";

// The new tables (expense_events, expense_comments) are created by migration.
// Cast the client so calls compile regardless of generated-type refresh timing.
const db = supabase as unknown as {
  from: (table: string) => any;
};

/** Actions captured in the permanent approval / audit history. */
export type ExpenseAction =
  | "created"
  | "submitted"
  | "approved"
  | "rejected"
  | "revision_requested"
  | "updated"
  | "deleted"
  | "restored"
  | "comment";

export interface ExpenseEvent {
  id: string;
  expense_id: string;
  actor_id: string | null;
  action: ExpenseAction;
  from_status: ExpenseStatus | null;
  to_status: ExpenseStatus | null;
  notes: string | null;
  created_at: string;
}

export interface ExpenseComment {
  id: string;
  expense_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export const ACTION_LABELS: Record<ExpenseAction, string> = {
  created: "Created",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  revision_requested: "Revision Requested",
  updated: "Updated",
  deleted: "Moved to Deleted",
  restored: "Restored",
  comment: "Commented",
};

export async function fetchExpenseEvents(expenseId: string): Promise<ExpenseEvent[]> {
  const { data, error } = await db
    .from("expense_events")
    .select("*")
    .eq("expense_id", expenseId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ExpenseEvent[];
}

export async function logExpenseEvent(input: {
  expenseId: string;
  actorId: string;
  action: ExpenseAction;
  fromStatus?: ExpenseStatus | null;
  toStatus?: ExpenseStatus | null;
  notes?: string | null;
}): Promise<void> {
  const { error } = await db.from("expense_events").insert({
    expense_id: input.expenseId,
    actor_id: input.actorId,
    action: input.action,
    from_status: input.fromStatus ?? null,
    to_status: input.toStatus ?? null,
    notes: input.notes ?? null,
  });
  if (error) throw error;
}

export async function fetchExpenseComments(expenseId: string): Promise<ExpenseComment[]> {
  const { data, error } = await db
    .from("expense_comments")
    .select("*")
    .eq("expense_id", expenseId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ExpenseComment[];
}

export async function addExpenseComment(input: {
  expenseId: string;
  authorId: string;
  body: string;
}): Promise<void> {
  const { error } = await db.from("expense_comments").insert({
    expense_id: input.expenseId,
    author_id: input.authorId,
    body: input.body,
  });
  if (error) throw error;
}