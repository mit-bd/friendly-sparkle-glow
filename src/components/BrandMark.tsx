import markUrl from "@/assets/brand/motion-it-bd-mark.png";
import logoUrl from "@/assets/brand/motion-it-bd-logo.png";
import { cn } from "@/lib/utils";

/** CDN-stable URLs for the official Motion IT BD artwork. */
export const MOTION_IT_BD_MARK = markUrl;
export const MOTION_IT_BD_LOGO = logoUrl;

interface BrandMarkProps {
  className?: string;
  title?: string;
  /**
   * "mark" = the gradient glyph only (default, pairs with adjacent text).
   * "full" = glyph + "motion it bd" wordmark (use on light surfaces).
   */
  variant?: "mark" | "full";
}

/**
 * Official Motion IT BD brand mark.
 *
 * Renders the real uploaded logo artwork. It is the default/fallback logo
 * shown wherever a company has not uploaded custom branding. Uses
 * object-contain so it always resizes crisply and preserves aspect ratio
 * across desktop, tablet, mobile, print, and PDF exports.
 */
export function BrandMark({ className, title = "Motion IT BD", variant = "mark" }: BrandMarkProps) {
  return (
    <img
      src={variant === "full" ? logoUrl : markUrl}
      alt={title}
      className={cn("h-full w-full select-none object-contain", className)}
      draggable={false}
    />
  );
}