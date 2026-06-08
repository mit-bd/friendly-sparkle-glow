import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/modules";
import { cn } from "@/lib/utils";

const ROLE_STYLES: Record<string, string> = {
  admin: "border-transparent bg-primary/10 text-primary",
  manager: "border-transparent bg-chart-2/15 text-chart-2",
  accountant: "border-transparent bg-chart-4/20 text-foreground",
  viewer: "border-transparent bg-muted text-muted-foreground",
};

export function RoleBadge({ role }: { role: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", ROLE_STYLES[role])}>
      {ROLE_LABELS[role] ?? role}
    </Badge>
  );
}