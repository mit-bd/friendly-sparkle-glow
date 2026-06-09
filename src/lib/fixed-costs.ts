import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";

import type { DateRange } from "./analytics";
import { logActivity } from "./audit";

/**
 * Fixed Cost Management (Recurring Expense Engine) data layer.
 *
 * Admin-defined recurring monthly costs (salary, rent, utilities, subscriptions…)
 * are stored as TEMPLATES in `fixed_cost_templates`. A monthly generation job
 * (DB function `generate_fixed_costs`) creates PENDING-APPROVAL rows in the
 * shared `expenses` table flagged with `is_fixed_cost = true`, so generated
 * records inherit the existing approval, notification, audit and report engines.
 *
 * CRITICAL BUSINESS RULE: only APPROVED fixed-cost rows feed any total, chart,
 * analytic or financial report (mirrors the rest of the platform).
 *
 * IMPORTANT: there is NO employee-wise payroll — salary is a single total
 * amount on one template, exactly like rent or any other recurring cost.
 */

export const APPROVED_STATUS = "approved" as const;
export const PENDING_STATUSES = [
  "submitted",
  "pending_approval",
  "revision_requested",
] as const;

/** Generated types are not aware of the new table/columns; use a loose client. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface FixedCostTemplate {
  id: string;
  name: string;
  category_id: string | null;
  subcategory_id: string | null;
  monthly_amount: number;
  description: string | null;
  notes: string | null;
  is_active: boolean;
  auto_generate: boolean;
  effective_from: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface FixedCostRecord {
  id: string;
  expense_number: string;
  expense_date: string;
  period_month: string | null;
  amount: number;
  description: string | null;
  notes: string | null;
  status: string;
  fixed_cost_template_id: string | null;
  created_at: string;
  approved_at: string | null;
  created_by: string | null;
}

const TEMPLATE_COLS =
  "id, name, category_id, subcategory_id, monthly_amount, description, notes, is_active, auto_generate, effective_from, created_by, created_at, updated_at, deleted_at, deleted_by";
const RECORD_COLS =
  "id, expense_number, expense_date, period_month, amount, description, notes, status, fixed_cost_template_id, created_at, approved_at, created_by";

// ----------------------------------------------------------------------------
// Templates
// ----------------------------------------------------------------------------

/** All non-deleted templates (active + inactive) for management screens. */
export async function fetchTemplates(): Promise<FixedCostTemplate[]> {
  const { data, error } = await db
    .from("fixed_cost_templates")
    .select(TEMPLATE_COLS)
    .is("deleted_at", null)
    .order("is_active", { ascending: false })
    .order("name");
  if (error) throw error;
  return (data ?? []) as FixedCostTemplate[];
}

export interface TemplateInput {
  name: string;
  category_id: string | null;
  subcategory_id: string | null;
  monthly_amount: number;
  description: string | null;
  notes: string | null;
  is_active: boolean;
  auto_generate: boolean;
  effective_from: string;
}

export async function createTemplate(input: TemplateInput): Promise<void> {
  const { error } = await db.from("fixed_cost_templates").insert(input);
  if (error) throw error;
}

export async function updateTemplate(id: string, input: Partial<TemplateInput>): Promise<void> {
  const { error } = await db.from("fixed_cost_templates").update(input).eq("id", id);
  if (error) throw error;
}

export async function setTemplateActive(id: string, active: boolean): Promise<void> {
  const { error } = await db.from("fixed_cost_templates").update({ is_active: active }).eq("id", id);
  if (error) throw error;
}

export async function softDeleteTemplate(id: string, actorId: string | null): Promise<void> {
  const { error } = await db
    .from("fixed_cost_templates")
    .update({ deleted_at: new Date().toISOString(), deleted_by: actorId, is_active: false })
    .eq("id", id);
  if (error) throw error;
}

// ----------------------------------------------------------------------------
// Monthly generation
// ----------------------------------------------------------------------------

/** Generate pending-approval expense rows for the given month (yyyy-MM-dd, any day). */
export async function generateForMonth(month: string): Promise<number> {
  const { data, error } = await db.rpc("generate_fixed_costs", { _month: month });
  if (error) throw error;
  const count = Number(data ?? 0);
  void logActivity({
    action: "generate",
    entityType: "fixed_cost",
    entityLabel: `Generated ${count} fixed cost${count === 1 ? "" : "s"} for ${format(parseISO(month), "MMM yyyy")}`,
    metadata: { count, month: month.slice(0, 7) },
  });
  return count;
}

// ----------------------------------------------------------------------------
// Generated records (expenses with is_fixed_cost = true)
// ----------------------------------------------------------------------------

const PAGE = 1000;

/** Every generated fixed-cost record (all statuses except deleted), for the overview list. */
export async function fetchFixedCostRecords(): Promise<FixedCostRecord[]> {
  const { data, error } = await db
    .from("expenses")
    .select(RECORD_COLS)
    .eq("is_fixed_cost", true)
    .neq("status", "deleted")
    .order("expense_date", { ascending: false })
    .limit(2000);
  if (error) throw error;
  return (data ?? []) as FixedCostRecord[];
}

/** Approved fixed-cost records inside a date range (paginated), for analytics/reports. */
export async function fetchApprovedFixedCosts(range: DateRange): Promise<FixedCostRecord[]> {
  const all: FixedCostRecord[] = [];
  let offset = 0;
  for (let i = 0; i < 100; i++) {
    const { data, error } = await db
      .from("expenses")
      .select(RECORD_COLS)
      .eq("is_fixed_cost", true)
      .eq("status", APPROVED_STATUS)
      .gte("expense_date", range.from)
      .lte("expense_date", range.to)
      .order("expense_date", { ascending: false })
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as FixedCostRecord[];
    all.push(...rows);
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

export interface FixedCostCounts {
  pending: number;
  approvedInRange: number;
}

/** Pending count is global (operational); approved count is in-range. */
export async function fetchFixedCostCounts(range: DateRange): Promise<FixedCostCounts> {
  const [{ count: pending }, { count: approved }] = await Promise.all([
    db
      .from("expenses")
      .select("id", { count: "exact", head: true })
      .eq("is_fixed_cost", true)
      .in("status", [...PENDING_STATUSES]),
    db
      .from("expenses")
      .select("id", { count: "exact", head: true })
      .eq("is_fixed_cost", true)
      .eq("status", APPROVED_STATUS)
      .gte("expense_date", range.from)
      .lte("expense_date", range.to),
  ]);
  return { pending: pending ?? 0, approvedInRange: approved ?? 0 };
}

// ----------------------------------------------------------------------------
// Pure aggregation (approved-only inputs expected)
// ----------------------------------------------------------------------------

export const sumAmount = (rows: { amount: number }[]) =>
  rows.reduce((acc, r) => acc + Number(r.amount || 0), 0);

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

export interface MonthlyPoint {
  key: string;
  label: string;
  total: number;
}

export function buildMonthlyFixedCost(rows: FixedCostRecord[]): MonthlyPoint[] {
  const totals = new Map<string, number>();
  for (const r of rows) {
    const key = (r.period_month ?? r.expense_date).slice(0, 7);
    totals.set(key, (totals.get(key) ?? 0) + Number(r.amount || 0));
  }
  return [...totals.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, total]) => ({ key, label: format(parseISO(`${key}-01`), "MMM yyyy"), total }));
}

export interface TopFixedCost {
  id: string | null;
  name: string;
  total: number;
  count: number;
  percentage: number;
}

export function buildTopFixedCosts(
  rows: FixedCostRecord[],
  templateName: (id: string | null) => string,
): { rows: TopFixedCost[]; grandTotal: number } {
  const acc = new Map<string, { total: number; count: number }>();
  for (const r of rows) {
    const key = r.fixed_cost_template_id ?? "__none__";
    const cur = acc.get(key) ?? { total: 0, count: 0 };
    cur.total += Number(r.amount || 0);
    cur.count += 1;
    acc.set(key, cur);
  }
  const grandTotal = sumAmount(rows);
  const out: TopFixedCost[] = [...acc.entries()]
    .map(([id, v]) => ({
      id: id === "__none__" ? null : id,
      name: id === "__none__" ? "Unlinked" : templateName(id),
      total: v.total,
      count: v.count,
      percentage: pct(v.total, grandTotal),
    }))
    .sort((a, b) => b.total - a.total);
  return { rows: out, grandTotal };
}

/** Month-over-month growth percentage from the monthly series (last vs previous). */
export function fixedCostGrowth(monthly: MonthlyPoint[]): number {
  if (monthly.length < 2) return 0;
  const last = monthly[monthly.length - 1].total;
  const prev = monthly[monthly.length - 2].total;
  if (prev <= 0) return last > 0 ? 100 : 0;
  return ((last - prev) / prev) * 100;
}

export interface ApprovedVsPending {
  approved: number;
  pending: number;
}

/** Approved vs pending TOTALS (amounts) across the supplied record list. */
export function approvedVsPending(rows: FixedCostRecord[]): ApprovedVsPending {
  let approved = 0;
  let pending = 0;
  for (const r of rows) {
    if (r.status === APPROVED_STATUS) approved += Number(r.amount || 0);
    else if ((PENDING_STATUSES as readonly string[]).includes(r.status)) pending += Number(r.amount || 0);
  }
  return { approved, pending };
}
