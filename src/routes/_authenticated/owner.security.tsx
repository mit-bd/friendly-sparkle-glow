import { createFileRoute } from "@/lib/router";
import { useEffect, useState } from "react";
import { Loader2, ShieldAlert, Monitor, CheckCircle2, CircleSlash } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MobileRecordCard } from "@/components/app/MobileRecordCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import {
  fetchLoginHistory,
  fetchSecurityEvents,
  type LoginHistoryRow,
  type SecurityEventRow,
} from "@/lib/owner";

export const Route = createFileRoute("/_authenticated/owner/security")({
  head: () => ({ meta: [{ title: "Security Center — Motion IT BD" }] }),
  component: OwnerSecurityPage,
});

const SEVERITY_TONE: Record<string, string> = {
  info: "bg-muted text-muted-foreground",
  warning: "bg-warning/15 text-warning",
  high: "bg-destructive/15 text-destructive",
};

function OwnerSecurityPage() {
  const { isOwner, session } = useAuth();
  const [logins, setLogins] = useState<LoginHistoryRow[]>([]);
  const [events, setEvents] = useState<SecurityEventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOwner) return;
    Promise.all([fetchLoginHistory(150), fetchSecurityEvents(100)])
      .then(([l, e]) => {
        setLogins(l);
        setEvents(e);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [isOwner]);

  if (!isOwner) {
    return (
      <div className="space-y-8">
        <PageHeader title="Security Center" />
        <NoAccess />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Security Center" description="Login history, IP tracking, suspicious-activity monitoring, and sessions." />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Monitor className="h-4 w-4" /> Current session</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="flex justify-between rounded-md border border-border bg-muted/30 px-4 py-2.5">
            <span className="text-muted-foreground">Signed in as</span>
            <span className="font-medium text-foreground">{session?.user.email}</span>
          </div>
          <div className="flex justify-between rounded-md border border-border bg-muted/30 px-4 py-2.5">
            <span className="text-muted-foreground">Session expires</span>
            <span className="font-medium text-foreground">
              {session?.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : "—"}
            </span>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs defaultValue="logins">
          <TabsList>
            <TabsTrigger value="logins">Login history</TabsTrigger>
            <TabsTrigger value="events">Security events</TabsTrigger>
          </TabsList>

          <TabsContent value="logins" className="mt-6">
            <Card>
              <CardContent className="p-0">
                <div className="space-y-3 p-4 md:hidden">
                  {logins.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">No login activity recorded yet.</p>
                  ) : (
                    logins.map((l) => (
                      <MobileRecordCard key={l.id}
                        title={l.email || "—"}
                        subtitle={l.ip_address || "—"}
                        footer={<>{l.success ? (<span className="flex items-center gap-1.5 text-sm text-chart-2"><CheckCircle2 className="h-4 w-4" /> Success</span>) : (<span className="flex items-center gap-1.5 text-sm text-destructive"><CircleSlash className="h-4 w-4" /> Failed</span>)}<span className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()}</span></>} />
                    ))
                  )}
                </div>
                <Table className="hidden md:table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Result</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>IP address</TableHead>
                      <TableHead>When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logins.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-12 text-center text-sm text-muted-foreground">No login activity recorded yet.</TableCell>
                      </TableRow>
                    ) : (
                      logins.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell>
                            {l.success ? (
                              <span className="flex items-center gap-1.5 text-chart-2"><CheckCircle2 className="h-4 w-4" /> Success</span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-destructive"><CircleSlash className="h-4 w-4" /> Failed</span>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{l.email || "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{l.ip_address || "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{new Date(l.created_at).toLocaleString()}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events" className="mt-6">
            <Card>
              <CardContent className="p-0">
                <div className="space-y-3 p-4 md:hidden">
                  {events.length === 0 ? (
                    <div className="py-10 text-center text-sm text-muted-foreground"><ShieldAlert className="mx-auto mb-2 h-5 w-5 text-muted-foreground/60" />No security events. All clear.</div>
                  ) : (
                    events.map((e) => (
                      <MobileRecordCard key={e.id}
                        title={<span className="capitalize">{e.type.replace(/_/g, " ")}</span>}
                        subtitle={e.email || "—"}
                        footer={<><Badge variant="outline" className={`border-transparent capitalize ${SEVERITY_TONE[e.severity] ?? SEVERITY_TONE.info}`}>{e.severity}</Badge><span className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span></>}
                        details={[
                          { label: "IP address", value: e.ip_address || "—" },
                          { label: "When", value: new Date(e.created_at).toLocaleString() },
                        ]} />
                    ))
                  )}
                </div>
                <Table className="hidden md:table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Severity</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>IP address</TableHead>
                      <TableHead>When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                          <ShieldAlert className="mx-auto mb-2 h-5 w-5 text-muted-foreground/60" />
                          No security events. All clear.
                        </TableCell>
                      </TableRow>
                    ) : (
                      events.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell>
                            <Badge variant="outline" className={`border-transparent capitalize ${SEVERITY_TONE[e.severity] ?? SEVERITY_TONE.info}`}>
                              {e.severity}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium capitalize">{e.type.replace(/_/g, " ")}</TableCell>
                          <TableCell className="text-muted-foreground">{e.email || "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{e.ip_address || "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{new Date(e.created_at).toLocaleString()}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}