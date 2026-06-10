import type { ReactNode } from "react";
import { Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CheckCircle2,
  Receipt,
  FileBarChart,
  Undo2,
  PackageX,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/analytics/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency, formatDate, formatDateTime, type ExpenseStatus } from "@/lib/expenses";
import { ACTIVITY_ACTION_LABELS, ACTIVITY_ENTITY_LABELS, ACTIVITY_TONE } from "@/lib/audit";
import {
  fetchRecentActivity,
  fetchRecentApprovals,
  fetchRecentDamages,
  fetchRecentExpenses,
  fetchRecentReports,
  fetchRecentReturns,
} from "@/lib/dashboard";
import { cn } from "@/lib/utils";

function PanelShell({
  icon: Icon,
  title,
  to,
  children,
}: {
  icon: LucideIcon;
  title: string;
  to?: string;
  children: ReactNode;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-brand" />
          {title}
        </CardTitle>
        {to && (
          <Link
            to={to}
            className="flex items-center text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            View all <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </CardHeader>
      <CardContent className="flex-1">{children}</CardContent>
    </Card>
  );
}

function Loading() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

function RecentActivityPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "recent-activity"],
    queryFn: fetchRecentActivity,
    staleTime: 30_000,
  });
  return (
    <PanelShell icon={Activity} title="Recent Activity" to="/audit">
      {isLoading ? (
        <Loading />
      ) : (data ?? []).length === 0 ? (
        <EmptyState icon={Activity} title="No activity yet." />
      ) : (
        <ul className="divide-y divide-border">
          {data!.map((a) => (
            <li key={a.id} className="flex items-center gap-2 py-2 first:pt-0 last:pb-0">
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-medium",
                  ACTIVITY_TONE[a.action] ?? "bg-muted text-muted-foreground",
                )}
              >
                {ACTIVITY_ACTION_LABELS[a.action] ?? a.action}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {ACTIVITY_ENTITY_LABELS[a.entity_type] ?? a.entity_type}
                {a.entity_label ? ` · ${a.entity_label}` : ""}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatDateTime(a.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

function RecentApprovalsPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "recent-approvals"],
    queryFn: fetchRecentApprovals,
    staleTime: 30_000,
  });
  return (
    <PanelShell icon={CheckCircle2} title="Recent Approvals" to="/expenses">
      {isLoading ? (
        <Loading />
      ) : (data ?? []).length === 0 ? (
        <EmptyState icon={CheckCircle2} title="No approvals yet." />
      ) : (
        <ul className="divide-y divide-border">
          {data!.map((e) => (
            <li key={e.id}>
              <Link
                to="/expenses/$id"
                params={{ id: e.id }}
                className="flex items-center gap-2 py-2 first:pt-0 last:pb-0 hover:opacity-80"
              >
                <span className="font-medium text-foreground">{e.expense_number}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                  {e.description || "—"}
                </span>
                <span className="shrink-0 text-sm font-medium tabular-nums">
                  ৳{formatCurrency(e.amount)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

function RecentExpensesPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "recent-expenses"],
    queryFn: fetchRecentExpenses,
    staleTime: 30_000,
  });
  return (
    <PanelShell icon={Receipt} title="Recently Added Expenses" to="/expenses">
      {isLoading ? (
        <Loading />
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No expenses yet."
          description="Add your first expense to get started."
        />
      ) : (
        <ul className="divide-y divide-border">
          {data!.map((e) => (
            <li key={e.id}>
              <Link
                to="/expenses/$id"
                params={{ id: e.id }}
                className="flex items-center gap-2 py-2 first:pt-0 last:pb-0 hover:opacity-80"
              >
                <span className="font-medium text-foreground">{e.expense_number}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                  {e.description || "—"}
                </span>
                <StatusBadge status={e.status as ExpenseStatus} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

function RecentReportsPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "recent-reports"],
    queryFn: fetchRecentReports,
    staleTime: 30_000,
  });
  return (
    <PanelShell icon={FileBarChart} title="Recent Reports" to="/reports/export-history">
      {isLoading ? (
        <Loading />
      ) : (data ?? []).length === 0 ? (
        <EmptyState icon={FileBarChart} title="No reports found." />
      ) : (
        <ul className="divide-y divide-border">
          {data!.map((r) => (
            <li key={r.id}>
              <Link
                to="/reports/export-history"
                className="flex items-center gap-2 py-2 first:pt-0 last:pb-0 hover:opacity-80"
              >
                <span className="font-medium text-foreground">{r.report_number}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                  {r.title}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(r.created_at)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

function RecentReturnsPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "recent-returns"],
    queryFn: fetchRecentReturns,
    staleTime: 30_000,
  });
  return (
    <PanelShell icon={Undo2} title="Recent Returns" to="/returns">
      {isLoading ? (
        <Loading />
      ) : (data ?? []).length === 0 ? (
        <EmptyState icon={Undo2} title="No returns available." />
      ) : (
        <ul className="divide-y divide-border">
          {data!.map((r) => (
            <li key={r.id}>
              <Link
                to="/returns/$id"
                params={{ id: r.id }}
                className="flex items-center gap-2 py-2 first:pt-0 last:pb-0 hover:opacity-80"
              >
                <span className="font-medium text-foreground">{r.return_number}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                  {r.product_name}
                </span>
                <StatusBadge status={r.status as ExpenseStatus} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

function RecentDamagesPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "recent-damages"],
    queryFn: fetchRecentDamages,
    staleTime: 30_000,
  });
  return (
    <PanelShell icon={PackageX} title="Recent Damages" to="/damages">
      {isLoading ? (
        <Loading />
      ) : (data ?? []).length === 0 ? (
        <EmptyState icon={PackageX} title="No damages recorded." />
      ) : (
        <ul className="divide-y divide-border">
          {data!.map((d) => (
            <li key={d.id}>
              <Link
                to="/damages/$id"
                params={{ id: d.id }}
                className="flex items-center gap-2 py-2 first:pt-0 last:pb-0 hover:opacity-80"
              >
                <span className="font-medium text-foreground">{d.damage_number}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                  {d.product_name}
                </span>
                <StatusBadge status={d.status as ExpenseStatus} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

export function RecentPanels() {
  const { canAccessModule } = useAuth();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <RecentExpensesPanel />
      <RecentApprovalsPanel />
      {canAccessModule("returns") && <RecentReturnsPanel />}
      {canAccessModule("damages") && <RecentDamagesPanel />}
      {canAccessModule("reports") && <RecentReportsPanel />}
      {canAccessModule("audit") && <RecentActivityPanel />}
    </div>
  );
}
