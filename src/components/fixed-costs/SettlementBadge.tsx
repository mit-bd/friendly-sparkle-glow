import { Badge } from "@/components/ui/badge";
import { SETTLEMENT_STATUS, settlementOf, type SettlementStatus } from "@/lib/fixed-costs";
import { cn } from "@/lib/utils";

export function SettlementBadge({
  status,
  className,
}: {
  status: SettlementStatus | null;
  className?: string;
}) {
  const meta = SETTLEMENT_STATUS[settlementOf({ fc_settlement_status: status })];
  return (
    <Badge variant="outline" className={cn(meta.badge, "font-medium", className)}>
      {meta.label}
    </Badge>
  );
}