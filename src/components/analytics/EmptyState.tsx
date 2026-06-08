import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, className }: EmptyStateProps) {
  return (
    <div
      className={
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/40 px-6 py-12 text-center " +
        (className ?? "")
      }
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-brand-gradient-soft text-brand">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-sm font-medium text-foreground">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}