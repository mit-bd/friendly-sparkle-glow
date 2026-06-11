import { createFileRoute, Link, useParams } from "@/lib/router";
import { useCallback, useEffect, useState } from "react";
import { Loader2, ArrowLeft, Ban, RotateCcw, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth-context";
import { logActivity, ACTIVITY_ACTION_LABELS } from "@/lib/audit";
import {
  fetchCompany,
  updateCompany,
  setCompanyStatus,
  fetchCompanyUsers,
  fetchEntityActivity,
  COMPANY_STATUS_LABELS,
  PLAN_LABELS,
  ACCOUNT_STATUS_LABELS,
  type Company,
  type OwnerUserRow,
  type SubscriptionPlan,
} from "@/lib/owner";

export const Route = createFileRoute("/_authenticated/owner/companies/$id")({
  head: () => ({ meta: [{ title: "Company — Motion IT BD" }] }),
  component: CompanyDetailPage,
});

const PLANS: SubscriptionPlan[] = ["free", "starter", "pro", "enterprise"];

function CompanyDetailPage() {
  const { isOwner, user } = useAuth();
  const { id } = useParams();
  const [company, setCompany] = useState<Company | null>(null);
  const [users, setUsers] = useState<OwnerUserRow[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", notes: "", plan: "free" as SubscriptionPlan });

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([fetchCompany(id), fetchCompanyUsers(id), fetchEntityActivity(id)])
      .then(([c, u, a]) => {
        setCompany(c);
        setUsers(u);
        setActivity(a);
        if (c) {
          setForm({
            name: c.name ?? "",
            email: c.email ?? "",
            phone: c.phone ?? "",
            address: c.address ?? "",
            notes: c.notes ?? "",
            plan: c.plan,
          });
        }
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (isOwner) load();
  }, [isOwner, load]);

  if (!isOwner) {
    return (
      <div className="space-y-8">
        <PageHeader title="Company" />
        <NoAccess />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="space-y-6">
        <PageHeader title="Company not found" />
        <Link to="/owner/companies" className="text-sm text-primary hover:underline">← Back to companies</Link>
      </div>
    );
  }

  async function save() {
    setSaving(true);
    try {
      await updateCompany(id, { name: form.name, email: form.email, phone: form.phone, address: form.address, notes: form.notes, plan: form.plan } as Partial<Company>);
      await logActivity({ action: "company_update", entityType: "company", entityId: id, entityLabel: form.name });
      toast.success("Company updated.");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(status: Company["status"], action: "company_suspend" | "company_reactivate" | "company_delete") {
    try {
      await setCompanyStatus(id, status, user?.id ?? "");
      await logActivity({ action, entityType: "company", entityId: id, entityLabel: company?.name ?? "" });
      toast.success(`Company ${COMPANY_STATUS_LABELS[status].toLowerCase()}.`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed.");
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <Link to="/owner/companies" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Companies
        </Link>
        <PageHeader
          title={company.name}
          description={`${PLAN_LABELS[company.plan]} plan · ${COMPANY_STATUS_LABELS[company.status]}`}
          actions={
            <div className="flex flex-wrap gap-2">
              {company.status === "active" ? (
                <AlertConfirm
                  trigger={<Button variant="outline" size="sm" className="text-warning"><Ban className="h-4 w-4" /> Suspend</Button>}
                  title="Suspend this company?"
                  description="Suspended companies remain in the system but are flagged inactive."
                  onConfirm={() => changeStatus("suspended", "company_suspend")}
                />
              ) : (
                <Button variant="outline" size="sm" onClick={() => changeStatus("active", "company_reactivate")}>
                  <RotateCcw className="h-4 w-4" /> Reactivate
                </Button>
              )}
              {!company.is_primary && company.status !== "deleted" && (
                <AlertConfirm
                  trigger={<Button variant="outline" size="sm" className="text-destructive"><Trash2 className="h-4 w-4" /> Delete</Button>}
                  title="Delete this company?"
                  description="This is a soft delete — the company is marked deleted but its records are retained."
                  onConfirm={() => changeStatus("deleted", "company_delete")}
                />
              )}
            </div>
          }
        />
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="users">Users ({users.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Company information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Plan</Label>
                  <Select value={form.plan} onValueChange={(v) => setForm((f) => ({ ...f, plan: v as SubscriptionPlan }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PLANS.map((p) => <SelectItem key={p} value={p}>{PLAN_LABELS[p]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Textarea value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Owner notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
              </div>
              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}<Save className="h-4 w-4" /> Save changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <Card>
            <CardContent className="divide-y divide-border p-0">
              {users.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">No users linked to this company.</p>
              ) : (
                users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{u.full_name || u.email}</p>
                      <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {u.role && <Badge variant="outline" className="capitalize">{u.role}</Badge>}
                      <Badge variant="outline">{ACCOUNT_STATUS_LABELS[u.status]}</Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <Card>
            <CardContent className="divide-y divide-border p-0">
              {activity.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">No recorded activity.</p>
              ) : (
                activity.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <span className="text-sm text-foreground">{ACTIVITY_ACTION_LABELS[a.action] ?? a.action}</span>
                    <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AlertConfirm({
  trigger,
  title,
  description,
  onConfirm,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Confirm</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}