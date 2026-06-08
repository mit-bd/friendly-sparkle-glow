import { SignedImage } from "@/components/SignedImage";
import {
  SIGNATORY_ORDER,
  SIGNATORY_ROLE_LABEL,
  useSignatories,
  type Signatory,
  type SignatoryType,
} from "@/hooks/use-signatories";

function SignatureBlock({ type, row }: { type: SignatoryType; row?: Signatory }) {
  return (
    <div className="flex flex-col">
      <div className="flex h-14 items-end justify-center">
        {row?.signature_url ? (
          <SignedImage
            bucket="signatures"
            path={row.signature_url}
            alt={`${row.full_name} signature`}
            className="max-h-14 max-w-[180px]"
          />
        ) : null}
      </div>
      <div className="border-t border-foreground/70 pt-1.5 text-center">
        <p className="text-xs font-semibold text-foreground">{row?.full_name || "—"}</p>
        <p className="text-[11px] text-muted-foreground">{row?.designation || ""}</p>
        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {SIGNATORY_ROLE_LABEL[type]}
        </p>
      </div>
    </div>
  );
}

interface ReportFooterProps {
  /** Report number echoed at the bottom of every printed page. */
  reportNumber?: string;
  /** Date the document was generated / printed. Defaults to now. */
  printDate?: string;
}

/**
 * Prepared / Reviewed / Approved signature footer pulled from Signatories,
 * plus a closing meta line carrying the Report Number and Print Date so every
 * printed/exported document is fully traceable.
 */
export function ReportFooter({ reportNumber, printDate }: ReportFooterProps = {}) {
  const { data: signatories } = useSignatories();
  const byType = new Map((signatories ?? []).map((s) => [s.type, s]));
  const printedOn =
    printDate ||
    new Date().toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="report-footer mt-10 pt-4">
      <div className="grid grid-cols-3 gap-8">
        {SIGNATORY_ORDER.map((type) => (
          <SignatureBlock key={type} type={type} row={byType.get(type)} />
        ))}
      </div>
      <div className="report-footer-meta mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-[10px] text-muted-foreground">
        <span>{reportNumber ? `Report No: ${reportNumber}` : ""}</span>
        <span>Print Date: {printedOn}</span>
      </div>
    </div>
  );
}
