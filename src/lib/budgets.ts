import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from "date-fns";

import type { DateRange } from "./analytics";

/**
 * Budget Management & Expense Control System (Phase 15). Read-only decision
 * support plus its own budgets / budget_alerts tables. Only APPROVED records
 * ever feed any budget used amount, utilisation, status or alert.
 */

export { formatTk } from "./finance";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const BUDGET_MODULE = "budgets" as const;

export type BudgetType = "monthly" | "quarterly" | "yearly" | "custom";
export type BudgetTargetType = "category" | "subcategory" | "fixed_cost" | "marketing" | "return_loss" | "damage_loss" | "finance" | "custom";
export type BudgetStatus = "safe" | "warning" | "critical" | "exceeded";

export const BUDGET_TYPES: { value: BudgetType; label: string }[] = [
  { value: "monthly", label: "Monthly Budget" },
  { value: "quarterly", label: "Quarterly Budget" },
  { value: "yearly", label: "Yearly Budget" },
  { value: "custom", label: "Custom Period Budget" },
];

export const BUDGET_TARGETS: { value: BudgetTargetType; label: string; requiresCategory?: boolean; allowsSubcategory?: boolean }[] = [
  { value: "category", label: "Expense Category", requiresCategory: true, allowsSubcategory: true },
  { value: "subcategory", label: "Expense Subcategory", requiresCategory: true, allowsSubcategory: true },
  { value: "fixed_cost", label: "Fixed Cost" },
  { value: "marketing", label: "Marketing" },
  { value: "return_loss", label: "Return Loss" },
  { value: "damage_loss", label: "Damage Loss" },
  { value: "finance", label: "Finance Module" },
  { value: "custom", label: "Custom Group" },
];

/** Integration-ready registry for FUTURE modules (not active yet). */
export const FUTURE_BUDGET_TARGETS: { value: string; label: string; module: string }[] = [
  { value: "revenue", label: "Revenue", module: "revenue" },
  { value: "inventory", label: "Inventory", module: "inventory" },
  { value: "cashflow", label: "Cashflow", module: "cashflow" },
  { value: "profit_loss", label: "Profit & Loss", module: "profit_loss" },
];

export const BUDGET_TYPE_LABELS = Object.fromEntries(BUDGET_TYPES.map((t) => [t.value, t.label])) as Record<BudgetType, string>;
export const BUDGET_TARGET_LABELS = Object.fromEntries(BUDGET_TARGETS.map((t) => [t.value, t.label])) as Record<BudgetTargetType, string>;

export interface BudgetStatusMeta { label: string; badge: string; bar: string; dot: string; }

export const BUDGET_STATUS_META: Record<BudgetStatus, BudgetStatusMeta> = {
  safe: { label: "Safe", badge: "border-transparent bg-chart-2/15 text-chart-2", bar: "bg-chart-2", dot: "bg-chart-2" },
  warning: { label: "Warning", badge: "border-transparent bg-warning/15 text-warning", bar: "bg-warning", dot: "bg-warning" },
  critical: { label: "Critical", badge: "border-transparent bg-chart-4/15 text-chart-4", bar: "bg-chart-4", dot: "bg-chart-4" },
  exceeded: { label: "Exceeded", badge: "border-transparent bg-destructive/15 text-destructive", bar: "bg-destructive", dot: "bg-destructive" },
};

export interface Budget {
  id: string; budget_number: string; name: string; budget_type: BudgetType;
  period_start: string; period_end: string; target_type: BudgetTargetType;
  category_id: string | null; subcategory_id: string | null; amount: number;
  warning_threshold: number; critical_threshold: number; notes: string | null;
  is_active: boolean; created_by: string | null; created_at: string;
  updated_by: string | null; updated_at: string; deleted_at: string | null; deleted_by: string | null;
}

export interface BudgetAlert {
  id: string; budget_id: string; level: "warning" | "near" | "critical" | "exceeded";
  utilization: number; used_amount: number; period_start: string; created_at: string;
}

const COLS = "id, budget_number, name, budget_type, period_start, period_end, target_type, category_id, subcategory_id, amount, warning_threshold, critical_threshold, notes, is_active, created_by, created_at, updated_by, updated_at, deleted_at, deleted_by";

const fmtDate = (d: Date) => format(d, "yyyy-MM-dd");

export function periodForType(type: BudgetType, anchor: Date = new Date()): DateRange {
  switch (type) {
    case "monthly": return { from: fmtDate(startOfMonth(anchor)), to: fmtDate(endOfMonth(anchor)) };
    case "quarterly": return { from: fmtDate(startOfQuarter(anchor)), to: fmtDate(endOfQuarter(anchor)) };
    case "yearly": return { from: fmtDate(startOfYear(anchor)), to: fmtDate(endOfYear(anchor)) };
    case "custom": return { from: fmtDate(startOfMonth(anchor)), to: fmtDate(endOfMonth(anchor)) };
  }
}

export function formatBudgetDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = parseISO(value.length > 10 ? value.slice(0, 10) : value);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "dd MMM yyyy");
}

export function budgetPeriodLabel(b: Budget): string {
  return `${formatBudgetDate(b.period_start)} – ${formatBudgetDate(b.period_end)}`;
}

export async function fetchBudgets(): Promise<Budget[]> {
  const { data, error } = await db.from("budgets").select(COLS).is("deleted_at", null).order("created_at", { ascending: false }).limit(2000);
  if (error) throw error;
  return (data ?? []) as Budget[];
}

export async function fetchBudget(id: string): Promise<Budget | null> {
  const { data, error } = await db.from("budgets").select(COLS).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Budget | null) ?? null;
}

export async function fetchBudgetAlerts(budgetId: string): Promise<BudgetAlert[]> {
  const { data, error } = await db.from("budget_alerts").select("id, budget_id, level, utilization, used_amount, period_start, created_at").eq("budget_id", budgetId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BudgetAlert[];
}

export interface BudgetExpense { amount: number; expense_date: string; category_id: string | null; subcategory_id: string | null; is_marketing: boolean | null; is_fixed_cost: boolean | null; }
export interface BudgetReturn { net_loss_amount: number; return_date: string; }
export interface BudgetDamage { damage_value: number; damage_date: string; }
export interface BudgetPayable { amount: number; created_at: string; }
export interface BudgetDataset { expenses: BudgetExpense[]; returns: BudgetReturn[]; damages: BudgetDamage[]; payables: BudgetPayable[]; }

const PAGE = 1000;

async function pagedExpenses(range: DateRange): Promise<BudgetExpense[]> {
  const all: BudgetExpense[] = [];
  let offset = 0;
  for (let i = 0; i < 100; i++) {
    const { data, error } = await db.from("expenses").select("amount, expense_date, category_id, subcategory_id, is_marketing, is_fixed_cost").eq("status", "approved").gte("expense_date", range.from).lte("expense_date", range.to).range(offset, offset + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as BudgetExpense[];
    all.push(...rows);
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

export async function fetchBudgetDataset(budgets: Budget[]): Promise<BudgetDataset> {
  if (budgets.length === 0) return { expenses: [], returns: [], damages: [], payables: [] };
  const from = budgets.map((b) => b.period_start).sort()[0];
  const to = budgets.map((b) => b.period_end).sort().slice(-1)[0];
  const range: DateRange = { from, to };
  const [expenses, returns, damages, payables] = await Promise.all([
    pagedExpenses(range),
    db.from("returns").select("net_loss_amount, return_date").eq("status", "approved").gte("return_date", from).lte("return_date", to).then((r: { data: BudgetReturn[] | null }) => r.data ?? []),
    db.from("damages").select("damage_value, damage_date").eq("status", "approved").gte("damage_date", from).lte("damage_date", to).then((r: { data: BudgetDamage[] | null }) => r.data ?? []),
    db.from("payables").select("amount, created_at").eq("approval_status", "approved").is("deleted_at", null).then((r: { data: BudgetPayable[] | null }) => r.data ?? []),
  ]);
  return { expenses, returns, damages, payables };
}

const num = (v: unknown) => Number(v || 0);
const inRange = (d: string, from: string, to: string) => {
  const x = d.length > 10 ? d.slice(0, 10) : d;
  return x >= from && x <= to;
};

export function usedForBudget(b: Budget, data: BudgetDataset): number {
  const f = b.period_start; const t = b.period_end;
  switch (b.target_type) {
    case "category":
      return data.expenses.filter((e) => e.category_id === b.category_id && (!b.subcategory_id || e.subcategory_id === b.subcategory_id) && inRange(e.expense_date, f, t)).reduce((a, e) => a + num(e.amount), 0);
    case "subcategory":
      return data.expenses.filter((e) => e.subcategory_id === b.subcategory_id && inRange(e.expense_date, f, t)).reduce((a, e) => a + num(e.amount), 0);
    case "fixed_cost":
      return data.expenses.filter((e) => e.is_fixed_cost && inRange(e.expense_date, f, t)).reduce((a, e) => a + num(e.amount), 0);
    case "marketing":
      return data.expenses.filter((e) => e.is_marketing && inRange(e.expense_date, f, t)).reduce((a, e) => a + num(e.amount), 0);
    case "return_loss":
      return data.returns.filter((r) => inRange(r.return_date, f, t)).reduce((a, r) => a + num(r.net_loss_amount), 0);
    case "damage_loss":
      return data.damages.filter((d) => inRange(d.damage_date, f, t)).reduce((a, d) => a + num(d.damage_value), 0);
    case "finance":
      return data.payables.filter((p) => inRange(p.created_at, f, t)).reduce((a, p) => a + num(p.amount), 0);
    default:
      return 0;
  }
}

export function statusFor(b: Budget, utilization: number): BudgetStatus {
  if (utilization > 100) return "exceeded";
  if (utilization >= num(b.critical_threshold)) return "critical";
  if (utilization >= num(b.warning_threshold)) return "warning";
  return "safe";
}

export interface BudgetEvaluation { budget: Budget; used: number; remaining: number; utilization: number; status: BudgetStatus; }

export function evaluateBudget(b: Budget, data: BudgetDataset): BudgetEvaluation {
  const used = usedForBudget(b, data);
  const amount = num(b.amount);
  const utilization = amount > 0 ? (used / amount) * 100 : 0;
  return { budget: b, used, remaining: amount - used, utilization, status: statusFor(b, utilization) };
}

export function evaluateAll(budgets: Budget[], data: BudgetDataset): BudgetEvaluation[] {
  return budgets.map((b) => evaluateBudget(b, data));
}

export interface BudgetSummary { totalBudget: number; totalUsed: number; totalRemaining: number; utilization: number; overBudgetCount: number; warningCount: number; budgetCount: number; }

export function summarise(evals: BudgetEvaluation[]): BudgetSummary {
  const totalBudget = evals.reduce((a, e) => a + num(e.budget.amount), 0);
  const totalUsed = evals.reduce((a, e) => a + e.used, 0);
  return {
    totalBudget, totalUsed, totalRemaining: totalBudget - totalUsed,
    utilization: totalBudget > 0 ? (totalUsed / totalBudget) * 100 : 0,
    overBudgetCount: evals.filter((e) => e.status === "exceeded").length,
    warningCount: evals.filter((e) => e.status === "warning" || e.status === "critical").length,
    budgetCount: evals.length,
  };
}

export interface BudgetInsight { text: string; tone: "positive" | "negative" | "neutral"; }

export function budgetInsights(evals: BudgetEvaluation[]): BudgetInsight[] {
  const out: BudgetInsight[] = [];
  const sorted = [...evals].sort((a, b) => b.utilization - a.utilization);
  for (const e of sorted) {
    if (e.status === "exceeded") out.push({ text: `${e.budget.name} exceeded budget by ${(e.utilization - 100).toFixed(0)}%.`, tone: "negative" });
    else if (e.status === "critical") out.push({ text: `${e.budget.name} utilisation reached ${e.utilization.toFixed(0)}%.`, tone: "negative" });
    else if (e.status === "warning") out.push({ text: `${e.budget.name} utilisation reached ${e.utilization.toFixed(0)}% — approaching its limit.`, tone: "neutral" });
  }
  const safe = sorted.filter((e) => e.status === "safe");
  if (safe.length > 0 && out.length === 0) out.push({ text: `All ${safe.length} active budget(s) remain within expected range.`, tone: "positive" });
  return out.slice(0, 8);
}

export interface BudgetInput {
  name: string; budget_type: BudgetType; period_start: string; period_end: string;
  target_type: BudgetTargetType; category_id: string | null; subcategory_id: string | null;
  amount: number; warning_threshold: number; critical_threshold: number; notes: string | null; is_active: boolean;
}

export async function createBudget(input: BudgetInput, userId: string): Promise<Budget> {
  const { data, error } = await db.from("budgets").insert({ ...input, created_by: userId }).select(COLS).single();
  if (error || !data) throw error ?? new Error("Failed to create budget.");
  return data as Budget;
}

export async function updateBudget(id: string, patch: Partial<BudgetInput>): Promise<void> {
  const { error } = await db.from("budgets").update(patch).eq("id", id);
  if (error) throw error;
}

export async function softDeleteBudget(id: string): Promise<void> {
  const { error } = await db.from("budgets").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function runBudgetAlerts(): Promise<number> {
  const { data, error } = await db.rpc("budget_generate_alerts", {});
  if (error) throw error;
  return (data as number) ?? 0;
}

export interface MonthlyPoint { key: string; label: string; used: number; }

export function monthlyBreakdown(b: Budget, data: BudgetDataset): MonthlyPoint[] {
  const acc = new Map<string, number>();
  const add = (dateStr: string, value: number) => {
    const key = (dateStr.length > 10 ? dateStr.slice(0, 10) : dateStr).slice(0, 7);
    acc.set(key, (acc.get(key) ?? 0) + num(value));
  };
  const f = b.period_start; const t = b.period_end;
  if (b.target_type === "return_loss") data.returns.filter((r) => inRange(r.return_date, f, t)).forEach((r) => add(r.return_date, r.net_loss_amount));
  else if (b.target_type === "damage_loss") data.damages.filter((d) => inRange(d.damage_date, f, t)).forEach((d) => add(d.damage_date, d.damage_value));
  else if (b.target_type === "finance") data.payables.filter((p) => inRange(p.created_at, f, t)).forEach((p) => add(p.created_at, p.amount));
  else {
    const match = (e: BudgetExpense) => {
      if (!inRange(e.expense_date, f, t)) return false;
      switch (b.target_type) {
        case "category": return e.category_id === b.category_id && (!b.subcategory_id || e.subcategory_id === b.subcategory_id);
        case "subcategory": return e.subcategory_id === b.subcategory_id;
        case "fixed_cost": return !!e.is_fixed_cost;
        case "marketing": return !!e.is_marketing;
        default: return false;
      }
    };
    data.expenses.filter(match).forEach((e) => add(e.expense_date, e.amount));
  }
  return [...acc.entries()].sort((a, b2) => a[0].localeCompare(b2[0])).map(([key, used]) => ({ key, label: format(parseISO(`${key}-01`), "MMM yyyy"), used }));
}
