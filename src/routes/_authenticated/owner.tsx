import { createFileRoute, Link } from "@/lib/router";
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Users,
  UserCheck,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  CircleSlash,
  Activity,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import {
  fetchOwnerStats,
  fetchRegistrationRequests,
  fetchLoginHistory,
  fetchSecurityEvents,
  REGISTRATION_STATUS_LABELS,
  type OwnerStats,
  type RegistrationRequest,
  type LoginHistoryRow,
  type SecurityEventRow,
} from "@/lib/owner";

export const Route = createFileRoute("/_authenticated/owner")({
  head: () => ({ meta: [{ title: "Owner Dashboard — Motion IT BD" }] }),
  component: OwnerDashboard,
});

const PIE_COLORS = ["hsl(var(--chart-2))", "hsl(var(--warning))", "hsl(var(--destructive))"];

function StatCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: number | string;
  icon: typeof Building2;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-gradient text-brand-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-semibold text-foreground">{value}</p>
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          {hint && <p className="truncate text-[11px] text-muted-foreground/70">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function OwnerDashboard() {
  const { isOwner } = useAuth();
  const [stats, setStats] = useState<OwnerStats | null>(null);
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [logins, setLogins] = useState<LoginHistoryRow[]>([]);
  const [events, setEvents] = useState<SecurityEventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOwner) return;
    Promise.all([
      fetchOwnerStats(),
      fetchRegistrationRequests("all"),
      fetchLoginHistory(8),
      fetchSecurityEvents(6),
    ])
      .then(([s, r, l, e]) => {
        setStats(s);
        setRequests(r);
        setLogins(l);
        setEvents(e);
      })
      .finally(() => setLoading(false));
  }, [isOwner]);

  const recentRegistrations = useMemo(() => requests.slice(0, 6), [requests]);

  const regTrend = useMemo(() => {
    const days: { day: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const count = requests.filter((r) => r.created_at.slice(0, 10) === key).length;
      days.push({ day: d.toLocaleDateString(undefined, { weekday: "short" }), count });
    }
    return days;
  }, [requests]);

  const companyPie = stats
    ? [
        { name: "Active", value: stats.companiesActive },
        { name: "Suspended", value: stats.companiesSuspended },
        {
          name: "Other",
          value: Math.max(0, stats.companiesTotal - stats.companiesActive - stats.companiesSuspended),
        },
      ].filter((s) => s.value > 0)
    : [];

  if (!isOwner) {
    return (
      <div className="space-y-8">
        <PageHeader title="Owner Dashboard" />
        <NoAccess />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Owner Dashboard"
        description="Platform-wide governance overview across all companies and users."
      />

      {loading || !stats ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Companies" value={stats.companiesTotal} icon={Building2} hint={`${stats.companiesActive} active · ${stats.companiesSuspended} suspended`} />
            <StatCard label="Total Users" value={stats.usersTotal} icon={Users} hint={`${stats.usersActive} active · ${stats.usersSuspended} restricted`} />
            <StatCard label="Pending Requests" value={stats.pendingRequests} icon={UserCheck} hint="Awaiting Owner approval" />
            <StatCard label="Security Events" value={events.length} icon={ShieldAlert} hint="Recent monitoring" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Registration requests (7 days)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={regTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} width={28} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="hsl(var(--chart-1))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Companies by status</CardTitle>
              </CardHeader>
              <CardContent>
                {companyPie.length === 0 ? (
                  <p className="py-16 text-center text-sm text-muted-foreground">No companies yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={companyPie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                        {companyPie.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Recent registrations</CardTitle>
                <Link to="/owner/registrations" className="text-xs text-primary hover:underline">
                  View all
                </Link>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentRegistrations.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No registration requests yet.</p>
                ) : (
                  recentRegistrations.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-3 border-b border-border/60 pb-3 last:border-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{r.company_name}</p>
                        <p className="truncate text-xs text-muted-foreground">{r.email}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0">{REGISTRATION_STATUS_LABELS[r.status]}</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Recent login activity</CardTitle>
                <Link to="/owner/security" className="text-xs text-primary hover:underline">
                  Security center
                </Link>
              </CardHeader>
              <CardContent className="space-y-3">
                {logins.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No login activity recorded yet.</p>
                ) : (
                  logins.map((l) => (
                    <div key={l.id} className="flex items-center justify-between gap-3 border-b border-border/60 pb-3 last:border-0 last:pb-0">
                      <div className="flex min-w-0 items-center gap-2">
                        {l.success ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-chart-2" />
                        ) : (
                          <CircleSlash className="h-4 w-4 shrink-0 text-destructive" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm text-foreground">{l.email || "Unknown"}</p>
                          <p className="truncate text-xs text-muted-foreground">{l.ip_address || "IP unavailable"}</p>
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {new Date(l.created_at).toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4" /> System health
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <HealthPill label="Database" ok />
              <HealthPill label="Authentication" ok />
              <HealthPill label="Edge functions" ok />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function HealthPill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
      <span className="text-sm text-foreground">{label}</span>
      <span className={`flex items-center gap-1.5 text-xs font-medium ${ok ? "text-chart-2" : "text-destructive"}`}>
        <span className={`h-2 w-2 rounded-full ${ok ? "bg-chart-2" : "bg-destructive"}`} />
        {ok ? "Operational" : "Issue"}
      </span>
    </div>
  );
}