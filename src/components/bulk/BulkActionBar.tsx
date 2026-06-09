import type { ReactNode } from "react";
import { FileDown, FileSpreadsheet, Printer, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BulkActionBarProps {
  count: number;
  canExport: boolean;
  busy?: boolean;
  onClear: () => void;
  onPrint: () => void;
  onPdf: () => void;
  onCsv: () => void;
  /** Optional extra control (e.g. a scope selector) rendered before actions. */
  extra?: ReactNode;
}

/**
 * Floating bulk-action toolbar. Appears only when at least one row is selected.
 * Bulk Print / PDF / CSV are gated by the module's export permission — without
 * export rights the user can still select rows but sees no export actions.
 */
export function BulkActionBar({
  count,
  canExport,
  busy,
  onClear,
  onPrint,
  onPdf,
  onCsv,
  extra,
}: BulkActionBarProps) {
  if (count === 0) return null;
  return (
    <div className="no-print pointer-events-none sticky bottom-4 z-30 flex justify-center">
      <div
        className={cn(
          "pointer-events-auto flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/95 px-3 py-2 shadow-lg backdrop-blur",
        )}
      >
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-gradient px-2 text-xs font-semibold text-brand-foreground">
          {count}
        </span>
        <span className="text-sm font-medium text-foreground">selected</span>
        <Button variant="ghost" size="sm" onClick={onClear} disabled={busy}>
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
        {extra}
        {canExport && (
          <>
            <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
            <Button variant="outline" size="sm" onClick={onPrint} disabled={busy}>
              <Printer className="h-3.5 w-3.5" />
              Bulk Print
            </Button>
            <Button variant="outline" size="sm" onClick={onPdf} disabled={busy}>
              <FileDown className="h-3.5 w-3.5" />
              Bulk PDF
            </Button>
            <Button variant="outline" size="sm" onClick={onCsv} disabled={busy}>
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Bulk CSV
            </Button>
          </>
        )}
      </div>
    </div>
  );
}