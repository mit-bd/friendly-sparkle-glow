import { Badge } from "@/components/ui/badge";
import { EXPENSE_STATUS, type ExpenseStatus } from "@/lib/expenses";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, className }: { status: ExpenseStatus; className?: string }) {
  const meta = EXPENSE_STATUS[status];
  return (
    <Badge variant="outline" className={cn(meta.badge, "font-medium", className)}>
      {meta.label}
    </Badge>
  );
}