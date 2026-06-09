import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { BulkPrintDocument } from "@/components/bulk/BulkPrintDocument";
import { logActivity } from "@/lib/audit";
import { formatDateTime } from "@/lib/expenses";
import {
  bulkCsv,
  generateBulkNumber,
  type BulkExportConfig,
  type BulkScope,
  BULK_SCOPE_LABEL,
} from "@/lib/bulk-export";

/** Lightweight checkbox-selection state keyed by a stable row id. */
export function useRowSelection<T>(getId: (row: T) => string) {
  const [ids, setIds] = useState<Set<string>>(new Set());

  const isSelected = useCallback((id: string) => ids.has(id), [ids]);
  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);
  const clear = useCallback(() => setIds(new Set()), []);
  const addMany = useCallback(
    (rows: T[]) =>
      setIds((prev) => {
        const next = new Set(prev);
        rows.forEach((r) => next.add(getId(r)));
        return next;
      }),
    [getId],
  );
  const removeMany = useCallback(
    (rows: T[]) =>
      setIds((prev) => {
        const next = new Set(prev);
        rows.forEach((r) => next.delete(getId(r)));
        return next;
      }),
    [getId],
  );

  return { ids, count: ids.size, isSelected, toggle, clear, addMany, removeMany };
}

interface UseBulkExportOptions<T> {
  config: BulkExportConfig<T>;
  getId: (row: T) => string;
  generatedBy: string;
  /** Whether the current user may print/export (export permission). */
  canExport: boolean;
}

interface PrintState<T> {
  rows: T[];
  number: string;
  at: string;
  scopeLabel: string;
}

/**
 * Wires selection state to bulk print / PDF / CSV actions and renders the
 * combined print-only document. Returns everything a list page needs.
 */
export function useBulkExport<T>({
  config,
  getId,
  generatedBy,
  canExport,
}: UseBulkExportOptions<T>) {
  const selection = useRowSelection(getId);
  const [printDoc, setPrintDoc] = useState<PrintState<T> | null>(null);
  const [busy, setBusy] = useState(false);

  // Trigger the browser print dialog once the hidden sheet is in the DOM.
  useEffect(() => {
    if (!printDoc) return;
    const t = setTimeout(() => window.print(), 150);
    return () => clearTimeout(t);
  }, [printDoc]);

  const guard = useCallback(
    (rows: T[]): boolean => {
      if (!canExport) {
        toast.error("You do not have export rights for this module.");
        return false;
      }
      if (rows.length === 0) {
        toast.error("Select at least one record first.");
        return false;
      }
      return true;
    },
    [canExport],
  );

  const runPrint = useCallback(
    (rows: T[], scope: BulkScope) => {
      if (!guard(rows)) return;
      const number = generateBulkNumber(config.numberPrefix);
      setPrintDoc({
        rows,
        number,
        at: formatDateTime(new Date().toISOString()),
        scopeLabel: BULK_SCOPE_LABEL[scope],
      });
      void logActivity({
        action: "print",
        entityType: "report",
        entityLabel: `${number} · ${config.moduleLabel}`,
        metadata: { module: config.module, count: rows.length, scope, kind: "bulk_print" },
      });
    },
    [config, guard],
  );

  const runPdf = useCallback(
    (rows: T[], scope: BulkScope) => {
      if (!guard(rows)) return;
      const number = generateBulkNumber(config.numberPrefix);
      setPrintDoc({
        rows,
        number,
        at: formatDateTime(new Date().toISOString()),
        scopeLabel: BULK_SCOPE_LABEL[scope],
      });
      toast.message('Use the print dialog\u2019s \u201cSave as PDF\u201d to export.');
      void logActivity({
        action: "export",
        entityType: "report",
        entityLabel: `${number} · ${config.moduleLabel}`,
        metadata: { module: config.module, count: rows.length, scope, format: "pdf", kind: "bulk_pdf" },
      });
    },
    [config, guard],
  );

  const runCsv = useCallback(
    (rows: T[], scope: BulkScope) => {
      if (!guard(rows)) return;
      bulkCsv(config, rows);
      toast.success(`Exported ${rows.length} record${rows.length === 1 ? "" : "s"} to CSV.`);
      void logActivity({
        action: "export",
        entityType: "report",
        entityLabel: `${config.moduleLabel} (${rows.length})`,
        metadata: { module: config.module, count: rows.length, scope, format: "csv", kind: "bulk_csv" },
      });
    },
    [config, guard],
  );

  const printNode = useMemo(
    () =>
      printDoc ? (
        <BulkPrintDocument
          config={config}
          rows={printDoc.rows}
          reportNumber={printDoc.number}
          generatedAt={printDoc.at}
          generatedBy={generatedBy}
          scopeLabel={printDoc.scopeLabel}
        />
      ) : null,
    [printDoc, config, generatedBy],
  );

  return { selection, busy, setBusy, runPrint, runPdf, runCsv, printNode };
}