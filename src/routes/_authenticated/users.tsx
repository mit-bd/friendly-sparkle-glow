import { createFileRoute } from "@/lib/router";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { RoleBadge } from "@/components/RoleBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MobileRecordCard } from "@/components/app/MobileRecordCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { logActivity } from "@/lib/audit";
import { ROLE_LABELS } from "@/lib/modules";
import { createUser } from "@/lib/admin-users";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({ meta: [{ title: "Users & Roles — Motion IT BD" }] }),
  component: UsersPage,
});

type Role = "admin" | "manager" | "accountant" | "viewer";
const ROLES: Role[] = ["admin", "manager", "accountant", "viewer"];

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: "active" | "inactive";
  role: Role | null;
}

function UsersPage() {
  const { can, user: currentUser } = useAuth();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(async () => {
    const [{ data: profiles }, { data: roleRows }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email, phone, status").order("created_at"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const roleMap = new Map<string, Role>();
    for (const r of roleRows ?? []) roleMap.set(r.user_id, r.role as Role);
    setRows(
      (profiles ?? []).map((p) => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        phone: p.phone,
        status: p.status as "active" | "inactive",
        role: roleMap.get(p.id) ?? null,
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!can("users", "view")) {
    return (
      <div className="space-y-8">
        <PageHeader title="Users & Roles" />
        <NoAccess />
      </div>
    );
  }

  async function changeRole(row: UserRow, role: Role) {
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, role } : r)));
    await supabase.from("user_roles").delete().eq("user_id", row.id);
    const { error } = await supabase.from("user_roles").insert({ user_id: row.id, role });
    if (error) {
      toast.error(error.message);
      load();
      return;
    }
    toast.success(`Role updated to ${ROLE_LABELS[role]}.`);
    void logActivity({
      action: "permission_change",
      entityType: "user",
      entityId: row.id,
      entityLabel: row.full_name?.trim() || row.email,
      metadata: { role },
    });
  }

  async function toggleStatus(row: UserRow, active: boolean) {
    const status = active ? "active" : "inactive";
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, status } : r)));
    const { error } = await supabase.from("profiles").update({ status }).eq("id", row.id);
    if (error) {
      toast.error(error.message);
      load();
      return;
    }
    toast.success(`User ${active ? "reactivated" : "deactivated"}.`);
    void logActivity({
      action: active ? "user_activate" : "user_deactivate",
      entityType: "user",
      entityId: row.id,
      entityLabel: row.full_name?.trim() || row.email,
    });
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Users & Roles"
        description="Create users, assign roles, and manage account status."
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Add user
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const isSelf = row.id === currentUser?.id;
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        {row.full_name || "—"}
                        {isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.email}</TableCell>
                      <TableCell className="text-muted-foreground">{row.phone || "—"}</TableCell>
                      <TableCell>
                        <Select
                          value={row.role ?? undefined}
                          onValueChange={(v) => changeRole(row, v as Role)}
                          disabled={isSelf}
                        >
                          <SelectTrigger className="h-8 w-[140px]">
                            <SelectValue placeholder="No role" />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => (
                              <SelectItem key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            row.status === "active"
                              ? "border-transparent bg-chart-2/15 text-chart-2"
                              : "border-transparent bg-muted text-muted-foreground"
                          }
                        >
                          {row.status === "active" ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end">
                          <Switch
                            checked={row.status === "active"}
                            disabled={isSelf}
                            onCheckedChange={(v) => toggleStatus(row, v)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <CreateUserDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={load} />
    </div>
  );
}

function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("viewer");
  const [saving, setSaving] = useState(false);

  function reset() {
    setFullName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setRole("viewer");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createUser({ full_name: fullName, email, phone, password, role });
      toast.success("User created.");
      void logActivity({
        action: "user_create",
        entityType: "user",
        entityLabel: fullName?.trim() || email,
        metadata: { role },
      });
      reset();
      onOpenChange(false);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create user.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Create user
          </DialogTitle>
          <DialogDescription>
            Add a new team member and assign their role.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cu-name">Full name</Label>
            <Input id="cu-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cu-email">Email</Label>
              <Input id="cu-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cu-phone">Phone</Label>
              <Input id="cu-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cu-password">Temporary password</Label>
              <PasswordInput
                id="cu-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cu-role">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger id="cu-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Create user
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}