import { cn } from "@/lib/utils";

/**
 * Sticky, horizontally-scrollable quick-filter chip rail for mobile. Sits
 * just below the page header on small screens (md:hidden) so the most common
 * filters stay within thumb reach without opening the full filter sheet.
 */
export function FilterChips({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "hide-scrollbar sticky top-16 z-20 -mx-4 flex gap-2 overflow-x-auto bg-background/85 px-4 py-2 backdrop-blur md:hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-[36px] shrink-0 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition-colors",
        active
          ? "border-transparent bg-brand-gradient text-brand-foreground"
          : "border-border bg-card text-muted-foreground active:bg-accent",
      )}
    >
      {children}
    </button>
  );
}
