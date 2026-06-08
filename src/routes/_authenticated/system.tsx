import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Database,
  HardDrive,
  Bell,
  FileBarChart,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Loader2,
  type LucideIcon,
} from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/system")({
  head: () => ({ meta: [{ title: "System Health — Motion IT BD" }] }),
  component: SystemHealthPage,
});

type Health = "ok" | "warn" | "down";

interface Check {
  key: string;
  label: string;
  icon: LucideIcon;
  status: Health;
  detail: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

async function runChecks(): Promise<Check[]> {
  const checks: Check[] = [];

  // Database
  try {
    const { error } = await db.from("expense_counters").select("year").limit(1);
    checks.push({
      key: "database",
      label: "Database",
      icon: Database,
      status: error ? "down" : "ok",
      detail: error ? "Unable to reach the database." : "Connected and responding.",
    });
  } catch {
    checks.push({ key: "database", label: "Database", icon: Database, status: "down", detail: "Connection failed." });
  }

  // Storage
  try {
    const { error } = await supabase.storage.from("expense-attachments").list("", { limit: 1 });
    checks.push({
      key: "storage",
      label: "Storage",
      icon: HardDrive,
      status: error ? "warn" : "ok",
      detail: error ? "Storage reachable with limited access." : "Buckets reachable and healthy.",
    });
  } catch {
    checks.push({ key: "storage", label: "Storage", icon: HardDrive, status: "down", detail: "Storage unreachable." });
  }

  // Notifications
  try {
    const { data, error } = await db
      .from("notification_settings")
      .select("channel, enabled")
      .eq("channel", "in_app")
      .maybeSingle();
    const enabled = data?.enabled === true;
    checks.push({
      key: "notifications",
      label: "Notifications",
      icon: Bell,
      status: error ? "down" : enabled ? "ok" : "warn",
      detail: error
        ? "Notification settings unavailable."
        : enabled
          ? "In-app notifications are active."
          : "In-app notifications are currently disabled.",
    });
  } catch {
    checks.push({ key: "notifications", label: "Notifications", icon: Bell, status: "down", detail: "Notification service error." });
  }

  // Report engine
  try {
    const { error } = await db.from("report_counters").select("year").limit(1);
    checks.push({
      key: "reports",
      label: "Report Engine",
      icon: FileBarChart,
      status: error ? "down" : "ok",
      detail: error ? "Report engine unavailable." : "Report numbering and exports operational.",
    });
  } catch {
    checks.push({ key: "reports", label: "Report Engine", icon: FileBarChart, status: "down", detail: "Report engine error." });
  }

  // Authentication
  try {
    const { data } = await supabase.auth.getSession();
    checks.push({
      key: "auth",
      label: "Authentication",
      icon: ShieldCheck,
      status: data.session ? "ok" : "warn",
      detail: data.session ? "Active session validated." : "No active session detected.",
    });
  } catch {
    checks.push({ key: "auth", label: "Authentication", icon: ShieldCheck, status: "down", detail: "Auth service error." });
  }

  return checks;
}

const HEALTH_META: Record<Health, { label: string; badge: string; icon: LucideIcon; tone: string }> = {
  ok: { label: "Operational", badge: "bg-chart-2/15 text-chart-2", icon: CheckCircle2, tone: "text-chart-2" },
  warn: { label: "Degraded", badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400", icon: AlertTriangle, tone: "text-amber-600 dark:text-amber-400" },
  down: { label: "Down", badge: "bg-destructive/15 text-destructive", icon: XCircle, tone: "text-destructive" },
};

function SystemHealthPage() {
  const { isAdmin } = useAuth();

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["system-health"],
    queryFn: runChecks,
    enabled: isAdmin,
    staleTime: 20_000,
  });

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader title="System Health" description="Admin-only system status." />
        <NoAccess />
      </div>
    );
  }

  const checks = data ?? [];
  const overall: Health = checks.some((c) => c.status === "down")
    ? "down"
    : checks.some((c) => c.status === "warn")
      ? "warn"
      : "ok";
  const OverallIcon = HEALTH_META[overall].icon;

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Health"
        description="Live status of core platform services."
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : (
        <>
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <span className={cn("flex h-10 w-10 items-center justify-center rounded-md", HEALTH_META[overall].badge)}>
                <OverallIcon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Overall status: {HEALTH_META[overall].label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {checks.filter((c) => c.status === "ok").length} of {checks.length} services operational.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {checks.map((c) => {
              const meta = HEALTH_META[c.status];
              return (
                <Card key={c.key}>
                  <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <c.icon className="h-4 w-4 text-brand" />
                      {c.label}
                    </CardTitle>
                    <Badge variant="outline" className={cn(meta.badge, "text-xs font-medium")}>
                      {meta.label}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{c.detail}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
