import { useBranding } from "@/lib/branding-context";
import { APP_NAME } from "@/lib/modules";
import { BrandMark } from "@/components/BrandMark";

/**
 * Official Motion IT BD company letterhead for reports / print / PDF.
 * Pulls every field live from the Company Profile — no hardcoded company
 * information — so updating the profile updates every report automatically.
 */
export function ReportLetterhead() {
  const { company, logoUrl } = useBranding();
  const name = company?.name?.trim() || APP_NAME;

  const contactLine = [
    company?.mobile && `Phone: ${company.mobile}`,
    company?.email && `Email: ${company.email}`,
    company?.website && `Web: ${company.website}`,
  ].filter(Boolean) as string[];

  const socialLine = [
    company?.facebook && `Facebook: ${company.facebook}`,
    company?.whatsapp && `WhatsApp: ${company.whatsapp}`,
  ].filter(Boolean) as string[];

  const legalLine = [
    company?.trade_license && `Trade License: ${company.trade_license}`,
    company?.bin_number && `BIN: ${company.bin_number}`,
    company?.tin_number && `TIN: ${company.tin_number}`,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg">
          {logoUrl ? (
            <img src={logoUrl} alt={name} className="max-h-full max-w-full object-contain" />
          ) : (
            <BrandMark className="h-full w-full" title={name} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold tracking-tight text-foreground">{name}</p>
          {company?.address && (
            <p className="text-xs text-muted-foreground">{company.address}</p>
          )}
          {contactLine.length > 0 && (
            <p className="text-xs text-muted-foreground">{contactLine.join("  ·  ")}</p>
          )}
          {socialLine.length > 0 && (
            <p className="text-xs text-muted-foreground">{socialLine.join("  ·  ")}</p>
          )}
          {legalLine.length > 0 && (
            <p className="text-[11px] text-muted-foreground">{legalLine.join("  ·  ")}</p>
          )}
        </div>
      </div>
      <hr className="brand-rule" />
    </div>
  );
}
