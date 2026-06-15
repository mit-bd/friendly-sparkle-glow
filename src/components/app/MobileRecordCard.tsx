import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export interface MobileDetail {
  label: string;
  value: React.ReactNode;
}

/**
 * Touch-friendly record card used as the mobile (below md) replacement for
 * desktop data tables. Renders a compact summary row with an optional
 * expandable "Details" section so dense tables stay readable on small
 * screens without horizontal scrolling. Desktop layouts are untouched —
 * callers gate this behind `md:hidden` and keep their `hidden md:block` table.
 */
export function MobileRecordCard({
  title,
  trailing,
  subtitle,
  footer,
  details,
  leading,
  onClick,
}: {
  title: React.ReactNode;
  trailing?: React.ReactNode;
  subtitle?: React.ReactNode;
  footer?: React.ReactNode;
  details?: MobileDetail[];
  leading?: React.ReactNode;
  onClick?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hasDetails = !!details && details.length > 0;

  return (
    <Card className={cn("transition-colors", onClick && "active:bg-accent")}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {leading}
          <div
            className={cn("min-w-0 flex-1", onClick && "cursor-pointer")}
            onClick={onClick}
            role={onClick ? "button" : undefined}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1 truncate font-semibold">{title}</div>
              {trailing != null && (
                <div className="shrink-0 text-base font-bold tabular-nums">{trailing}</div>
              )}
            </div>
            {subtitle != null && (
              <div className="mt-0.5 truncate text-sm text-muted-foreground">{subtitle}</div>
            )}
            {footer != null && (
              <div className="mt-2 flex items-center justify-between gap-2">{footer}</div>
            )}
          </div>
        </div>

        {hasDetails && (
          <>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="mt-3 flex min-h-[36px] w-full items-center justify-center gap-1 rounded-md text-xs font-medium text-muted-foreground transition-colors hover:text-foreground active:bg-accent"
            >
              {open ? "Hide details" : "Details"}
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
            </button>
            {open && (
              <dl className="mt-1 space-y-1.5 border-t border-border pt-3">
                {details!.map((d, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 text-sm">
                    <dt className="shrink-0 text-muted-foreground">{d.label}</dt>
                    <dd className="min-w-0 text-right font-medium">{d.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
