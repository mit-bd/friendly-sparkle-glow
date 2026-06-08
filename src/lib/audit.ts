import { supabase } from "@/integrations/supabase/client";
import type { ExpenseStatus } from "@/lib/expenses";

/** Cast helper so new tables compile regardless of generated-type timing. */
const db = supabase as unknown as { from: (t: string) => any; rpc: (f: string, a: any) => any };

/* ----------------------------- Activity log ----------------------------- */

export type ActivityAction =
  | "create"
  | "update"
  | "delete"
  | "restore"
  | "approve"
  | "reject"
  | "revision_request"
  | "export"
  | "print"
  | "login"
  | "logout"
  | "permission_change"
  | "user_create"
  | "user_deactivate"
  | "user_activate"
  | "comment";

export type AuditEntityType =
  | "expense"
  | "attachment"
  | "category"
  | "subcategory"
  | "report"
  | "user"
  | "permission"
  | "session"
  | "return"
  | "damage"
  | "return_attachment"
  | "damage_attachment";

export interface ActivityLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_label: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface FieldChange {
  id: string;
  entity_type: string;
  entity_id: string;
  entity_label: string | null;
  field: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_at: string;
}

export const ACTIVITY_ACTION_LABELS: Record<string, string> = {
  create: "Created",
  update: "Updated",
  delete: "Deleted",
  restore: "Restored",
  approve: "Approved",
  reject: "Rejected",
  revision_request: "Revision Requested",
  export: "Exported",
  print: "Printed",
  login: "Logged In",
  logout: "Logged Out",
  permission_change: "Permission Changed",
  user_create: "User Created",
  user_deactivate: "User Deactivated",
  user_activate: "User Activated",
  comment: "Commented",
};

export const ACTIVITY_ENTITY_LABELS: Record<string, string> = {
  expense: "Expense",
  attachment: "Attachment",
  category: "Category",
  subcategory: "Subcategory",
  report: "Report",
  user: "User",
  permission: "Permission",
  session: "Session",
  return: "Return",
  damage: "Damage",
  return_attachment: "Return Attachment",
  damage_attachment: "Damage Attachment",
};

/** Tailwind tone classes per action (theme-safe semantic tokens). */
export const ACTIVITY_TONE: Record<string, string> = {
  create: "bg-chart-2/15 text-chart-2",
  update: "bg-chart-1/15 text-chart-1",
  delete: "bg-destructive/15 text-destructive",
  restore: "bg-chart-2/15 text-chart-2",
  approve: "bg-chart-2/15 text-chart-2",
  reject: "bg-destructive/15 text-destructive",
  revision_request: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  export: "bg-chart-4/15 text-chart-4",
  print: "bg-chart-4/15 text-chart-4",
  login: "bg-muted text-muted-foreground",
  logout: "bg-muted text-muted-foreground",
  permission_change: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  user_create: "bg-chart-2/15 text-chart-2",
  user_deactivate: "bg-destructive/15 text-destructive",
  user_activate: "bg-chart-2/15 text-chart-2",
  comment: "bg-muted text-muted-foreground",
};

/** Best-effort client logger for actions that don't hit a tracked table. */
export async function logActivity(input: {
  action: ActivityAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  entityLabel?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.rpc("log_activity", {
      _action: input.action,
      _entity_type: input.entityType,
      _entity_id: input.entityId ?? null,
      _entity_label: input.entityLabel ?? null,
      _metadata: input.metadata ?? {},
    });
  } catch {
    /* logging must never break the user flow */
  }
}

export interface ActivityFilters {
  actorId?: string;
  action?: string;
  entityType?: string;
  search?: string; // matches entity_label (expense number, name…)
  dateFrom?: string; // yyyy-mm-dd
  dateTo?: string; // yyyy-mm-dd
}

export async function fetchActivityLogs(
  filters: ActivityFilters,
  page: number,
  pageSize: number,
): Promise<{ rows: ActivityLog[]; count: number }> {
  let q = db.from("activity_logs").select("*", { count: "exact" });
  if (filters.actorId) q = q.eq("actor_id", filters.actorId);
  if (filters.action) q = q.eq("action", filters.action);
  if (filters.entityType) q = q.eq("entity_type", filters.entityType);
  if (filters.dateFrom) q = q.gte("created_at", `${filters.dateFrom}T00:00:00`);
  if (filters.dateTo) q = q.lte("created_at", `${filters.dateTo}T23:59:59`);
  if (filters.search?.trim()) {
    const s = filters.search.trim().replace(/[(),]/g, " ");
    q = q.ilike("entity_label", `%${s}%`);
  }
  q = q.order("created_at", { ascending: false });
  q = q.range(page * pageSize, page * pageSize + pageSize - 1);
  const { data, count, error } = await q;
  if (error) throw error;
  return { rows: (data ?? []) as ActivityLog[], count: count ?? 0 };
}

/** Fetch ALL matching activity rows (for export), capped for safety. */
export async function fetchAllActivityLogs(filters: ActivityFilters): Promise<ActivityLog[]> {
  const out: ActivityLog[] = [];
  const size = 1000;
  for (let page = 0; page < 50; page++) {
    const { rows } = await fetchActivityLogs(filters, page, size);
    out.push(...rows);
    if (rows.length < size) break;
  }
  return out;
}

/* ----------------------------- Field changes ---------------------------- */

export async function fetchFieldChanges(
  entityType: string,
  entityId: string,
): Promise<FieldChange[]> {
  const { data, error } = await db
    .from("field_changes")
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("changed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FieldChange[];
}

/* ------------------------------ Recycle bin ----------------------------- */

export interface DeletedExpense {
  id: string;
  expense_number: string;
  amount: number;
  expense_date: string;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface DeletedTaxonomy {
  id: string;
  name: string;
  deleted_at: string | null;
  deleted_by: string | null;
  category_id?: string;
}

export async function fetchDeletedExpenses(): Promise<DeletedExpense[]> {
  const { data, error } = await db
    .from("expenses")
    .select("id, expense_number, amount, expense_date, deleted_at, deleted_by")
    .eq("status", "deleted")
    .order("deleted_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DeletedExpense[];
}

export async function fetchDeletedCategories(): Promise<DeletedTaxonomy[]> {
  const { data, error } = await db
    .from("expense_categories")
    .select("id, name, deleted_at, deleted_by")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DeletedTaxonomy[];
}

export async function fetchDeletedSubcategories(): Promise<DeletedTaxonomy[]> {
  const { data, error } = await db
    .from("expense_subcategories")
    .select("id, name, category_id, deleted_at, deleted_by")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DeletedTaxonomy[];
}

/** Determine the status an expense had immediately before it was deleted. */
async function priorExpenseStatus(id: string): Promise<ExpenseStatus> {
  const { data } = await db
    .from("field_changes")
    .select("old_value")
    .eq("entity_type", "expense")
    .eq("entity_id", id)
    .eq("field", "Status")
    .eq("new_value", "deleted")
    .order("changed_at", { ascending: false })
    .limit(1);
  const prev = data?.[0]?.old_value as ExpenseStatus | undefined;
  return prev && prev !== "deleted" ? prev : "draft";
}

export async function restoreExpense(id: string): Promise<void> {
  const status = await priorExpenseStatus(id);
  const { error } = await db.from("expenses").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function purgeExpense(id: string): Promise<void> {
  // Remove dependent rows first; expense_events/field_changes are kept for audit.
  await db.from("expense_attachments").delete().eq("expense_id", id);
  const { error } = await db.from("expenses").delete().eq("id", id);
  if (error) throw error;
}

export async function restoreCategory(id: string): Promise<void> {
  const { error } = await db
    .from("expense_categories")
    .update({ deleted_at: null, deleted_by: null, is_active: true })
    .eq("id", id);
  if (error) throw error;
}

export async function purgeCategory(id: string): Promise<void> {
  const { error } = await db.from("expense_categories").delete().eq("id", id);
  if (error) throw error;
}

export async function restoreSubcategory(id: string): Promise<void> {
  const { error } = await db
    .from("expense_subcategories")
    .update({ deleted_at: null, deleted_by: null, is_active: true })
    .eq("id", id);
  if (error) throw error;
}

export async function purgeSubcategory(id: string): Promise<void> {
  const { error } = await db.from("expense_subcategories").delete().eq("id", id);
  if (error) throw error;
}

/** Soft-delete a category (kept in recycle bin). */
export async function softDeleteCategory(id: string, actorId: string): Promise<void> {
  const { error } = await db
    .from("expense_categories")
    .update({ deleted_at: new Date().toISOString(), deleted_by: actorId, is_active: false })
    .eq("id", id);
  if (error) throw error;
}

export async function softDeleteSubcategory(id: string, actorId: string): Promise<void> {
  const { error } = await db
    .from("expense_subcategories")
    .update({ deleted_at: new Date().toISOString(), deleted_by: actorId, is_active: false })
    .eq("id", id);
  if (error) throw error;
}
