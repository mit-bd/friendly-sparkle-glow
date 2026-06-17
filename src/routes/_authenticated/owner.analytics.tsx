import { createFileRoute } from "@/lib/router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Building2, Users, UserCheck, ShieldAlert } from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import {
  fetchCompanies,
  fetchOwnerUsers,
  fetchRegistrationRequests,
  fetchLoginHistory,
  type Company,
  type OwnerUserRow,
  type RegistrationRequest,
  type LoginHistoryRow,
} from "@/lib/owner";

export const Route = createFileRoute("/_authenticated/owner/analytics")({
  head: () => ({ meta: [{ title: "Platform Analytics — Motion IT BD" }] }),
  component: PlatformAnalytics,
});

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

function monthKey(iso: string) {
  return iso.slice(0, 7);
}

function PlatformAnalytics() {
  const { isOwner } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<OwnerUserRow[]>([]);
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [logins, setLogins] = useState<LoginHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOwner) return;
    Promise.all([
      fetchCompanies(),
      fetchOwnerUsers(),
      fetchRegistrationRequests("all"),
      fetchLoginHistory(200),
    ])
      .then(([c, u, r, l]) => {
        setCompanies(c);
        setUsers(u);
        setRequests(r);
        setLogins(l);
      })
      .finally(() => setLoading(false));
  }, [isOwner]);

  // Last 6 months: cumulative company + user growth.
  const growth = useMemo(() => {
    const months: { key: string; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      months.push({
        key: d.toISOString().slice(0, 7),
        label: d.toLocaleDateString(undefined, { month: "short" }),
      });
    }
    return months.map((m) => ({
      month: m.label,
      companies: companies.filter((c) => monthKey(c.created_at) <= m.key && c.status !== "deleted").length,
      users: users.filter((u) => monthKey(u.created_at) <= m.key).length,
    }));
  }, [companies, users]);

  // Registration funnel by status.
  const funnel = useMemo(() => {
    const count = (s: string) => requests.filter((r) => r.status === s).length;
    return [
      { stage: "Pending", value: count("pending") },
      { stage: "Info Req.", value: count("info_requested") },
      { stage: "Approved", value: count("approved") },
      { stage: "Rejected", value: count("rejected") },
    ];
  }, [requests]);

  const loginSuccess = logins.filter((l) => l.success).length;
  const loginFailed = logins.length - loginSuccess;

  if (!isOwner) {
    return (
      <div className="space-y-8">
        <PageHeader title="Platform Analytics" />
        <NoAccess />
      </div>
    );
  }

  const activeCompanies = companies.filter((c) => c.status === "active").length;
  const approvalRate =
    requests.length > 0
      ? Math.round((requests.filter((r) => r.status === "approved").length / requests.length) * 100)
      : 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Platform Analytics"
        description="Growth, registration and access trends across the whole platform."
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Companies" value={companies.filter((c) => c.status !== "deleted").length} icon={Building2} hint={`${activeCompanies} active`} />
            <StatCard label="Total Users" value={users.length} icon={Users} hint="Across all companies" />
            <StatCard label="Approval Rate" value={`${approvalRate}%`} icon={UserCheck} hint={`${requests.length} total requests`} />
            <StatCard label="Login Success" value={`${logins.length ? Math.round((loginSuccess / logins.length) * 100) : 0}%`} icon={ShieldAlert} hint={`${loginFailed} failed attempts`} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Platform growth (6 months)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={growth}>
                  <defs>
                    <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gU" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} width={28} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="companies" stroke="var(--chart-1)" fill="url(#gC)" name="Companies" />
                  <Area type="monotone" dataKey="users" stroke="var(--chart-2)" fill="url(#gU)" name="Users" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Registration funnel</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={funnel}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="stage" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} width={28} />
                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="var(--chart-3)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Access attempts</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={[{ name: "Successful", value: loginSuccess }, { name: "Failed", value: loginFailed }]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} width={28} />
                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="var(--chart-4)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
