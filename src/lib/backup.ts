import { supabase } from "@/integrations/supabase/client";
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
} from "date-fns";

/**
 * Functional backup & restore engine for the Motion IT BD platform.
 *
 * A backup is a single self-describing JSON document containing the rows of
 * every business table, captured through the authenticated Supabase client
 * (so RLS still applies — this is intended for admins, who can read all rows).
 *
 * Restore re-applies a backup either by MERGING (upsert on primary key, keeps
 * rows not present in the file) or REPLACING (clears the affected tables first,
 * then inserts). Auth-critical identity tables (profiles, user_roles) are never
 * deleted during a replace to prevent an admin from locking themselves out —
 * they are always merged.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const BACKUP_FORMAT = "motion-it-bd/backup";
export const BACKUP_VERSION = 1;

export type BackupRangePreset =
  | "today"
  | "last7"
  | "last30"
  | "this_month"
  | "last_month"
  | "this_year"
  | "custom"
  | "all";

export const BACKUP_RANGE_PRESETS: { value: BackupRangePreset; label: string }[] = [
  { value: "all", label: "Everything (full backup)" },
  { value: "today", label: "Today" },
  { value: "last7", label: "Last 7 Days" },
  { value: "last30", label: "Last 30 Days" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_year", label: "This Year" },
  { value: "custom", label: "Custom Date Range" },
];

export interface BackupRange {
  from: string | null; // yyyy-MM-dd inclusive, null = unbounded
  to: string | null;
}

const fmt = (d: Date) => format(d, "yyyy-MM-dd");

export function resolveBackupRange(
  preset: BackupRangePreset,
  custom?: Partial<BackupRange>,
): BackupRange {
  const now = new Date();
  switch (preset) {
    case "today":
      return { from: fmt(startOfDay(now)), to: fmt(endOfDay(now)) };
    case "last7":
      return { from: fmt(startOfDay(subDays(now, 6))), to: fmt(endOfDay(now)) };
    case "last30":
      return { from: fmt(startOfDay(subDays(now, 29))), to: fmt(endOfDay(now)) };
    case "this_month":
      return { from: fmt(startOfMonth(now)), to: fmt(endOfMonth(now)) };
    case "last_month": {
      const lm = subMonths(now, 1);
      return { from: fmt(startOfMonth(lm)), to: fmt(endOfMonth(lm)) };
    }
    case "this_year":
      return { from: fmt(startOfYear(now)), to: fmt(endOfYear(now)) };
    case "custom":
      return { from: custom?.from ?? null, to: custom?.to ?? null };
    case "all":
    default:
      return { from: null, to: null };
  }
}

/** Describes one table participating in backup/restore. */
export interface BackupTableSpec {
  /** Logical key stored in the backup document. */
  key: string;
  /** Physical table name. */
  table: string;
  /** Human label for the UI. */
  label: string;
  /** Date column used to scope a ranged backup. Omit to always include all rows. */
  dateField?: string;
  /** Primary-key column for upsert (defaults to "id"). */
  pk?: string;
  /** Auth-critical: merge only, never deleted on replace. */
  identity?: boolean;
}

/**
 * Tables are ordered parent → child so a restore inserts referenced rows first.
 * The same order reversed is used to clear tables during a replace.
 */
export const BACKUP_TABLES: BackupTableSpec[] = [
  { key: "profiles", table: "profiles", label: "Users", identity: true },
  { key: "user_roles", table: "user_roles", label: "Roles", identity: true },
  { key: "role_permissions", table: "role_permissions", label: "Permissions" },
  { key: "company_profile", table: "company_profile", label: "Company Profile" },
  { key: "signatories", table: "signatories", label: "Signatories" },
  { key: "notification_settings", table: "notification_settings", label: "Notification Settings" },
  { key: "currencies", table: "currencies", label: "Currencies" },
  { key: "marketing_platforms", table: "marketing_platforms", label: "Marketing Platforms" },
  { key: "return_reasons", table: "return_reasons", label: "Return Reasons" },
  { key: "damage_types", table: "damage_types", label: "Damage Types" },
  { key: "expense_categories", table: "expense_categories", label: "Categories" },
  { key: "expense_subcategories", table: "expense_subcategories", label: "Subcategories" },
  { key: "expenses", table: "expenses", label: "Expenses & Marketing", dateField: "expense_date" },
  { key: "returns", table: "returns", label: "Returns", dateField: "return_date" },
  { key: "damages", table: "damages", label: "Damages", dateField: "damage_date" },
  { key: "expense_attachments", table: "expense_attachments", label: "Expense Attachments" },
  { key: "expense_events", table: "expense_events", label: "Expense Events" },
  { key: "expense_comments", table: "expense_comments", label: "Expense Comments" },
  { key: "return_attachments", table: "return_attachments", label: "Return Attachments" },
  { key: "return_events", table: "return_events", label: "Return Events" },
  { key: "damage_attachments", table: "damage_attachments", label: "Damage Attachments" },
  { key: "damage_events", table: "damage_events", label: "Damage Events" },
  { key: "notifications", table: "notifications", label: "Notifications", dateField: "created_at" },
  { key: "report_exports", table: "report_exports", label: "Reports", dateField: "created_at" },
  { key: "activity_logs", table: "activity_logs", label: "Audit Logs", dateField: "created_at" },
  { key: "field_changes", table: "field_changes", label: "Field Changes", dateField: "changed_at" },
];

/** Number of tables included in a backup (for progress reporting). */
export const BACKUP_TABLES_TOTAL = BACKUP_TABLES.length;

export interface BackupMeta {
  format: string;
  version: number;
  generatedAt: string;
  generatedBy: string | null;
  generatedByEmail: string | null;
  app: string;
  rangePreset: BackupRangePreset;
  range: BackupRange;
}

export interface BackupDocument {
  meta: BackupMeta;
  tables: Record<string, Record<string, unknown>[]>;
}

const PAGE = 1000;

async function fetchAll(spec: BackupTableSpec, range: BackupRange): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let offset = 0;
  for (let i = 0; i < 200; i++) {
    let q = db.from(spec.table).select("*");
    if (spec.dateField && range.from) {
      const fromTs = spec.dateField.includes("_at") ? `${range.from}T00:00:00` : range.from;
      q = q.gte(spec.dateField, fromTs);
    }
    if (spec.dateField && range.to) {
      const toTs = spec.dateField.includes("_at") ? `${range.to}T23:59:59` : range.to;
      q = q.lte(spec.dateField, toTs);
    }
    q = q.range(offset, offset + PAGE - 1);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data ?? []) as Record<string, unknown>[];
    out.push(...rows);
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  return out;
}

export interface BackupProgress {
  table: string;
  label: string;
  count: number;
  ok: boolean;
  error?: string;
}

export async function generateBackup(
  preset: BackupRangePreset,
  range: BackupRange,
  actor: { id: string | null; email: string | null },
  onProgress?: (p: BackupProgress) => void,
): Promise<{ doc: BackupDocument; progress: BackupProgress[] }> {
  const tables: Record<string, Record<string, unknown>[]> = {};
  const progress: BackupProgress[] = [];
  for (const spec of BACKUP_TABLES) {
    try {
      const rows = await fetchAll(spec, range);
      tables[spec.key] = rows;
      const p: BackupProgress = { table: spec.key, label: spec.label, count: rows.length, ok: true };
      progress.push(p);
      onProgress?.(p);
    } catch (e) {
      tables[spec.key] = [];
      const p: BackupProgress = {
        table: spec.key,
        label: spec.label,
        count: 0,
        ok: false,
        error: e instanceof Error ? e.message : "Failed",
      };
      progress.push(p);
      onProgress?.(p);
    }
  }
  const doc: BackupDocument = {
    meta: {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      generatedAt: new Date().toISOString(),
      generatedBy: actor.id,
      generatedByEmail: actor.email,
      app: "Motion IT BD",
      rangePreset: preset,
      range,
    },
    tables,
  };
  return { doc, progress };
}

/** Count of marketing rows inside the expenses table (display only). */
export function marketingCount(doc: BackupDocument): number {
  return (doc.tables.expenses ?? []).filter((r) => (r as { is_marketing?: boolean }).is_marketing).length;
}

export function downloadBackup(doc: BackupDocument): string {
  const json = JSON.stringify(doc, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const stamp = format(new Date(), "yyyyMMdd-HHmm");
  const filename = `motion-it-backup-${stamp}.json`;
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return filename;
}

export interface ParsedBackup {
  doc: BackupDocument;
  summary: { key: string; label: string; count: number }[];
  totalRows: number;
}

export function parseBackup(text: string): ParsedBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  const doc = parsed as BackupDocument;
  if (!doc || typeof doc !== "object" || !doc.meta || doc.meta.format !== BACKUP_FORMAT) {
    throw new Error("This file is not a Motion IT BD backup.");
  }
  if (!doc.tables || typeof doc.tables !== "object") {
    throw new Error("Backup file is missing its data section.");
  }
  const summary: { key: string; label: string; count: number }[] = [];
  let total = 0;
  for (const spec of BACKUP_TABLES) {
    const rows = doc.tables[spec.key];
    if (Array.isArray(rows)) {
      summary.push({ key: spec.key, label: spec.label, count: rows.length });
      total += rows.length;
    }
  }
  return { doc, summary, totalRows: total };
}

export type RestoreMode = "merge" | "replace";

export interface RestoreResult {
  table: string;
  label: string;
  attempted: number;
  restored: number;
  ok: boolean;
  error?: string;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function restoreBackup(
  doc: BackupDocument,
  mode: RestoreMode,
  onProgress?: (r: RestoreResult) => void,
): Promise<RestoreResult[]> {
  const results: RestoreResult[] = [];

  // REPLACE: clear affected (non-identity) tables child → parent first.
  if (mode === "replace") {
    for (const spec of [...BACKUP_TABLES].reverse()) {
      if (spec.identity) continue;
      const rows = doc.tables[spec.key];
      if (!Array.isArray(rows)) continue;
      try {
        // Delete all rows (guarded by an always-true filter Supabase requires).
        await db.from(spec.table).delete().not("id", "is", null);
      } catch {
        /* best-effort clear; insert/upsert below still runs */
      }
    }
  }

  // INSERT/UPSERT parent → child.
  for (const spec of BACKUP_TABLES) {
    const rows = doc.tables[spec.key];
    if (!Array.isArray(rows) || rows.length === 0) {
      const empty: RestoreResult = { table: spec.key, label: spec.label, attempted: 0, restored: 0, ok: true };
      results.push(empty);
      onProgress?.(empty);
      continue;
    }
    const pk = spec.pk ?? "id";
    let restored = 0;
    let ok = true;
    let errMsg: string | undefined;
    for (const part of chunk(rows, 500)) {
      try {
        const { error } = await db.from(spec.table).upsert(part, { onConflict: pk });
        if (error) throw error;
        restored += part.length;
      } catch (e) {
        ok = false;
        errMsg = e instanceof Error ? e.message : "Failed";
      }
    }
    const r: RestoreResult = {
      table: spec.key,
      label: spec.label,
      attempted: rows.length,
      restored,
      ok,
      error: errMsg,
    };
    results.push(r);
    onProgress?.(r);
  }
  return results;
}