import {
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subDays,
  subMonths,
  format,
  parseISO,
} from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import type { ExpenseCategory, ExpenseSubcategory } from "./expenses";

/**
 * Analytics layer for the Expense Dashboard.
 *
 * CRITICAL BUSINESS RULE: only APPROVED expenses are ever included in any
 * total, chart, summary, or financial calculation produced here. Draft,
 * submitted, pending_approval, rejected, revision_requested and deleted
 * records are excluded by construction (every fetch filters status = approved).
 *
 * All aggregation is implemented as pure functions so it can be reused by
 * future reports, exports, and printed documents without touching the network.
 */

export const APPROVED_STATUS = "approved" as const;
export const PENDING_STATUSES = [
  "submitted",
  "pending_approval",
  "revision_requested",
] as const;

// ----------------------------------------------------------------------------
// Date range system
// ----------------------------------------------------------------------------

export type RangePreset =
  | "today"
  | "last3"
  | "last7"
  | "this_month"
  | "last_month"
  | "this_year"
  | "custom";

export interface DateRange {
  /** Inclusive start, yyyy-MM-dd (compared against expenses.expense_date). */
  from: string;
  /** Inclusive end, yyyy-MM-dd. */
  to: string;
}

export const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "last3", label: "Last 3 Days" },
  { value: "last7", label: "Last 7 Days" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_year", label: "This Year" },
  { value: "custom", label: "Custom Range" },
];

export const DEFAULT_PRESET: RangePreset = "this_month";

const fmt = (d: Date) => format(d, "yyyy-MM-dd");

/** Resolve a preset (and optional custom range) into concrete yyyy-MM-dd bounds. */
export function resolveRange(preset: RangePreset, custom?: Partial<DateRange>): DateRange {
  const now = new Date();
  switch (preset) {
    case "today":
      return { from: fmt(startOfDay(now)), to: fmt(endOfDay(now)) };
    case "last3":
      return { from: fmt(startOfDay(subDays(now, 2))), to: fmt(endOfDay(now)) };
    case "last7":
      return { from: fmt(startOfDay(subDays(now, 6))), to: fmt(endOfDay(now)) };
    case "this_month":
      return { from: fmt(startOfMonth(now)), to: fmt(endOfMonth(now)) };
    case "last_month": {
      const lm = subMonths(now, 1);
      return { from: fmt(startOfMonth(lm)), to: fmt(endOfMonth(lm)) };
    }
    case "this_year":
      return { from: fmt(startOfYear(now)), to: fmt(endOfYear(now)) };
    case "custom":
      return {
        from: custom?.from || fmt(startOfMonth(now)),
        to: custom?.to || fmt(endOfMonth(now)),
      };
  }
}

export function formatRangeLabel(range: DateRange): string {
  const f = (s: string) => format(parseISO(s), "dd MMM yyyy");
  return range.from === range.to ? f(range.from) : `${f(range.from)} – ${f(range.to)}`;
}

// ----------------------------------------------------------------------------
// Data fetching (approved only, date-bounded, paginated for scale)
// ----------------------------------------------------------------------------

export interface AnalyticsExpense {
  id: string;
  expense_number: string;
  expense_date: string;
  amount: number;
  category_id: string | null;
  subcategory_id: string | null;
  description: string | null;
  notes: string | null;
  approved_at: string | null;
}

const PAGE = 1000;

/**
 * Fetch every APPROVED expense within the range, paging through large datasets
 * so the dashboard stays correct regardless of volume. Only the columns needed
 * for analytics are selected to keep payloads small.
 */
export async function fetchApprovedExpenses(range: DateRange): Promise<AnalyticsExpense[]> {
  const all: AnalyticsExpense[] = [];
  let offset = 0;
  // Guard against runaway loops; 100 pages = 100k approved rows in-range.
  for (let i = 0; i < 100; i++) {
    const { data, error } = await supabase
      .from("expenses")
      .select(
        "id, expense_number, expense_date, amount, category_id, subcategory_id, description, notes, approved_at",
      )
      .eq("status", APPROVED_STATUS)
      .gte("expense_date", range.from)
      .lte("expense_date", range.to)
      .order("expense_date", { ascending: false })
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as AnalyticsExpense[];
    all.push(...rows);
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

export interface StatusCounts {
  pending: number;
  approvedInRange: number;
}

/** Lightweight head counts: pending is global (operational), approved is in-range. */
export async function fetchStatusCounts(range: DateRange): Promise<StatusCounts> {
  const [{ count: pending }, { count: approved }] = await Promise.all([
    supabase
      .from("expenses")
      .select("id", { count: "exact", head: true })
      .in("status", PENDING_STATUSES as unknown as string[]),
    supabase
      .from("expenses")
      .select("id", { count: "exact", head: true })
      .eq("status", APPROVED_STATUS)
      .gte("expense_date", range.from)
      .lte("expense_date", range.to),
  ]);
  return { pending: pending ?? 0, approvedInRange: approved ?? 0 };
}

// ----------------------------------------------------------------------------
// Pure aggregation helpers
// ----------------------------------------------------------------------------

export const sumAmount = (rows: { amount: number }[]) =>
  rows.reduce((acc, r) => acc + Number(r.amount || 0), 0);

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

export interface CategorySummary {
  id: string | null;
  name: string;
  total: number;
  count: number;
  percentage: number;
}

export function buildCategorySummary(
  rows: AnalyticsExpense[],
  categories: ExpenseCategory[],
): CategorySummary[] {
  const nameById = new Map(categories.map((c) => [c.id, c.name]));
  const acc = new Map<string, { total: number; count: number }>();
  for (const r of rows) {
    const key = r.category_id ?? "__none__";
    const cur = acc.get(key) ?? { total: 0, count: 0 };
    cur.total += Number(r.amount || 0);
    cur.count += 1;
    acc.set(key, cur);
  }
  const grand = sumAmount(rows);
  return [...acc.entries()]
    .map(([id, v]) => ({
      id: id === "__none__" ? null : id,
      name: id === "__none__" ? "Uncategorized" : nameById.get(id) ?? "Unknown",
      total: v.total,
      count: v.count,
      percentage: pct(v.total, grand),
    }))
    .sort((a, b) => b.total - a.total);
}

export interface SubcategorySummary {
  id: string | null;
  name: string;
  categoryId: string | null;
  categoryName: string;
  total: number;
  count: number;
  percentage: number;
}

export function buildSubcategorySummary(
  rows: AnalyticsExpense[],
  subcategories: ExpenseSubcategory[],
  categories: ExpenseCategory[],
): SubcategorySummary[] {
  const subById = new Map(subcategories.map((s) => [s.id, s]));
  const catById = new Map(categories.map((c) => [c.id, c.name]));
  const acc = new Map<string, { total: number; count: number }>();
  for (const r of rows) {
    const key = r.subcategory_id ?? "__none__";
    const cur = acc.get(key) ?? { total: 0, count: 0 };
    cur.total += Number(r.amount || 0);
    cur.count += 1;
    acc.set(key, cur);
  }
  const grand = sumAmount(rows);
  return [...acc.entries()]
    .map(([id, v]) => {
      const sub = id === "__none__" ? undefined : subById.get(id);
      return {
        id: id === "__none__" ? null : id,
        name: id === "__none__" ? "Unspecified" : sub?.name ?? "Unknown",
        categoryId: sub?.category_id ?? null,
        categoryName: sub ? catById.get(sub.category_id) ?? "—" : "—",
        total: v.total,
        count: v.count,
        percentage: pct(v.total, grand),
      };
    })
    .sort((a, b) => b.total - a.total);
}

export interface TrendPoint {
  key: string;
  label: string;
  total: number;
}

/** Daily totals across the range, filling gaps with zero for a continuous line. */
export function buildDailyTrend(rows: AnalyticsExpense[], range: DateRange): TrendPoint[] {
  const totals = new Map<string, number>();
  for (const r of rows) {
    totals.set(r.expense_date, (totals.get(r.expense_date) ?? 0) + Number(r.amount || 0));
  }
  const out: TrendPoint[] = [];
  let cursor = parseISO(range.from);
  const end = parseISO(range.to);
  // Cap at 366 points so very large custom ranges stay performant.
  for (let i = 0; i < 366 && cursor <= end; i++) {
    const key = fmt(cursor);
    out.push({ key, label: format(cursor, "dd MMM"), total: totals.get(key) ?? 0 });
    cursor = subDays(cursor, -1);
  }
  return out;
}

/** Monthly totals across the range. */
export function buildMonthlyTrend(rows: AnalyticsExpense[]): TrendPoint[] {
  const totals = new Map<string, number>();
  for (const r of rows) {
    const key = r.expense_date.slice(0, 7); // yyyy-MM
    totals.set(key, (totals.get(key) ?? 0) + Number(r.amount || 0));
  }
  return [...totals.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, total]) => ({
      key,
      label: format(parseISO(`${key}-01`), "MMM yyyy"),
      total,
    }));
}

// ----------------------------------------------------------------------------
// Keyword matchers for summary cards (no hardcoded IDs — adapts to renames)
// ----------------------------------------------------------------------------

function categoryIdsMatching(categories: ExpenseCategory[], keywords: string[]): Set<string> {
  const set = new Set<string>();
  for (const c of categories) {
    const n = c.name.toLowerCase();
    if (keywords.some((k) => n.includes(k))) set.add(c.id);
  }
  return set;
}

function subcategoryIdsMatching(
  subcategories: ExpenseSubcategory[],
  keywords: string[],
): Set<string> {
  const set = new Set<string>();
  for (const s of subcategories) {
    const n = s.name.toLowerCase();
    if (keywords.some((k) => n.includes(k))) set.add(s.id);
  }
  return set;
}

export function sumByCategoryKeywords(
  rows: AnalyticsExpense[],
  categories: ExpenseCategory[],
  keywords: string[],
): number {
  const ids = categoryIdsMatching(categories, keywords);
  return sumAmount(rows.filter((r) => r.category_id && ids.has(r.category_id)));
}

export function sumBySubcategoryKeywords(
  rows: AnalyticsExpense[],
  subcategories: ExpenseSubcategory[],
  keywords: string[],
): number {
  const ids = subcategoryIdsMatching(subcategories, keywords);
  return sumAmount(rows.filter((r) => r.subcategory_id && ids.has(r.subcategory_id)));
}

// ----------------------------------------------------------------------------
// Dashboard search
// ----------------------------------------------------------------------------

export function searchExpenses(
  rows: AnalyticsExpense[],
  term: string,
  categories: ExpenseCategory[],
  subcategories: ExpenseSubcategory[],
): AnalyticsExpense[] {
  const q = term.trim().toLowerCase();
  if (!q) return [];
  const catName = new Map(categories.map((c) => [c.id, c.name.toLowerCase()]));
  const subName = new Map(subcategories.map((s) => [s.id, s.name.toLowerCase()]));
  return rows.filter((r) => {
    const haystack = [
      r.expense_number,
      r.description ?? "",
      r.notes ?? "",
      r.category_id ? catName.get(r.category_id) ?? "" : "",
      r.subcategory_id ? subName.get(r.subcategory_id) ?? "" : "",
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}