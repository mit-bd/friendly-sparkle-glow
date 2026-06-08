import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Receipt,
  Clock,
  Wallet,
  Users,
  ArrowUpRight,
  Building2,
  PenLine,
  ShieldCheck,
} from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { ROLE_LABELS } from "@/lib/modules";
import { formatCurrency } from "@/lib/expenses";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Dashboard — Motion IT BD" }] }),
  component: Dashboard,
});

const SETUP_STEPS = [
  { label: "Complete the company profile", to: "/settings/company", icon: Building2 },
  { label: "Add authorized signatories", to: "/settings/signatories", icon: PenLine },
  { label: "Review roles & permissions", to: "/settings/permissions", icon: ShieldCheck },
  { label: "Invite your team", to: "/users", icon: Users },
];

interface Stats {
  approvedTotal: number;
  pendingCount: number;
  monthSpend: number;
  activeUsers: number;
}

const PENDING_STATUSES = ["submitted", "pending_approval", "revision_requested"];

function Dashboard() {
  const { profile, primaryRole, isAdmin } = useAuth();
  const firstName = profile?.full_name?.split(" ")[0] || "there";
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let active = true;
    async function loadStats() {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .slice(0, 10);

      // Only APPROVED expenses count toward financial totals.
      const [{ data: approved }, { count: pending }, { data: monthRows }, { count: users }] =
        await Promise.all([
          supabase.from("expenses").select("amount").eq("status", "approved"),
          supabase
            .from("expenses")
            .select("id", { count: "exact", head: true })
            .in("status", PENDING_STATUSES as never),
          supabase
            .from("expenses")
            .select("amount")
            .eq("status", "approved")
            .gte("expense_date", monthStart),
          supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("status", "active"),
        ]);

      if (!active) return;
      const sum = (rows: { amount: number }[] | null) =>
        (rows ?? []).reduce((acc, r) => acc + Number(r.amount || 0), 0);
      setStats({
        approvedTotal: sum(approved as { amount: number }[]),
        pendingCount: pending ?? 0,
        monthSpend: sum(monthRows as { amount: number }[]),
        activeUsers: users ?? 0,
      });
    }
    loadStats().catch(() => active && setStats({ approvedTotal: 0, pendingCount: 0, monthSpend: 0, activeUsers: 0 }));
    return () => {
      active = false;
    };
  }, []);

  const cards = [
    {
      label: "Approved Expenses",
      value: stats ? formatCurrency(stats.approvedTotal) : null,
      hint: "Official company expenses",
      icon: Receipt,
    },
    {
      label: "Pending Approvals",
      value: stats ? String(stats.pendingCount) : null,
      hint: "Awaiting review",
      icon: Clock,
    },
    {
      label: "Spend This Month",
      value: stats ? formatCurrency(stats.monthSpend) : null,
      hint: "Approved, current period",
      icon: Wallet,
    },
    {
      label: "Active Users",
      value: stats ? String(stats.activeUsers) : null,
      hint: "Across all roles",
      icon: Users,
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description={
          primaryRole
            ? `You are signed in as ${ROLE_LABELS[primaryRole]}. Here's your workspace overview.`
            : "Here's your workspace overview."
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((s) => (
          <Card key={s.label} className="relative overflow-hidden">
            <span className="absolute inset-x-0 top-0 h-1 bg-brand-gradient" aria-hidden />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {s.label}
              </CardTitle>
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-gradient-soft text-brand">
                <s.icon className="h-4 w-4" />
              </span>
            </CardHeader>
            <CardContent>
              {s.value === null ? (
                <Skeleton className="h-9 w-24" />
              ) : (
                <div className="text-3xl font-semibold tracking-tight tabular-nums">{s.value}</div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Expense activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-64 items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
              Charts appear here once the Expenses module is active.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {isAdmin ? "Setup checklist" : "Quick links"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {SETUP_STEPS.map((step) => (
              <Link
                key={step.to}
                to={step.to}
                className="group flex items-center gap-3 rounded-md px-2 py-2.5 text-sm transition-colors hover:bg-accent"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <step.icon className="h-4 w-4" />
                </span>
                <span className="flex-1 font-medium">{step.label}</span>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}