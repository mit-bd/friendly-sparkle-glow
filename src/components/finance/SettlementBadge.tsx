import { Badge } from "@/components/ui/badge";
import {
  PAYABLE_STATUS,
  RECEIVABLE_STATUS,
  type FinanceKind,
  type PayableStatus,
  type ReceivableStatus,
} from "@/lib/finance";
import { cn } from "@/lib/utils";

export function SettlementBadge({ kind, status, className }: { kind: FinanceKind; status: string; className?: string }) {
  const meta =
    kind === "receivable"
      ? RECEIVABLE_STATUS[status as ReceivableStatus]
      : PAYABLE_STATUS[status as PayableStatus];
  if (!meta) return null;
  return (
    <Badge variant="outline" className={cn(meta.badge, "font-medium", className)}>
      {meta.label}
    </Badge>
  );
}