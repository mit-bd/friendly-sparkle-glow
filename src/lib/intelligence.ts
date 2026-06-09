import {
  format,
  parseISO,
  subDays,
  subMonths,
  differenceInCalendarDays,
  startOfMonth,
  endOfMonth,
} from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import type { DateRange } from "./analytics";
import type { ExpenseCategory, ExpenseSubcategory } from "./expenses";
import type { ReturnRecord, DamageRecord } from "./loss";

/**
 * Expense Intelligence & Management Analytics layer (Phase 12).
 *
 * This module is READ-ONLY decision support. It never mutates expenses,
 * approvals, reports, permissions or any business record. It composes the
 * existing approved-only datasets (expenses + returns + damages + marketing)
 * into management-grade analytics: KPI deltas, composition, trends, category /
 * subcategory performance, fixed-vs-variable, loss impact, anomaly detection,
 * a rule-based management summary and an expense health score.
 *
 * CRITICAL BUSINESS RULE (unchanged): only APPROVED records ever feed any
 * total, chart, score or insight produced here.
 */

export const APPROVED_STATUS = "approved" as const;

/** Keyword matchers (adapt to renames, no hardcoded IDs). */
export const PRODUCT_KEYWORDS = ["product", "inventory", "stock", "purchase", "cogs"];

// ----------------------------------------------------------------------------
// Date helpers
// ----------------------------------------------------------------------------

const fmt = (d: Date) => format(d, "yyyy-MM-dd");

/** The equal-length window immediately preceding `range` (for % change). */
export function previousRange(range: DateRange): DateRange {
  const from = parseISO(range.from);
  const to = parseISO(range.to);
  const days = Math.max(differenceInCalendarDays(to, from) + 1, 1);
  const prevTo = subDays(from, 1);
  const prevFrom = subDays(from, days);
  return { from: fmt(prevFrom), to: fmt(prevTo) };
}

/** A trailing N-month window (inclusive of the current month) for trend/anomaly. */
export function trailingMonthsRange(months: number): DateRange {
  const now = new Date();
  return { from: fmt(startOfMonth(subMonths(now, months - 1))), to: fmt(endOfMonth(now)) };
}

// ----------------------------------------------------------------------------
// Data fetching (approved only)
// ----------------------------------------------------------------------------

export interface IntelExpense {
  id: string;
  expense_date: string;
  amount: number;
  category_id: string | null;
  subcategory_id: string | null;
  is_marketing: boolean | null;
  is_fixed_cost: boolean | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const EXP_COLS =
  "id, expense_date, amount, category_id, subcategory_id, is_marketing, is_fixed_cost";
const PAGE = 1000;

/** Every approved expense in range, including marketing & fixed-cost flags. */
export async function fetchIntelExpenses(range: DateRange): Promise<IntelExpense[]> {
  const all: IntelExpense[] = [];
  let offset = 0;
  for (let i = 0; i < 100; i++) {
    const { data, error } = await db
      .from("expenses")
      .select(EXP_COLS)
      .eq("status", APPROVED_STATUS)
      .gte("expense_date", range.from)
      .lte("expense_date", range.to)
      .order("expense_date", { ascending: false })
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as IntelExpense[];
    all.push(...rows);
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

export interface IntelDataset {
  expenses: IntelExpense[];
  returns: ReturnRecord[];
  damages: DamageRecord[];
}

// ----------------------------------------------------------------------------
// Classification & totals
// ----------------------------------------------------------------------------

const num = (v: unknown) => Number(v || 0);
export const sum = <T>(rows: T[], pick: (r: T) => number) =>
  rows.reduce((a, r) => a + num(pick(r)), 0);
const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

/** Resolve which category ids match the product keyword set. */
export function productCategoryIds(categories: ExpenseCategory[]): Set<string> {
  const set = new Set<string>();
  for (const c of categories) {
    const n = c.name.toLowerCase();
    if (PRODUCT_KEYWORDS.some((k) => n.includes(k))) set.add(c.id);
  }
  return set;
}

export type CostBucket = "fixed" | "marketing" | "product" | "other";

/** Mutually-exclusive bucket for one expense row (fixed → marketing → product → other). */
export function bucketOf(e: IntelExpense, productIds: Set<string>): CostBucket {
  if (e.is_fixed_cost) return "fixed";
  if (e.is_marketing) return "marketing";
  if (e.category_id && productIds.has(e.category_id)) return "product";
  return "other";
}

export interface IntelTotals {
  /** Approved expense-table total (fixed + variable). */
  total: number;
  fixed: number;
  variable: number;
  marketing: number;
  product: number;
  other: number;
  returnLoss: number;
  damageLoss: number;
  /** All money out: expenses + return loss + damage loss. */
  grandOutflow: number;
}

export function buildTotals(data: IntelDataset, categories: ExpenseCategory[]): IntelTotals {
  const productIds = productCategoryIds(categories);
  let fixed = 0;
  let marketing = 0;
  let product = 0;
  let other = 0;
  for (const e of data.expenses) {
    const v = num(e.amount);
    switch (bucketOf(e, productIds)) {
      case "fixed":
        fixed += v;
        break;
      case "marketing":
        marketing += v;
        break;
      case "product":
        product += v;
        break;
      default:
        other += v;
    }
  }
  const total = fixed + marketing + product + other;
  const returnLoss = sum(data.returns, (r) => r.net_loss_amount);
  const damageLoss = sum(data.damages, (d) => d.damage_value);
  return {
    total,
    fixed,
    variable: marketing + product + other,
    marketing,
    product,
    other,
    returnLoss,
    damageLoss,
    grandOutflow: total + returnLoss + damageLoss,
  };
}

// ----------------------------------------------------------------------------
// KPI cards (current vs previous)
// ----------------------------------------------------------------------------

export type KpiKey =
  | "total"
  | "fixed"
  | "variable"
  | "marketing"
  | "product"
  | "returnLoss"
  | "damageLoss";

export interface Kpi {
  key: KpiKey;
  label: string;
  current: number;
  previous: number;
  changePct: number;
  direction: "up" | "down" | "flat";
  /** True when "up" is unfavourable for management (all costs/losses here). */
  upIsBad: boolean;
}

const KPI_LABELS: Record<KpiKey, string> = {
  total: "Total Expense",
  fixed: "Fixed Cost",
  variable: "Variable Cost",
  marketing: "Marketing Cost",
  product: "Product Cost",
  returnLoss: "Return Loss",
  damageLoss: "Damage Loss",
};

export function changePct(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export function buildKpis(current: IntelTotals, previous: IntelTotals): Kpi[] {
  const keys: KpiKey[] = [
    "total",
    "fixed",
    "variable",
    "marketing",
    "product",
    "returnLoss",
    "damageLoss",
  ];
  return keys.map((key) => {
    const cur = current[key];
    const prev = previous[key];
    const cp = changePct(cur, prev);
    return {
      key,
      label: KPI_LABELS[key],
      current: cur,
      previous: prev,
      changePct: cp,
      direction: Math.abs(cp) < 0.05 ? "flat" : cp > 0 ? "up" : "down",
      upIsBad: true,
    };
  });
}

// ----------------------------------------------------------------------------
// Composition (pie / donut, drill-down)
// ----------------------------------------------------------------------------

export interface CompositionSlice {
  key: string;
  name: string;
  value: number;
  percentage: number;
  color: string;
}

const SLICE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--muted-foreground)",
];

export function buildComposition(t: IntelTotals): CompositionSlice[] {
  const base: { key: string; name: string; value: number }[] = [
    { key: "fixed", name: "Fixed Cost", value: t.fixed },
    { key: "marketing", name: "Marketing", value: t.marketing },
    { key: "product", name: "Product Cost", value: t.product },
    { key: "returnLoss", name: "Return Loss", value: t.returnLoss },
    { key: "damageLoss", name: "Damage Loss", value: t.damageLoss },
    { key: "other", name: "Other Expenses", value: t.other },
  ];
  const whole = t.grandOutflow;
  return base
    .filter((b) => b.value > 0)
    .map((b, i) => ({
      ...b,
      percentage: pct(b.value, whole),
      color: SLICE_COLORS[i % SLICE_COLORS.length],
    }))
    .sort((a, b) => b.value - a.value);
}

// ----------------------------------------------------------------------------
// Month-over-month trend (monthly / quarterly / yearly)
// ----------------------------------------------------------------------------

export type Granularity = "monthly" | "quarterly" | "yearly";

export interface SeriesPoint {
  key: string;
  label: string;
  value: number;
}

function periodKey(date: string, g: Granularity): { key: string; label: string } {
  const d = parseISO(date.length > 10 ? date.slice(0, 10) : date);
  const y = d.getFullYear();
  if (g === "yearly") return { key: String(y), label: String(y) };
  if (g === "quarterly") {
    const q = Math.floor(d.getMonth() / 3) + 1;
    return { key: `${y}-Q${q}`, label: `Q${q} ${y}` };
  }
  return { key: format(d, "yyyy-MM"), label: format(d, "MMM yyyy") };
}

/** Generic bucketed series for any dated value list. */
export function buildSeries<T>(
  rows: T[],
  dateOf: (r: T) => string,
  valueOf: (r: T) => number,
  g: Granularity,
): SeriesPoint[] {
  const acc = new Map<string, { label: string; value: number }>();
  for (const r of rows) {
    const { key, label } = periodKey(dateOf(r), g);
    const cur = acc.get(key) ?? { label, value: 0 };
    cur.value += num(valueOf(r));
    acc.set(key, cur);
  }
  return [...acc.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, v]) => ({ key, label: v.label, value: v.value }));
}

/** Latest vs previous bucket delta for a series. */
export function seriesDelta(points: SeriesPoint[]): {
  current: number;
  previous: number;
  changePct: number;
  direction: "up" | "down" | "flat";
} {
  const current = points.length ? points[points.length - 1].value : 0;
  const previous = points.length > 1 ? points[points.length - 2].value : 0;
  const cp = changePct(current, previous);
  return {
    current,
    previous,
    changePct: cp,
    direction: Math.abs(cp) < 0.05 ? "flat" : cp > 0 ? "up" : "down",
  };
}

export interface MetricTrend {
  key: KpiKey;
  label: string;
  points: SeriesPoint[];
  current: number;
  previous: number;
  changePct: number;
  direction: "up" | "down" | "flat";
}

/** Build the labelled MoM trend set across all primary metrics. */
export function buildMetricTrends(
  data: IntelDataset,
  categories: ExpenseCategory[],
  g: Granularity,
): MetricTrend[] {
  const productIds = productCategoryIds(categories);
  const expBucket = (b: CostBucket) =>
    data.expenses.filter((e) => bucketOf(e, productIds) === b);

  const defs: { key: KpiKey; label: string; rows: { d: string; v: number }[] }[] = [
    {
      key: "total",
      label: "Total Expense",
      rows: data.expenses.map((e) => ({ d: e.expense_date, v: num(e.amount) })),
    },
    {
      key: "fixed",
      label: "Fixed Cost",
      rows: expBucket("fixed").map((e) => ({ d: e.expense_date, v: num(e.amount) })),
    },
    {
      key: "variable",
      label: "Variable Cost",
      rows: data.expenses
        .filter((e) => bucketOf(e, productIds) !== "fixed")
        .map((e) => ({ d: e.expense_date, v: num(e.amount) })),
    },
    {
      key: "marketing",
      label: "Marketing Cost",
      rows: expBucket("marketing").map((e) => ({ d: e.expense_date, v: num(e.amount) })),
    },
    {
      key: "product",
      label: "Product Cost",
      rows: expBucket("product").map((e) => ({ d: e.expense_date, v: num(e.amount) })),
    },
    {
      key: "returnLoss",
      label: "Return Loss",
      rows: data.returns.map((r) => ({ d: r.return_date, v: num(r.net_loss_amount) })),
    },
    {
      key: "damageLoss",
      label: "Damage Loss",
      rows: data.damages.map((d) => ({ d: d.damage_date, v: num(d.damage_value) })),
    },
  ];

  return defs.map((def) => {
    const points = buildSeries(def.rows, (r) => r.d, (r) => r.v, g);
    const delta = seriesDelta(points);
    return { key: def.key, label: def.label, points, ...delta };
  });
}

// ----------------------------------------------------------------------------
// Category & subcategory performance (current vs previous range growth)
// ----------------------------------------------------------------------------

export interface PerfRow {
  id: string | null;
  name: string;
  total: number;
  prev: number;
  count: number;
  percentage: number;
  growthPct: number;
}

function aggregateByKey(
  rows: IntelExpense[],
  keyOf: (e: IntelExpense) => string,
): Map<string, { total: number; count: number }> {
  const acc = new Map<string, { total: number; count: number }>();
  for (const r of rows) {
    const key = keyOf(r);
    const cur = acc.get(key) ?? { total: 0, count: 0 };
    cur.total += num(r.amount);
    cur.count += 1;
    acc.set(key, cur);
  }
  return acc;
}

export function buildCategoryPerformance(
  current: IntelExpense[],
  previous: IntelExpense[],
  categories: ExpenseCategory[],
): PerfRow[] {
  const nameById = new Map(categories.map((c) => [c.id, c.name]));
  const keyOf = (e: IntelExpense) => e.category_id ?? "__none__";
  const curAgg = aggregateByKey(current, keyOf);
  const prevAgg = aggregateByKey(previous, keyOf);
  const grand = sum(current, (e) => e.amount);
  return [...curAgg.entries()]
    .map(([id, v]) => {
      const prev = prevAgg.get(id)?.total ?? 0;
      return {
        id: id === "__none__" ? null : id,
        name: id === "__none__" ? "Uncategorized" : nameById.get(id) ?? "Unknown",
        total: v.total,
        prev,
        count: v.count,
        percentage: pct(v.total, grand),
        growthPct: changePct(v.total, prev),
      };
    })
    .sort((a, b) => b.total - a.total);
}

export function buildSubcategoryPerformance(
  current: IntelExpense[],
  previous: IntelExpense[],
  subcategories: ExpenseSubcategory[],
  categories: ExpenseCategory[],
): (PerfRow & { categoryName: string })[] {
  const subById = new Map(subcategories.map((s) => [s.id, s]));
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const keyOf = (e: IntelExpense) => e.subcategory_id ?? "__none__";
  const curAgg = aggregateByKey(current, keyOf);
  const prevAgg = aggregateByKey(previous, keyOf);
  const grand = sum(current, (e) => e.amount);
  return [...curAgg.entries()]
    .map(([id, v]) => {
      const sub = id === "__none__" ? undefined : subById.get(id);
      const prev = prevAgg.get(id)?.total ?? 0;
      return {
        id: id === "__none__" ? null : id,
        name: id === "__none__" ? "Unspecified" : sub?.name ?? "Unknown",
        categoryName: sub ? catName.get(sub.category_id) ?? "—" : "—",
        total: v.total,
        prev,
        count: v.count,
        percentage: pct(v.total, grand),
        growthPct: changePct(v.total, prev),
      };
    })
    .sort((a, b) => b.total - a.total);
}

// ----------------------------------------------------------------------------
// Fixed vs Variable trend
// ----------------------------------------------------------------------------

export interface FixedVariablePoint {
  key: string;
  label: string;
  fixed: number;
  variable: number;
  total: number;
}

export function buildFixedVariableSeries(
  expenses: IntelExpense[],
  categories: ExpenseCategory[],
  g: Granularity,
): FixedVariablePoint[] {
  const productIds = productCategoryIds(categories);
  const acc = new Map<string, { label: string; fixed: number; variable: number }>();
  for (const e of expenses) {
    const { key, label } = periodKey(e.expense_date, g);
    const cur = acc.get(key) ?? { label, fixed: 0, variable: 0 };
    if (bucketOf(e, productIds) === "fixed") cur.fixed += num(e.amount);
    else cur.variable += num(e.amount);
    acc.set(key, cur);
  }
  return [...acc.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, v]) => ({
      key,
      label: v.label,
      fixed: v.fixed,
      variable: v.variable,
      total: v.fixed + v.variable,
    }));
}

// ----------------------------------------------------------------------------
// Anomaly detection (current month vs trailing average)
// ----------------------------------------------------------------------------

export interface Anomaly {
  key: string;
  label: string;
  scope: string;
  average: number;
  current: number;
  changePct: number;
  direction: "increase" | "decrease";
  severity: "warning" | "critical";
}

const SPIKE = 1.5; // current >= 1.5x average ⇒ flag increase
const DROP = 0.5; // current <= 0.5x average ⇒ flag decrease
const MIN_ABS = 500; // ignore trivial BDT swings

/** Flag series whose latest month deviates sharply from its prior-month average. */
function detectInGroups(
  groups: Map<string, { label: string; scope: string; monthly: Map<string, number> }>,
): Anomaly[] {
  const out: Anomaly[] = [];
  for (const [key, g] of groups) {
    const months = [...g.monthly.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    if (months.length < 2) continue;
    const current = months[months.length - 1][1];
    const prior = months.slice(0, -1).map(([, v]) => v);
    const average = prior.reduce((a, v) => a + v, 0) / prior.length;
    if (average <= 0 && current <= 0) continue;
    const diff = current - average;
    if (Math.abs(diff) < MIN_ABS) continue;
    const ratio = average > 0 ? current / average : current > 0 ? Infinity : 0;
    if (ratio >= SPIKE) {
      out.push({
        key,
        label: g.label,
        scope: g.scope,
        average,
        current,
        changePct: changePct(current, average),
        direction: "increase",
        severity: ratio >= SPIKE * 2 ? "critical" : "warning",
      });
    } else if (ratio <= DROP && average > 0) {
      out.push({
        key,
        label: g.label,
        scope: g.scope,
        average,
        current,
        changePct: changePct(current, average),
        direction: "decrease",
        severity: "warning",
      });
    }
  }
  return out.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
}

/**
 * Detect anomalies across categories, subcategories, fixed/marketing buckets,
 * returns and damages using a trailing-history dataset (monthly buckets).
 */
export function detectAnomalies(
  history: IntelDataset,
  categories: ExpenseCategory[],
  subcategories: ExpenseSubcategory[],
): Anomaly[] {
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const subName = new Map(subcategories.map((s) => [s.id, s.name]));
  const productIds = productCategoryIds(categories);
  const groups = new Map<
    string,
    { label: string; scope: string; monthly: Map<string, number> }
  >();

  const add = (gkey: string, label: string, scope: string, monthKey: string, val: number) => {
    const g = groups.get(gkey) ?? { label, scope, monthly: new Map() };
    g.monthly.set(monthKey, (g.monthly.get(monthKey) ?? 0) + val);
    groups.set(gkey, g);
  };

  for (const e of history.expenses) {
    const mk = e.expense_date.slice(0, 7);
    const cKey = e.category_id ?? "__none__";
    add(
      `cat:${cKey}`,
      cKey === "__none__" ? "Uncategorized" : catName.get(cKey) ?? "Unknown",
      "Category",
      mk,
      num(e.amount),
    );
    if (e.subcategory_id) {
      add(
        `sub:${e.subcategory_id}`,
        subName.get(e.subcategory_id) ?? "Unknown",
        "Subcategory",
        mk,
        num(e.amount),
      );
    }
    const b = bucketOf(e, productIds);
    if (b === "fixed") add("bucket:fixed", "Fixed Costs", "Cost Type", mk, num(e.amount));
    if (b === "marketing") add("bucket:marketing", "Marketing", "Cost Type", mk, num(e.amount));
  }
  for (const r of history.returns)
    add("loss:returns", "Return Loss", "Loss", r.return_date.slice(0, 7), num(r.net_loss_amount));
  for (const d of history.damages)
    add("loss:damages", "Damage Loss", "Loss", d.damage_date.slice(0, 7), num(d.damage_value));

  return detectInGroups(groups);
}

// ----------------------------------------------------------------------------
// Management summary (rule-based, no AI)
// ----------------------------------------------------------------------------

export interface Insight {
  tone: "positive" | "negative" | "neutral";
  text: string;
}

function describe(label: string, cp: number, goodWhenDown = true): Insight {
  const rounded = Math.abs(cp);
  if (rounded < 0.5) return { tone: "neutral", text: `${label} remained stable.` };
  const dir = cp > 0 ? "increased" : "decreased";
  const goodDir = cp > 0 ? !goodWhenDown : goodWhenDown;
  const magnitude = rounded >= 25 ? "significantly " : "";
  return {
    tone: goodDir ? "positive" : "negative",
    text: `${label} ${magnitude}${dir} by ${rounded.toFixed(1)}%.`,
  };
}

export function buildInsights(kpis: Kpi[], anomalies: Anomaly[]): Insight[] {
  const byKey = new Map(kpis.map((k) => [k.key, k]));
  const out: Insight[] = [];
  const push = (key: KpiKey, label: string) => {
    const k = byKey.get(key);
    if (k) out.push(describe(label, k.changePct));
  };
  push("total", "This period total expenses");
  push("fixed", "Fixed costs");
  push("marketing", "Marketing cost");
  push("returnLoss", "Return loss");
  push("damageLoss", "Damage loss");

  if (anomalies.length > 0) {
    const top = anomalies[0];
    out.push({
      tone: top.direction === "increase" ? "negative" : "neutral",
      text: `${top.label} shows an abnormal ${top.direction} versus its recent average.`,
    });
  } else {
    out.push({ tone: "positive", text: "No abnormal cost spikes detected." });
  }
  return out;
}

// ----------------------------------------------------------------------------
// Expense health score (0–100)
// ----------------------------------------------------------------------------

export interface HealthScore {
  score: number;
  band: "Excellent" | "Good" | "Warning" | "Critical";
  factors: { label: string; score: number; detail: string }[];
}

function clamp(v: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, v));
}

/** Coefficient of variation of a numeric series (stability metric). */
function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, v) => a + v, 0) / values.length;
  if (mean <= 0) return 0;
  const variance =
    values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

export function computeHealthScore(
  current: IntelTotals,
  kpis: Kpi[],
  monthlyTotals: SeriesPoint[],
  composition: CompositionSlice[],
): HealthScore {
  // 1. Cost stability — low month-to-month variance is healthy.
  const cv = coefficientOfVariation(monthlyTotals.map((p) => p.value));
  const stability = clamp(100 - cv * 100);

  // 2. Cost growth — penalise rising total expense.
  const totalGrowth = kpis.find((k) => k.key === "total")?.changePct ?? 0;
  const growth = clamp(100 - Math.max(0, totalGrowth) * 2);

  // 3. Return loss ratio — share of outflow lost to returns.
  const retRatio = pct(current.returnLoss, current.grandOutflow);
  const returnHealth = clamp(100 - retRatio * 4);

  // 4. Damage loss ratio.
  const dmgRatio = pct(current.damageLoss, current.grandOutflow);
  const damageHealth = clamp(100 - dmgRatio * 5);

  // 5. Distribution — over-concentration in a single bucket is risky.
  const topShare = composition.length ? composition[0].percentage : 0;
  const distribution = clamp(100 - Math.max(0, topShare - 50) * 2);

  const factors = [
    { label: "Cost Stability", score: Math.round(stability), detail: `Variation ${(cv * 100).toFixed(0)}%` },
    { label: "Cost Growth", score: Math.round(growth), detail: `${totalGrowth >= 0 ? "+" : ""}${totalGrowth.toFixed(1)}% vs prev` },
    { label: "Return Loss", score: Math.round(returnHealth), detail: `${retRatio.toFixed(1)}% of outflow` },
    { label: "Damage Loss", score: Math.round(damageHealth), detail: `${dmgRatio.toFixed(1)}% of outflow` },
    { label: "Distribution", score: Math.round(distribution), detail: `Top bucket ${topShare.toFixed(0)}%` },
  ];

  const weights = [0.2, 0.25, 0.2, 0.2, 0.15];
  const score = Math.round(
    clamp(factors.reduce((a, f, i) => a + f.score * weights[i], 0)),
  );
  const band: HealthScore["band"] =
    score >= 85 ? "Excellent" : score >= 70 ? "Good" : score >= 50 ? "Warning" : "Critical";
  return { score, band, factors };
}

// ----------------------------------------------------------------------------
// Formatting
// ----------------------------------------------------------------------------

export function formatPct(v: number): string {
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}