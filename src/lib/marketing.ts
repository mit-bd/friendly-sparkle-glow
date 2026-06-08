import { supabase } from "@/integrations/supabase/client";
import {
  startOfMonth,
  endOfMonth,
  format,
  parseISO,
} from "date-fns";
import type { DateRange } from "./analytics";

/**
 * Marketing Cost module data layer with multi-currency support.
 *
 * CRITICAL BUSINESS RULE: every company total, chart, analytic and report
 * uses the CONVERTED BDT amount (`expenses.amount`). Foreign currency values
 * (`original_amount` + `currency`) are display-only and never summed into
 * company totals. Marketing rows live in the `expenses` table (is_marketing =
 * true) so they automatically inherit approval, audit, notification and
 * report behaviour. Only APPROVED rows feed analytics/reports.
 */

export const BASE_CURRENCY = "BDT" as const;
export const APPROVED_STATUS = "approved" as const;

/** The generated types are not aware of the marketing tables/columns yet, so
 *  this module accesses them through a loosely-typed client. All shapes are
 *  re-typed explicitly below. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface MarketingPlatform {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  deleted_at?: string | null;
}

export interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface MarketingExpense {
  id: string;
  expense_number: string;
  expense_date: string;
  amount: number; // converted BDT
  original_amount: number | null;
  currency: string;
  exchange_rate: number;
  platform_id: string | null;
  campaign_name: string | null;
  description: string | null;
  notes: string | null;
  status: string;
  approved_at: string | null;
  approved_by: string | null;
  created_by: string | null;
  created_at: string;
}

const MARKETING_COLS =
  "id, expense_number, expense_date, amount, original_amount, currency, exchange_rate, platform_id, campaign_name, description, notes, status, approved_at, approved_by, created_by, created_at";

// ----------------------------------------------------------------------------
// Reference data
// ----------------------------------------------------------------------------

export async function fetchPlatforms(includeInactive = false): Promise<MarketingPlatform[]> {
  let q = db
    .from("marketing_platforms")
    .select("id, name, is_active, sort_order, deleted_at")
    .is("deleted_at", null)
    .order("sort_order")
    .order("name");
  if (!includeInactive) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as MarketingPlatform[];
}

export async function fetchAllPlatforms(): Promise<MarketingPlatform[]> {
  const { data, error } = await db
    .from("marketing_platforms")
    .select("id, name, is_active, sort_order, deleted_at")
    .is("deleted_at", null)
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return (data ?? []) as MarketingPlatform[];
}

export async function fetchCurrencies(includeInactive = false): Promise<Currency[]> {
  let q = db
    .from("currencies")
    .select("id, code, name, symbol, is_active, sort_order")
    .order("sort_order")
    .order("code");
  if (!includeInactive) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Currency[];
}

/** Resolve the id of the "Marketing" expense category (for category reports). */
export async function fetchMarketingCategoryId(): Promise<string | null> {
  const { data } = await db
    .from("expense_categories")
    .select("id, name")
    .is("deleted_at", null)
    .ilike("name", "marketing")
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

// ----------------------------------------------------------------------------
// Currency conversion
// ----------------------------------------------------------------------------

/** Convert a foreign amount into BDT, rounded to 2 decimals. */
export function convertToBDT(original: number, rate: number): number {
  const v = Number(original) * Number(rate);
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 100) / 100;
}

// ----------------------------------------------------------------------------
// Fetching
// ----------------------------------------------------------------------------

const PAGE = 1000;

/** All APPROVED marketing expenses in range (paginated). BDT-only totals. */
export async function fetchApprovedMarketing(range: DateRange): Promise<MarketingExpense[]> {
  const all: MarketingExpense[] = [];
  let offset = 0;
  for (let i = 0; i < 100; i++) {
    const { data, error } = await db
      .from("expenses")
      .select(MARKETING_COLS)
      .eq("is_marketing", true)
      .eq("status", APPROVED_STATUS)
      .gte("expense_date", range.from)
      .lte("expense_date", range.to)
      .order("expense_date", { ascending: false })
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as MarketingExpense[];
    all.push(...rows);
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

/** Marketing expenses of ALL statuses accessible to the user (for the list). */
export async function fetchMarketingList(): Promise<MarketingExpense[]> {
  const { data, error } = await db
    .from("expenses")
    .select(MARKETING_COLS)
    .eq("is_marketing", true)
    .neq("status", "deleted")
    .order("expense_date", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []) as MarketingExpense[];
}

export async function fetchMarketingExpense(id: string): Promise<MarketingExpense | null> {
  const { data, error } = await db
    .from("expenses")
    .select(MARKETING_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as MarketingExpense | null) ?? null;
}

// ----------------------------------------------------------------------------
// Pure aggregation (BDT only)
// ----------------------------------------------------------------------------

export const sumBDT = (rows: { amount: number }[]) =>
  rows.reduce((acc, r) => acc + Number(r.amount || 0), 0);

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

export interface PlatformSummary {
  id: string | null;
  name: string;
  total: number;
  count: number;
  percentage: number;
  /** Currencies that contributed to this platform (for the currency-aware label). */
  currencies: string[];
}

export function buildPlatformSummary(
  rows: MarketingExpense[],
  platforms: MarketingPlatform[],
): { rows: PlatformSummary[]; grandTotal: number } {
  const nameById = new Map(platforms.map((p) => [p.id, p.name]));
  const acc = new Map<string, { total: number; count: number; cur: Set<string> }>();
  for (const r of rows) {
    const key = r.platform_id ?? "__none__";
    const cur = acc.get(key) ?? { total: 0, count: 0, cur: new Set<string>() };
    cur.total += Number(r.amount || 0);
    cur.count += 1;
    cur.cur.add(r.currency);
    acc.set(key, cur);
  }
  const grand = sumBDT(rows);
  const out: PlatformSummary[] = [...acc.entries()]
    .map(([id, v]) => ({
      id: id === "__none__" ? null : id,
      name: id === "__none__" ? "Unassigned" : nameById.get(id) ?? "Unknown",
      total: v.total,
      count: v.count,
      percentage: pct(v.total, grand),
      currencies: [...v.cur].sort(),
    }))
    .sort((a, b) => b.total - a.total);
  return { rows: out, grandTotal: grand };
}

export interface CampaignSummary {
  name: string;
  platformId: string | null;
  platformName: string;
  total: number;
  count: number;
  percentage: number;
}

export function buildCampaignSummary(
  rows: MarketingExpense[],
  platforms: MarketingPlatform[],
): CampaignSummary[] {
  const nameById = new Map(platforms.map((p) => [p.id, p.name]));
  const acc = new Map<string, { total: number; count: number; platformId: string | null }>();
  for (const r of rows) {
    const camp = (r.campaign_name?.trim() || "Unnamed Campaign");
    const key = `${r.platform_id ?? "__none__"}::${camp}`;
    const cur = acc.get(key) ?? { total: 0, count: 0, platformId: r.platform_id };
    cur.total += Number(r.amount || 0);
    cur.count += 1;
    acc.set(key, cur);
  }
  const grand = sumBDT(rows);
  return [...acc.entries()]
    .map(([key, v]) => ({
      name: key.split("::").slice(1).join("::"),
      platformId: v.platformId,
      platformName: v.platformId ? nameById.get(v.platformId) ?? "Unknown" : "Unassigned",
      total: v.total,
      count: v.count,
      percentage: pct(v.total, grand),
    }))
    .sort((a, b) => b.total - a.total);
}

export interface CurrencySummary {
  currency: string;
  originalTotal: number;
  convertedTotal: number;
  count: number;
  /** Weighted average exchange rate (convertedTotal / originalTotal). */
  avgRate: number;
  percentage: number;
}

export function buildCurrencySummary(rows: MarketingExpense[]): CurrencySummary[] {
  const acc = new Map<string, { orig: number; conv: number; count: number }>();
  for (const r of rows) {
    const cur = acc.get(r.currency) ?? { orig: 0, conv: 0, count: 0 };
    cur.orig += Number(r.original_amount ?? r.amount ?? 0);
    cur.conv += Number(r.amount || 0);
    cur.count += 1;
    acc.set(r.currency, cur);
  }
  const grand = sumBDT(rows);
  return [...acc.entries()]
    .map(([currency, v]) => ({
      currency,
      originalTotal: v.orig,
      convertedTotal: v.conv,
      count: v.count,
      avgRate: v.orig > 0 ? v.conv / v.orig : 1,
      percentage: pct(v.conv, grand),
    }))
    .sort((a, b) => b.convertedTotal - a.convertedTotal);
}

export interface MonthlyPoint {
  key: string;
  label: string;
  total: number;
}

export function buildMonthlyMarketing(rows: MarketingExpense[]): MonthlyPoint[] {
  const totals = new Map<string, number>();
  for (const r of rows) {
    const key = r.expense_date.slice(0, 7);
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
// Formatting
// ----------------------------------------------------------------------------

export function formatBDT(amount: number): string {
  return `৳ ${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0)}`;
}

export function formatMoney(amount: number, currency: string, symbol?: string | null): string {
  const num = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
  return symbol ? `${symbol} ${num}` : `${num} ${currency}`;
}

export function defaultRange(): DateRange {
  const now = new Date();
  return { from: format(startOfMonth(now), "yyyy-MM-dd"), to: format(endOfMonth(now), "yyyy-MM-dd") };
}
