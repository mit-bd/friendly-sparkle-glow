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

/** Prepared / Reviewed / Approved signature footer pulled from Signatories. */
export function ReportFooter() {
  const { data: signatories } = useSignatories();
  const byType = new Map((signatories ?? []).map((s) => [s.type, s]));

  return (
    <div className="report-footer mt-10 grid grid-cols-3 gap-8 pt-4">
      {SIGNATORY_ORDER.map((type) => (
        <SignatureBlock key={type} type={type} row={byType.get(type)} />
      ))}
    </div>
  );
}
