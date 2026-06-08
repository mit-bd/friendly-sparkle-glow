import { useId } from "react";

import { cn } from "@/lib/utils";

interface BrandMarkProps {
  /** Pixel size of the square mark. */
  className?: string;
  title?: string;
}

/**
 * Motion IT BD default brand mark — a scalable, gradient "M" motion glyph.
 *
 * Used as the fallback logo whenever a company has not uploaded custom
 * artwork. Because it is pure SVG it resizes crisply at any dimension and
 * always inherits the live brand gradient tokens.
 */
export function BrandMark({ className, title = "Motion IT BD" }: BrandMarkProps) {
  const id = useId();
  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label={title}
      className={cn("h-full w-full", className)}
    >
      <defs>
        <linearGradient id={`brand-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--brand-from)" />
          <stop offset="100%" stopColor="var(--brand-to)" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="100" rx="22" fill={`url(#brand-${id})`} />
      {/* Motion speed lines */}
      <g stroke="white" strokeWidth="6" strokeLinecap="round" opacity="0.85">
        <line x1="14" y1="40" x2="26" y2="40" />
        <line x1="14" y1="58" x2="22" y2="58" />
      </g>
      {/* Forward-leaning "M" */}
      <path
        d="M34 74 V30 L52 58 L70 30 V74"
        fill="none"
        stroke="white"
        strokeWidth="8.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}