import { ReportDocument } from "@/components/reports/ReportDocument";
import type { BulkExportConfig } from "@/lib/bulk-export";

interface BulkPrintDocumentProps<T> {
  config: BulkExportConfig<T>;
  rows: T[];
  reportNumber: string;
  generatedAt: string;
  generatedBy: string;
  scopeLabel: string;
}

/**
 * Combined, print-only document for a bulk operation:
 *  - Company letterhead appears ONCE at the top (via ReportDocument).
 *  - Each selected record renders as its own section with automatic page
 *    breaks (break-inside-avoid keeps a record whole across pages).
 *  - The signatory footer + combined report number render once at the end.
 *
 * Wrapped in `.print-only` so it is invisible on screen and revealed only by
 * the print stylesheet (`.report-print-area` isolation in styles.css).
 */
export function BulkPrintDocument<T>({
  config,
  rows,
  reportNumber,
  generatedAt,
  generatedBy,
  scopeLabel,
}: BulkPrintDocumentProps<T>) {
  return (
    <div className="print-only">
      <ReportDocument
        reportName={config.documentTitle}
        reportNumber={reportNumber}
        generatedAt={generatedAt}
        generatedBy={generatedBy}
        dateRangeLabel={`${scopeLabel} · ${rows.length} record${rows.length === 1 ? "" : "s"}`}
      >
        <div className="space-y-4">
          {rows.map((row, i) => (
            <section
              key={i}
              className="report-block break-inside-avoid rounded-md border border-border p-4"
            >
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h3 className="text-sm font-semibold text-foreground">
                  {config.recordLabel(row)}
                </h3>
                <span className="text-[11px] text-muted-foreground">
                  {config.moduleLabel} · {i + 1} of {rows.length}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {config.fields.map((f) => (
                  <div key={f.label} className="flex flex-col">
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {f.label}
                    </dt>
                    <dd className="text-foreground">{f.value(row) || "—"}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </ReportDocument>
    </div>
  );
}