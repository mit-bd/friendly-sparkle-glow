import { supabase } from "@/integrations/supabase/client";
import type { ExpenseCategory, ExpenseSubcategory } from "./expenses";
import { sumAmount, type DateRange } from "./analytics";

/**
 * Reporting engine for Motion IT BD.
 *
 * CRITICAL BUSINESS RULE: every report is built EXCLUSIVELY from approved
 * expenses. Draft, submitted, pending_approval, rejected, revision_requested
 * and deleted records never appear in any report, total or export — the
 * fetchers below always constrain status = 'approved'.
 *
 * All aggregation is implemented as pure functions so the same engine powers
 * the on-screen report, the print layout, the PDF export, and future modules
 * (inventory, revenue, financials).
 */

export const APPROVED_STATUS = "approved" as const;

export type ReportType =
  | "summary"
  | "category"
  | "subcategory"
  | "approved"
  | "marketing"
  | "return_damage"
  | "selected";

export interface ReportTypeMeta {
  value: ReportType;
  label: string;
  description: string;
}

export const REPORT_TYPES: ReportTypeMeta[] = [
  { value: "summary", label: "Expense Summary Report", description: "Spend per category with percentage share and grand total." },
  { value: "category", label: "Category Report", description: "Each category with its subcategory breakdown, counts and totals." },
  { value: "subcategory", label: "Subcategory Report", description: "Each subcategory with its full list of approved expenses." },
  { value: "approved", label: "Approved Expense Report", description: "Line-item ledger of approved expenses with approver and date." },
  { value: "marketing", label: "Marketing Expense Report", description: "Approved marketing spend with platform/subcategory breakdown." },
  { value: "return_damage", label: "Return & Damage Report", description: "Approved returns and damage/loss adjustments." },
  { value: "selected", label: "Selected Expenses Report", description: "A report built from a hand-picked set of approved expenses." },
];

export const REPORT_TYPE_LABELS: Record<ReportType, string> = Object.fromEntries(
  REPORT_TYPES.map((t) => [t.value, t.label]),
) as Record<ReportType, string>;

/** Keyword matchers — adapt automatically to category renames (no hardcoded IDs). */
export const MARKETING_KEYWORDS = ["marketing", "advert", "campaign", "promotion", "ads"];
export const RETURN_DAMAGE_KEYWORDS = ["return", "damage", "loss", "refund", "adjustment"];

// ----------------------------------------------------------------------------
// Data fetching (approved-only)
// ----------------------------------------------------------------------------

export interface ReportExpense {
  id: string;
  expense_number: string;
  expense_date: string;
  amount: number;
  category_id: string | null;
  subcategory_id: string | null;
  description: string | null;
  notes: string | null;
  approved_at: string | null;
  approved_by: string | null;
}

const SELECT_COLS =
  "id, expense_number, expense_date, amount, category_id, subcategory_id, description, notes, approved_at, approved_by";
const PAGE = 1000;

/** All approved expenses inside a date range (paginated). */
export async function fetchApprovedForReport(range: DateRange): Promise<ReportExpense[]> {
  const all: ReportExpense[] = [];
  let offset = 0;
  for (let i = 0; i < 100; i++) {
    const { data, error } = await supabase
      .from("expenses")
      .select(SELECT_COLS)
      .eq("status", APPROVED_STATUS)
      .gte("expense_date", range.from)
      .lte("expense_date", range.to)
      .order("expense_date", { ascending: false })
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as ReportExpense[];
    all.push(...rows);
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

/** Approved expenses by explicit id list (for the Selected Expenses report). */
export async function fetchApprovedByIds(ids: string[]): Promise<ReportExpense[]> {
  if (ids.length === 0) return [];
  const out: ReportExpense[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data, error } = await supabase
      .from("expenses")
      .select(SELECT_COLS)
      .eq("status", APPROVED_STATUS)
      .in("id", chunk)
      .order("expense_date", { ascending: false });
    if (error) throw error;
    out.push(...((data ?? []) as ReportExpense[]));
  }
  return out;
}

// ----------------------------------------------------------------------------
// Keyword filtering
// ----------------------------------------------------------------------------

function idsMatching(
  items: { id: string; name: string }[],
  keywords: string[],
): Set<string> {
  const set = new Set<string>();
  for (const it of items) {
    const n = it.name.toLowerCase();
    if (keywords.some((k) => n.includes(k))) set.add(it.id);
  }
  return set;
}

/** Keep rows whose category OR subcategory name matches any keyword. */
export function filterByKeywords(
  rows: ReportExpense[],
  categories: ExpenseCategory[],
  subcategories: ExpenseSubcategory[],
  keywords: string[],
): ReportExpense[] {
  const catIds = idsMatching(categories, keywords);
  const subIds = idsMatching(subcategories, keywords);
  return rows.filter(
    (r) =>
      (r.category_id && catIds.has(r.category_id)) ||
      (r.subcategory_id && subIds.has(r.subcategory_id)),
  );
}

// ----------------------------------------------------------------------------
// Pure aggregation
// ----------------------------------------------------------------------------

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

export interface SummaryRow {
  id: string | null;
  name: string;
  total: number;
  count: number;
  percentage: number;
}

export function buildSummary(rows: ReportExpense[], categories: ExpenseCategory[]): {
  rows: SummaryRow[];
  grandTotal: number;
} {
  const nameById = new Map(categories.map((c) => [c.id, c.name]));
  const acc = new Map<string, { total: number; count: number }>();
  for (const r of rows) {
    const key = r.category_id ?? "__none__";
    const cur = acc.get(key) ?? { total: 0, count: 0 };
    cur.total += Number(r.amount || 0);
    cur.count += 1;
    acc.set(key, cur);
  }
  const grandTotal = sumAmount(rows);
  const out: SummaryRow[] = [...acc.entries()]
    .map(([id, v]) => ({
      id: id === "__none__" ? null : id,
      name: id === "__none__" ? "Uncategorized" : nameById.get(id) ?? "Unknown",
      total: v.total,
      count: v.count,
      percentage: pct(v.total, grandTotal),
    }))
    .sort((a, b) => b.total - a.total);
  return { rows: out, grandTotal };
}

export interface CategoryReportRow {
  id: string | null;
  name: string;
  count: number;
  total: number;
  subcategories: { id: string | null; name: string; count: number; total: number }[];
}

export function buildCategoryReport(
  rows: ReportExpense[],
  categories: ExpenseCategory[],
  subcategories: ExpenseSubcategory[],
): { rows: CategoryReportRow[]; grandTotal: number } {
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const subName = new Map(subcategories.map((s) => [s.id, s.name]));
  const byCat = new Map<string, { count: number; total: number; subs: Map<string, { count: number; total: number }> }>();

  for (const r of rows) {
    const ck = r.category_id ?? "__none__";
    const entry = byCat.get(ck) ?? { count: 0, total: 0, subs: new Map() };
    entry.count += 1;
    entry.total += Number(r.amount || 0);
    const sk = r.subcategory_id ?? "__none__";
    const sub = entry.subs.get(sk) ?? { count: 0, total: 0 };
    sub.count += 1;
    sub.total += Number(r.amount || 0);
    entry.subs.set(sk, sub);
    byCat.set(ck, entry);
  }

  const out: CategoryReportRow[] = [...byCat.entries()]
    .map(([id, v]) => ({
      id: id === "__none__" ? null : id,
      name: id === "__none__" ? "Uncategorized" : catName.get(id) ?? "Unknown",
      count: v.count,
      total: v.total,
      subcategories: [...v.subs.entries()]
        .map(([sid, sv]) => ({
          id: sid === "__none__" ? null : sid,
          name: sid === "__none__" ? "Unspecified" : subName.get(sid) ?? "Unknown",
          count: sv.count,
          total: sv.total,
        }))
        .sort((a, b) => b.total - a.total),
    }))
    .sort((a, b) => b.total - a.total);
  return { rows: out, grandTotal: sumAmount(rows) };
}

export interface SubcategoryReportRow {
  id: string | null;
  name: string;
  categoryName: string;
  count: number;
  total: number;
  expenses: ReportExpense[];
}

export function buildSubcategoryReport(
  rows: ReportExpense[],
  subcategories: ExpenseSubcategory[],
  categories: ExpenseCategory[],
): { rows: SubcategoryReportRow[]; grandTotal: number } {
  const subById = new Map(subcategories.map((s) => [s.id, s]));
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const acc = new Map<string, ReportExpense[]>();
  for (const r of rows) {
    const key = r.subcategory_id ?? "__none__";
    const list = acc.get(key) ?? [];
    list.push(r);
    acc.set(key, list);
  }
  const out: SubcategoryReportRow[] = [...acc.entries()]
    .map(([id, list]) => {
      const sub = id === "__none__" ? undefined : subById.get(id);
      return {
        id: id === "__none__" ? null : id,
        name: id === "__none__" ? "Unspecified" : sub?.name ?? "Unknown",
        categoryName: sub ? catName.get(sub.category_id) ?? "—" : "—",
        count: list.length,
        total: sumAmount(list),
        expenses: list.sort((a, b) => b.expense_date.localeCompare(a.expense_date)),
      };
    })
    .sort((a, b) => b.total - a.total);
  return { rows: out, grandTotal: sumAmount(rows) };
}

// ----------------------------------------------------------------------------
// Export history (archive)
// ----------------------------------------------------------------------------

export interface ReportExportRow {
  id: string;
  report_number: string;
  report_type: string;
  title: string;
  range_from: string | null;
  range_to: string | null;
  filters: Record<string, unknown>;
  expense_count: number;
  total_amount: number;
  generated_by: string | null;
  created_at: string;
}

export interface LogReportInput {
  reportType: ReportType | string;
  title: string;
  rangeFrom: string | null;
  rangeTo: string | null;
  filters?: Record<string, unknown>;
  expenseCount: number;
  totalAmount: number;
}

/** Generate a unique report number + archive entry via the secure RPC. */
export async function logReportExport(input: LogReportInput): Promise<ReportExportRow> {
  const args = {
    _report_type: input.reportType,
    _title: input.title,
    _range_from: input.rangeFrom,
    _range_to: input.rangeTo,
    _filters: input.filters ?? {},
    _expense_count: input.expenseCount,
    _total_amount: input.totalAmount,
  } as unknown as {
    _report_type: string;
    _title: string;
    _range_from: string;
    _range_to: string;
    _filters: never;
    _expense_count: number;
    _total_amount: number;
  };
  const { data, error } = await supabase.rpc("log_report_export", args);
  if (error) throw error;
  return data as unknown as ReportExportRow;
}

export async function fetchReportHistory(): Promise<ReportExportRow[]> {
  const { data, error } = await supabase
    .from("report_exports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as unknown as ReportExportRow[];
}
