import { createFileRoute } from "@/lib/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search, KeyRound, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MobileRecordCard } from "@/components/app/MobileRecordCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth-context";
import { ROLE_LABELS } from "@/lib/modules";
import {
  fetchOwnerUsers,
  userAdmin,
  ACCOUNT_STATUS_LABELS,
  type OwnerUserRow,
  type AccountStatus,
} from "@/lib/owner";

export const Route = createFileRoute("/_authenticated/owner/users")({
  head: () => ({ meta: [{ title: "All Users — Motion IT BD" }] }),
  component: OwnerUsersPage,
});

const ASSIGNABLE_ROLES = ["admin", "manager", "accountant", "viewer"];

const STATUS_TONE: Record<AccountStatus, string> = {
  active: "bg-chart-2/15 text-chart-2",
  inactive: "bg-muted text-muted-foreground",
  pending: "bg-warning/15 text-warning",
  suspended: "bg-destructive/15 text-destructive",
  locked: "bg-destructive/15 text-destructive",
};

function OwnerUsersPage() {
  const { isOwner, user } = useAuth();
  const [rows, setRows] = useState<OwnerUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AccountStatus | "all">("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [tempPw, setTempPw] = useState<{ email: string; password: string } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchOwnerUsers()
      .then(setRows)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (isOwner) load();
  }, [isOwner, load]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (roleFilter !== "all" && r.role !== roleFilter) return false;
      if (!s) return true;
      return (r.full_name ?? "").toLowerCase().includes(s) || (r.email ?? "").toLowerCase().includes(s);
    });
  }, [rows, search, statusFilter, roleFilter]);

  if (!isOwner) {
    return (
      <div className="space-y-8">
        <PageHeader title="All Users" />
        <NoAccess />
      </div>
    );
  }

  async function act(row: OwnerUserRow, action: Parameters<typeof userAdmin>[0], extra: Record<string, unknown> = {}, successMsg?: string) {
    try {
      const res = await userAdmin(action, row.id, extra);
      if (action === "temp_password" && res.password) {
        setTempPw({ email: row.email, password: res.password });
      }
      toast.success(successMsg ?? "Done.");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed.");
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader title="All Users" description="Every user across the platform. Manage roles, access, and credentials." />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email…" className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as AccountStatus | "all")}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(["active", "suspended", "locked", "inactive", "pending"] as AccountStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{ACCOUNT_STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {["owner", ...ASSIGNABLE_ROLES].map((r) => (
              <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="space-y-3 p-4 md:hidden">
              {filtered.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No users match these filters.</p>
              ) : (
                filtered.map((row) => {
                  const isSelf = row.id === user?.id;
                  const isOwnerRow = row.role === "owner";
                  return (
                    <MobileRecordCard key={row.id}
                      title={<>{row.full_name || "—"}{isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}{row.require_password_change && <Badge variant="outline" className="ml-2 text-[10px] text-warning">Must reset</Badge>}</>}
                      subtitle={row.email}
                      footer={
                        <>
                          <Badge variant="outline" className={`border-transparent ${STATUS_TONE[row.status]}`}>{ACCOUNT_STATUS_LABELS[row.status]}</Badge>
                          {isOwnerRow || isSelf ? <span className="text-xs text-muted-foreground">—</span> : <UserActionsMenu row={row} act={act} />}
                        </>
                      }
                      details={[
                        { label: "Role", value: isOwnerRow || isSelf ? (
                          <Badge variant="outline" className="capitalize">{row.role ? ROLE_LABELS[row.role] : "—"}</Badge>
                        ) : (
                          <Select value={row.role ?? undefined} onValueChange={(v) => act(row, "set_role", { role: v }, `Role set to ${ROLE_LABELS[v]}.`)}>
                            <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="No role" /></SelectTrigger>
                            <SelectContent>{ASSIGNABLE_ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
                          </Select>
                        ) },
                      ]} />
                  );
                })
              )}
            </div>
            <Table className="hidden md:table">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">No users match these filters.</TableCell>
                  </TableRow>
                ) : (
                  filtered.map((row) => {
                    const isSelf = row.id === user?.id;
                    const isOwnerRow = row.role === "owner";
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">
                          {row.full_name || "—"}
                          {isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                          {row.require_password_change && (
                            <Badge variant="outline" className="ml-2 text-[10px] text-warning">Must reset</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{row.email}</TableCell>
                        <TableCell>
                          {isOwnerRow || isSelf ? (
                            <Badge variant="outline" className="capitalize">{row.role ? ROLE_LABELS[row.role] : "—"}</Badge>
                          ) : (
                            <Select value={row.role ?? undefined} onValueChange={(v) => act(row, "set_role", { role: v }, `Role set to ${ROLE_LABELS[v]}.`)}>
                              <SelectTrigger className="h-8 w-[130px]"><SelectValue placeholder="No role" /></SelectTrigger>
                              <SelectContent>
                                {ASSIGNABLE_ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`border-transparent ${STATUS_TONE[row.status]}`}>
                            {ACCOUNT_STATUS_LABELS[row.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {isOwnerRow || isSelf ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <UserActionsMenu row={row} act={act} />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!tempPw} onOpenChange={(o) => !o && setTempPw(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Temporary password generated</AlertDialogTitle>
            <AlertDialogDescription>
              Share this password securely with <strong>{tempPw?.email}</strong>. They will be required to
              change it on next sign-in. This is the only time it is shown.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-md border border-border bg-muted/40 p-3 text-center font-mono text-sm">
            {tempPw?.password}
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setTempPw(null)}>Done</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UserActionsMenu({
  row,
  act,
}: {
  row: OwnerUserRow;
  act: (row: OwnerUserRow, action: Parameters<typeof userAdmin>[0], extra?: Record<string, unknown>, msg?: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="flex items-center gap-2 text-xs"><KeyRound className="h-3.5 w-3.5" /> Password</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => act(row, "send_reset_link", {}, "Reset link sent.")}>Send reset link</DropdownMenuItem>
        <DropdownMenuItem onClick={() => act(row, "temp_password", {}, "Temporary password generated.")}>Generate temporary password</DropdownMenuItem>
        <DropdownMenuItem onClick={() => act(row, "require_password_change", { value: true }, "User must change password next login.")}>Require change on next login</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs">Access</DropdownMenuLabel>
        {row.status === "suspended" || row.status === "locked" ? (
          <DropdownMenuItem onClick={() => act(row, row.status === "locked" ? "unlock" : "reactivate", {}, "Account restored.")}>
            {row.status === "locked" ? "Unlock account" : "Reactivate account"}
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem className="text-destructive" onClick={() => act(row, "suspend", {}, "User suspended.")}>Suspend user</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => act(row, "lock", {}, "User locked.")}>Lock user</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}