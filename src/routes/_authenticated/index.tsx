import { createFileRoute, Link } from "@tanstack/react-router";
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
import { useAuth } from "@/lib/auth-context";
import { ROLE_LABELS } from "@/lib/modules";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Dashboard — Expense Management System" }] }),
  component: Dashboard,
});

const STATS = [
  { label: "Total Expenses", value: "—", hint: "All recorded expenses", icon: Receipt },
  { label: "Pending Approvals", value: "—", hint: "Awaiting review", icon: Clock },
  { label: "Spend This Month", value: "—", hint: "Current period", icon: Wallet },
  { label: "Active Users", value: "—", hint: "Across all roles", icon: Users },
];

const SETUP_STEPS = [
  { label: "Complete the company profile", to: "/settings/company", icon: Building2 },
  { label: "Add authorized signatories", to: "/settings/signatories", icon: PenLine },
  { label: "Review roles & permissions", to: "/settings/permissions", icon: ShieldCheck },
  { label: "Invite your team", to: "/users", icon: Users },
];

function Dashboard() {
  const { profile, primaryRole, isAdmin } = useAuth();
  const firstName = profile?.full_name?.split(" ")[0] || "there";

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
        {STATS.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {s.label}
              </CardTitle>
              <s.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tracking-tight">{s.value}</div>
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