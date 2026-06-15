import { useRef, useState } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export interface MobileDetail {
  label: string;
  value: React.ReactNode;
}

export interface SwipeAction {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  tone?: "default" | "success" | "destructive" | "brand";
}

const ACTION_W = 76; // px width of each revealed swipe action

const TONE_CLASS: Record<NonNullable<SwipeAction["tone"]>, string> = {
  default: "bg-muted text-foreground",
  success: "bg-success text-success-foreground",
  destructive: "bg-destructive text-destructive-foreground",
  brand: "bg-brand-gradient text-brand-foreground",
};

/**
 * Touch-friendly record card used as the mobile (below md) replacement for
 * desktop data tables. Renders a compact summary row with an optional
 * expandable "Details" section so dense tables stay readable on small
 * screens without horizontal scrolling. Optionally supports swipe-to-reveal
 * quick actions (left swipe) for one-handed use. Desktop layouts are
 * untouched — callers gate this behind `md:hidden` and keep their
 * `hidden md:block` table.
 */
export function MobileRecordCard({
  title,
  trailing,
  subtitle,
  footer,
  details,
  leading,
  onClick,
  swipeActions,
}: {
  title: React.ReactNode;
  trailing?: React.ReactNode;
  subtitle?: React.ReactNode;
  footer?: React.ReactNode;
  details?: MobileDetail[];
  leading?: React.ReactNode;
  onClick?: () => void;
  swipeActions?: SwipeAction[];
}) {
  const [open, setOpen] = useState(false);
  const hasDetails = !!details && details.length > 0;

  // ---- swipe-to-reveal state ------------------------------------------------
  const actions = swipeActions ?? [];
  const revealWidth = actions.length * ACTION_W;
  const [offset, setOffset] = useState(0);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startOffset = useRef(0);
  const moved = useRef(false);

  const onTouchStart = (e: React.TouchEvent) => {
    if (actions.length === 0) return;
    dragging.current = true;
    moved.current = false;
    startX.current = e.touches[0].clientX;
    startOffset.current = offset;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current) return;
    const delta = e.touches[0].clientX - startX.current;
    if (Math.abs(delta) > 6) moved.current = true;
    const next = Math.min(0, Math.max(-revealWidth, startOffset.current + delta));
    setOffset(next);
  };
  const onTouchEnd = () => {
    if (!dragging.current) return;
    dragging.current = false;
    setOffset((o) => (o < -revealWidth / 2 ? -revealWidth : 0));
  };

  const card = (
    <Card className={cn("transition-colors", onClick && "active:bg-accent")}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {leading}
          <div
            className={cn("min-w-0 flex-1", onClick && "cursor-pointer")}
            onClick={() => {
              if (moved.current) return;
              onClick?.();
            }}
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

  if (actions.length === 0) return card;

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Revealed actions sit behind the card. */}
      <div className="absolute inset-y-0 right-0 flex">
        {actions.map((a, i) => (
          <button
            key={i}
            type="button"
            style={{ width: ACTION_W }}
            onClick={() => {
              a.onClick();
              setOffset(0);
            }}
            className={cn(
              "flex flex-col items-center justify-center gap-1 text-xs font-medium",
              TONE_CLASS[a.tone ?? "default"],
            )}
          >
            <a.icon className="h-5 w-5" />
            {a.label}
          </button>
        ))}
      </div>
      <div
        style={{ transform: `translateX(${offset}px)` }}
        className={cn(!dragging.current && "transition-transform duration-200")}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {card}
      </div>
    </div>
  );
}
