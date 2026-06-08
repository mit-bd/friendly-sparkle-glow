import { useBranding } from "@/lib/branding-context";
import { APP_NAME, APP_TAGLINE } from "@/lib/modules";
import { BrandMark } from "@/components/BrandMark";
import { cn } from "@/lib/utils";

interface CompanyLogoProps {
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  showTagline?: boolean;
  className?: string;
}

const SIZES = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-14 w-14",
};

export function CompanyLogo({
  size = "md",
  showName = true,
  showTagline = false,
  className,
}: CompanyLogoProps) {
  const { company, logoUrl } = useBranding();
  const name = company?.name?.trim() || APP_NAME;

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className={cn(
          "flex shrink-0 items-center justify-center overflow-hidden rounded-lg",
          logoUrl ? "bg-muted shadow-sm" : "",
          SIZES[size],
        )}
      >
        {logoUrl ? (
          // Responsive logo: contained within the tile, aspect ratio preserved.
          <img
            src={logoUrl}
            alt={name}
            className="max-h-full max-w-full object-contain p-1"
          />
        ) : (
          <BrandMark className="h-full w-full" title={name} />
        )}
      </div>
      {showName && (
        <div className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-semibold tracking-tight text-foreground">
            {name}
          </span>
          {showTagline && (
            <span className="block truncate text-xs text-muted-foreground">{APP_TAGLINE}</span>
          )}
        </div>
      )}
    </div>
  );
}