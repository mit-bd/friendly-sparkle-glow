/**
 * Shared CSV export helper for every report module. Produces an Excel-friendly
 * UTF-8 CSV (BOM prefixed) and triggers a client-side download. Pure
 * presentation/export — no business logic.
 */

function escapeCell(value: unknown): string {
  const s =
    value === null || value === undefined
      ? ""
      : typeof value === "number"
        ? String(value)
        : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

export function buildCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(escapeCell).join(","));
  return lines.join("\r\n");
}

/** Download `rows` as a CSV file named `<base>-<yyyy-mm-dd>.csv`. */
export function downloadCsv(
  base: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
): void {
  const csv = buildCsv(headers, rows);
  // Prepend BOM so Excel renders UTF-8 (Bangla / currency symbols) correctly.
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${base}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
