import { supabase } from "@/integrations/supabase/client";

/** Canonical expense status lifecycle (mirrors the DB enum `expense_status`). */
export type ExpenseStatus =
  | "draft"
  | "submitted"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "revision_requested"
  | "deleted";

export interface StatusMeta {
  label: string;
  /** Tailwind classes for the badge (uses semantic + chart tokens, theme-safe). */
  badge: string;
  /** True when this status counts toward financial totals/reports. */
  countsToward: boolean;
}

export const EXPENSE_STATUS: Record<ExpenseStatus, StatusMeta> = {
  draft: {
    label: "Draft",
    badge: "border-transparent bg-muted text-muted-foreground",
    countsToward: false,
  },
  submitted: {
    label: "Submitted",
    badge: "border-transparent bg-chart-4/15 text-chart-4",
    countsToward: false,
  },
  pending_approval: {
    label: "Pending Approval",
    badge: "border-transparent bg-chart-1/15 text-chart-1",
    countsToward: false,
  },
  approved: {
    label: "Approved",
    badge: "border-transparent bg-chart-2/15 text-chart-2",
    countsToward: true,
  },
  rejected: {
    label: "Rejected",
    badge: "border-transparent bg-destructive/15 text-destructive",
    countsToward: false,
  },
  revision_requested: {
    label: "Revision Requested",
    badge: "border-transparent bg-warning/15 text-warning",
    countsToward: false,
  },
  deleted: {
    label: "Deleted",
    badge: "border-transparent bg-muted text-muted-foreground line-through",
    countsToward: false,
  },
};

/** Statuses a user can manually set when submitting/editing (not approval ones). */
export const SUBMITTABLE_STATUSES: ExpenseStatus[] = [
  "draft",
  "submitted",
  "pending_approval",
];

export const ATTACHMENT_BUCKET = "expense-attachments" as const;
export const ATTACHMENT_ACCEPT = "application/pdf,image/png,image/jpeg,image/jpg";
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024; // 10MB

export interface ExpenseCategory {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  deleted_at?: string | null;
  deleted_by?: string | null;
}

export interface ExpenseSubcategory {
  id: string;
  category_id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  is_ai_generated?: boolean;
  created_by?: string | null;
  created_at?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
}

export interface ExpenseAttachment {
  id: string;
  expense_id: string;
  file_path: string;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

export interface Expense {
  id: string;
  expense_number: string;
  expense_date: string;
  category_id: string | null;
  subcategory_id: string | null;
  amount: number;
  description: string | null;
  notes: string | null;
  status: ExpenseStatus;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
  submitted_by?: string | null;
  submitted_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  rejected_by?: string | null;
  rejected_at?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  restored_at?: string | null;
  restored_by?: string | null;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Fetch active categories (or all, for admin management). */
export async function fetchCategories(includeInactive = false) {
  let query = supabase
    .from("expense_categories")
    .select("id, name, is_active, sort_order")
    .order("sort_order")
    .order("name");
  if (!includeInactive) query = query.eq("is_active", true);
  query = query.is("deleted_at", null);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ExpenseCategory[];
}

export async function fetchSubcategories(includeInactive = false) {
  let query = supabase
    .from("expense_subcategories")
    .select("id, category_id, name, is_active, sort_order, is_ai_generated, created_by, created_at")
    .order("sort_order")
    .order("name");
  if (!includeInactive) query = query.eq("is_active", true);
  query = query.is("deleted_at", null);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ExpenseSubcategory[];
}

/** Map of user id -> display name, for "Created By" columns. */
export async function fetchUserNames(ids: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return {};
  const { data } = await (supabase as any).rpc("list_directory");
  const wanted = new Set(unique);
  const map: Record<string, string> = {};
  for (const p of (data ?? []) as { id: string; full_name: string | null; email: string | null }[]) {
    if (wanted.has(p.id)) map[p.id] = p.full_name?.trim() || p.email || "—";
  }
  return map;
}