import { Building2 } from "lucide-react";

import { useBranding } from "@/lib/branding-context";
import { cn } from "@/lib/utils";

interface CompanyLogoProps {
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
}

const SIZES = {
  sm: "h-7 w-7",
  md: "h-9 w-9",
  lg: "h-12 w-12",
};

export function CompanyLogo({ size = "md", showName = true, className }: CompanyLogoProps) {
  const { company, logoUrl } = useBranding();
  const name = company?.name?.trim() || "Your Company";

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className={cn(
          "flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary/10 text-primary",
          SIZES[size],
        )}
      >
        {logoUrl ? (
          <img src={logoUrl} alt={name} className="h-full w-full object-contain p-0.5" />
        ) : (
          <Building2 className="h-1/2 w-1/2" />
        )}
      </div>
      {showName && (
        <span className="truncate text-sm font-semibold tracking-tight text-foreground">
          {name}
        </span>
      )}
    </div>
  );
}