/**
 * Reusable bulk print / PDF / CSV engine shared by every records module
 * (Expenses, Marketing, Returns, Damages, Audit Logs).
 *
 * Pure presentation/export — no business logic. It never changes how data is
 * fetched, approved, or aggregated; it only formats already-loaded rows into a
 * combined printable document or CSV download.
 */
import { downloadCsv } from "./report-csv";

/** A single column / field rendered in both the combined print doc and CSV. */
export interface BulkField<T> {
  label: string;
  value: (row: T) => string;
}

export interface BulkExportConfig<T> {
  /** Internal module key, e.g. "expenses". */
  module: string;
  /** Human label, e.g. "Expenses". */
  moduleLabel: string;
  /** Title printed on the combined document, e.g. "Bulk Expense Report". */
  documentTitle: string;
  /** File name base for CSV downloads. */
  fileBase: string;
  /** Short prefix used inside the generated combined report number. */
  numberPrefix: string;
  /** Primary identifier shown as each record's section heading. */
  recordLabel: (row: T) => string;
  /** Detail fields rendered per record (print) and as CSV columns. */
  fields: BulkField<T>[];
}

/** Bulk export scopes requested by the user. */
export type BulkScope = "selected" | "filtered" | "all";

export const BULK_SCOPE_LABEL: Record<BulkScope, string> = {
  selected: "Selected records",
  filtered: "Current filter result",
  all: "Entire result set",
};

/**
 * A unique, human-readable number for one combined bulk document.
 * Format: BLK-<PREFIX>-<YYYYMMDD>-<HHMMSS>.
 */
export function generateBulkNumber(prefix: string): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
  const time = `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  return `BLK-${prefix}-${date}-${time}`;
}

/** Download the given rows as an Excel-friendly CSV using the module config. */
export function bulkCsv<T>(config: BulkExportConfig<T>, rows: T[]): void {
  const headers = config.fields.map((f) => f.label);
  const body = rows.map((r) => config.fields.map((f) => f.value(r)));
  downloadCsv(config.fileBase, headers, body);
}