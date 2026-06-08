import { supabase } from "@/integrations/supabase/client";

/**
 * Global Search data layer.
 *
 * Provides a single universal search across every major record type in the
 * platform. Each entity is queried independently and failures are isolated
 * (a permission-restricted table simply yields no results rather than
 * breaking the whole search). Results are normalised into a single shape so
 * the UI can render them uniformly with a quick-open link.
 *
 * Reusable by design: future ERP modules (inventory, vendors, purchases…)
 * register here by adding one more `safe(...)` block.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type SearchEntity =
  | "expense"
  | "marketing"
  | "return"
  | "damage"
  | "category"
  | "subcategory"
  | "user"
  | "report";

export interface SearchResult {
  id: string;
  entity: SearchEntity;
  number: string | null;
  title: string;
  status: string | null;
  date: string | null;
  /** Route path for quick-open navigation. */
  to: string;
  params?: Record<string, string>;
}

export const ENTITY_LABELS: Record<SearchEntity, string> = {
  expense: "Expenses",
  marketing: "Marketing Costs",
  return: "Returns",
  damage: "Damages",
  category: "Categories",
  subcategory: "Subcategories",
  user: "Users",
  report: "Reports",
};

const PER_GROUP = 6;
const MIN_LEN = 2;

/** Sanitise a term so it is safe inside a PostgREST `or(...)` ilike filter. */
function sanitise(term: string): string {
  return term.trim().replace(/[%(),*]/g, " ").replace(/\s+/g, " ").trim();
}

async function safe<T>(fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fn();
  } catch {
    return [];
  }
}

export async function globalSearch(rawTerm: string): Promise<SearchResult[]> {
  const term = sanitise(rawTerm);
  if (term.length < MIN_LEN) return [];
  const like = `%${term}%`;

  const [
    expenses,
    marketing,
    returns,
    damages,
    categories,
    subcategories,
    users,
    reports,
  ] = await Promise.all([
    safe(async () => {
      const { data } = await db
        .from("expenses")
        .select("id, expense_number, description, status, expense_date")
        .neq("status", "deleted")
        .or("is_marketing.is.null,is_marketing.eq.false")
        .or(`expense_number.ilike.${like},description.ilike.${like},notes.ilike.${like}`)
        .order("expense_date", { ascending: false })
        .limit(PER_GROUP);
      return (data ?? []) as any[];
    }),
    safe(async () => {
      const { data } = await db
        .from("expenses")
        .select("id, expense_number, description, status, expense_date, campaign_name")
        .neq("status", "deleted")
        .eq("is_marketing", true)
        .or(`expense_number.ilike.${like},description.ilike.${like},campaign_name.ilike.${like}`)
        .order("expense_date", { ascending: false })
        .limit(PER_GROUP);
      return (data ?? []) as any[];
    }),
    safe(async () => {
      const { data } = await db
        .from("returns")
        .select("id, return_number, product_name, status, return_date")
        .neq("status", "deleted")
        .or(`return_number.ilike.${like},product_name.ilike.${like},notes.ilike.${like}`)
        .order("return_date", { ascending: false })
        .limit(PER_GROUP);
      return (data ?? []) as any[];
    }),
    safe(async () => {
      const { data } = await db
        .from("damages")
        .select("id, damage_number, product_name, status, damage_date")
        .neq("status", "deleted")
        .or(`damage_number.ilike.${like},product_name.ilike.${like},notes.ilike.${like}`)
        .order("damage_date", { ascending: false })
        .limit(PER_GROUP);
      return (data ?? []) as any[];
    }),
    safe(async () => {
      const { data } = await db
        .from("expense_categories")
        .select("id, name")
        .is("deleted_at", null)
        .ilike("name", like)
        .limit(PER_GROUP);
      return (data ?? []) as any[];
    }),
    safe(async () => {
      const { data } = await db
        .from("expense_subcategories")
        .select("id, name")
        .is("deleted_at", null)
        .ilike("name", like)
        .limit(PER_GROUP);
      return (data ?? []) as any[];
    }),
    safe(async () => {
      const { data } = await db
        .from("profiles")
        .select("id, full_name, email, status")
        .or(`full_name.ilike.${like},email.ilike.${like}`)
        .limit(PER_GROUP);
      return (data ?? []) as any[];
    }),
    safe(async () => {
      const { data } = await db
        .from("report_exports")
        .select("id, report_number, title, report_type, created_at")
        .or(`report_number.ilike.${like},title.ilike.${like}`)
        .order("created_at", { ascending: false })
        .limit(PER_GROUP);
      return (data ?? []) as any[];
    }),
  ]);

  const out: SearchResult[] = [];

  for (const r of expenses)
    out.push({
      id: r.id,
      entity: "expense",
      number: r.expense_number,
      title: r.description || "Expense",
      status: r.status,
      date: r.expense_date,
      to: "/expenses/$id",
      params: { id: r.id },
    });

  for (const r of marketing)
    out.push({
      id: r.id,
      entity: "marketing",
      number: r.expense_number,
      title: r.campaign_name || r.description || "Marketing cost",
      status: r.status,
      date: r.expense_date,
      to: "/expenses/$id",
      params: { id: r.id },
    });

  for (const r of returns)
    out.push({
      id: r.id,
      entity: "return",
      number: r.return_number,
      title: r.product_name || "Return",
      status: r.status,
      date: r.return_date,
      to: "/returns/$id",
      params: { id: r.id },
    });

  for (const r of damages)
    out.push({
      id: r.id,
      entity: "damage",
      number: r.damage_number,
      title: r.product_name || "Damage",
      status: r.status,
      date: r.damage_date,
      to: "/damages/$id",
      params: { id: r.id },
    });

  for (const r of categories)
    out.push({
      id: r.id,
      entity: "category",
      number: null,
      title: r.name,
      status: null,
      date: null,
      to: "/expenses/categories",
    });

  for (const r of subcategories)
    out.push({
      id: r.id,
      entity: "subcategory",
      number: null,
      title: r.name,
      status: null,
      date: null,
      to: "/expenses/categories",
    });

  for (const r of users)
    out.push({
      id: r.id,
      entity: "user",
      number: null,
      title: r.full_name?.trim() || r.email || "User",
      status: r.status,
      date: null,
      to: "/users",
    });

  for (const r of reports)
    out.push({
      id: r.id,
      entity: "report",
      number: r.report_number,
      title: r.title || "Report",
      status: null,
      date: r.created_at,
      to: "/reports/export-history",
    });

  return out;
}
