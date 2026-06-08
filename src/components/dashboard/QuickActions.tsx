import { Link } from "@tanstack/react-router";
import {
  Plus,
  Megaphone,
  Undo2,
  PackageX,
  FileBarChart,
  ClipboardCheck,
  History,
  type LucideIcon,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import type { ModuleKey } from "@/lib/modules";

interface QuickAction {
  label: string;
  to: string;
  icon: LucideIcon;
  module: ModuleKey;
}

const ACTIONS: QuickAction[] = [
  { label: "Add Expense", to: "/expenses/add", icon: Plus, module: "expenses" },
  { label: "Add Marketing Cost", to: "/marketing/add", icon: Megaphone, module: "marketing" },
  { label: "Add Return", to: "/returns/add", icon: Undo2, module: "returns" },
  { label: "Add Damage", to: "/damages/add", icon: PackageX, module: "damages" },
  { label: "Generate Report", to: "/reports/summary", icon: FileBarChart, module: "reports" },
  { label: "Pending Approvals", to: "/expenses/pending", icon: ClipboardCheck, module: "expenses" },
  { label: "Activity Logs", to: "/audit", icon: History, module: "audit" },
];

export function QuickActions() {
  const { canAccessModule } = useAuth();
  const visible = ACTIONS.filter((a) => canAccessModule(a.module));
  if (visible.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {visible.map((a) => (
            <Link
              key={a.label}
              to={a.to}
              className="group flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-3 text-center transition-colors hover:border-brand/40 hover:bg-accent"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-gradient text-brand-foreground shadow-sm transition-transform group-hover:scale-105">
                <a.icon className="h-5 w-5" />
              </span>
              <span className="text-xs font-medium leading-tight text-foreground">{a.label}</span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
