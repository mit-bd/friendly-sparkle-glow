import { cn } from "@/lib/utils";
import { BUDGET_STATUS_META, type BudgetStatus } from "@/lib/budgets";

/** Theme-safe budget status badge (Safe / Warning / Critical / Exceeded). */
export function BudgetStatusBadge({ status, className }: { status: BudgetStatus; className?: string }) {
  const meta = BUDGET_STATUS_META[status];
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", meta.badge, className)}>
      {meta.label}
    </span>
  );
}

/** Utilisation bar coloured by status. */
export function BudgetUtilizationBar({ utilization, status, className }: { utilization: number; status: BudgetStatus; className?: string }) {
  const meta = BUDGET_STATUS_META[status];
  const width = Math.min(Math.max(utilization, 0), 100);
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className={cn("h-full rounded-full transition-all", meta.bar)} style={{ width: `${width}%` }} />
    </div>
  );
}
