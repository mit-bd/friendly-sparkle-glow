import { supabase } from "@/integrations/supabase/client";

/**
 * Dashboard data layer — recent-activity feeds for the smart dashboard.
 * Read-only, best-effort, and RLS-respecting. These power the "Recent …"
 * panels; they never affect financial totals (which remain approved-only and
 * live in analytics.ts).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface RecentExpense {
  id: string;
  expense_number: string;
  description: string | null;
  amount: number;
  status: string;
  created_at: string;
  approved_at: string | null;
}

export interface RecentReturn {
  id: string;
  return_number: string;
  product_name: string;
  net_loss_amount: number;
  status: string;
  created_at: string;
}

export interface RecentDamage {
  id: string;
  damage_number: string;
  product_name: string;
  damage_value: number;
  status: string;
  created_at: string;
}

export interface RecentReport {
  id: string;
  report_number: string;
  title: string;
  report_type: string;
  created_at: string;
}

export interface RecentActivity {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_label: string | null;
  created_at: string;
}

const LIMIT = 6;

async function safe<T>(fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fn();
  } catch {
    return [];
  }
}

export function fetchRecentExpenses() {
  return safe<RecentExpense>(async () => {
    const { data } = await db
      .from("expenses")
      .select("id, expense_number, description, amount, status, created_at, approved_at")
      .neq("status", "deleted")
      .or("is_marketing.is.null,is_marketing.eq.false")
      .order("created_at", { ascending: false })
      .limit(LIMIT);
    return data ?? [];
  });
}

export function fetchRecentApprovals() {
  return safe<RecentExpense>(async () => {
    const { data } = await db
      .from("expenses")
      .select("id, expense_number, description, amount, status, created_at, approved_at")
      .eq("status", "approved")
      .not("approved_at", "is", null)
      .order("approved_at", { ascending: false })
      .limit(LIMIT);
    return data ?? [];
  });
}

export function fetchRecentReports() {
  return safe<RecentReport>(async () => {
    const { data } = await db
      .from("report_exports")
      .select("id, report_number, title, report_type, created_at")
      .order("created_at", { ascending: false })
      .limit(LIMIT);
    return data ?? [];
  });
}

export function fetchRecentReturns() {
  return safe<RecentReturn>(async () => {
    const { data } = await db
      .from("returns")
      .select("id, return_number, product_name, net_loss_amount, status, created_at")
      .neq("status", "deleted")
      .order("created_at", { ascending: false })
      .limit(LIMIT);
    return data ?? [];
  });
}

export function fetchRecentDamages() {
  return safe<RecentDamage>(async () => {
    const { data } = await db
      .from("damages")
      .select("id, damage_number, product_name, damage_value, status, created_at")
      .neq("status", "deleted")
      .order("created_at", { ascending: false })
      .limit(LIMIT);
    return data ?? [];
  });
}

export function fetchRecentActivity() {
  return safe<RecentActivity>(async () => {
    const { data } = await db
      .from("activity_logs")
      .select("id, actor_id, action, entity_type, entity_label, created_at")
      .order("created_at", { ascending: false })
      .limit(LIMIT);
    return data ?? [];
  });
}
