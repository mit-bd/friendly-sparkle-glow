import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { MODULE_LABELS, ROLE_LABELS, type ModuleKey } from "@/lib/modules";

export const Route = createFileRoute("/_authenticated/settings/permissions")({
  head: () => ({ meta: [{ title: "Permissions — Motion IT BD" }] }),
  component: PermissionsPage,
});

type Role = "admin" | "manager" | "accountant" | "viewer";
type Action = "can_view" | "can_edit" | "can_approve" | "can_export";

interface PermRow {
  id: string;
  role: Role;
  module: string;
  can_view: boolean;
  can_edit: boolean;
  can_approve: boolean;
  can_export: boolean;
}

const EDITABLE_ROLES: Role[] = ["manager", "accountant", "viewer"];
const ACTIONS: { key: Action; label: string }[] = [
  { key: "can_view", label: "View" },
  { key: "can_edit", label: "Edit" },
  { key: "can_approve", label: "Approve" },
  { key: "can_export", label: "Export" },
];
const MODULE_ORDER: ModuleKey[] = [
  "dashboard",
  "expenses",
  "marketing",
  "returns",
  "damages",
  "reports",
  "users",
  "settings",
];

function PermissionsPage() {
  const { can } = useAuth();
  const [rows, setRows] = useState<PermRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("role_permissions")
      .select("*")
      .then(({ data }) => {
        setRows((data as PermRow[]) ?? []);
        setLoading(false);
      });
  }, []);

  if (!can("settings", "view")) {
    return (
      <div className="space-y-8">
        <PageHeader title="Permissions" />
        <NoAccess />
      </div>
    );
  }

  async function toggle(row: PermRow, action: Action, value: boolean) {
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, [action]: value } : r)));
    const patch: Partial<PermRow> = { [action]: value };
    const { error } = await supabase
      .from("role_permissions")
      .update(patch)
      .eq("id", row.id);
    if (error) {
      toast.error(error.message);
      setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, [action]: !value } : r)));
    }
  }

  function rowFor(role: Role, module: ModuleKey) {
    return rows.find((r) => r.role === role && r.module === module);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Permissions"
        description="Control module access, editing, approval, and export rights per role."
      />
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs defaultValue="manager">
          <TabsList>
            {EDITABLE_ROLES.map((r) => (
              <TabsTrigger key={r} value={r}>
                {ROLE_LABELS[r]}
              </TabsTrigger>
            ))}
            <TabsTrigger value="admin">Admin</TabsTrigger>
          </TabsList>

          {EDITABLE_ROLES.map((role) => (
            <TabsContent key={role} value={role}>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40%]">Module</TableHead>
                        {ACTIONS.map((a) => (
                          <TableHead key={a.key} className="text-center">
                            {a.label}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {MODULE_ORDER.map((module) => {
                        const row = rowFor(role, module);
                        return (
                          <TableRow key={module}>
                            <TableCell className="font-medium">
                              {MODULE_LABELS[module]}
                            </TableCell>
                            {ACTIONS.map((a) => (
                              <TableCell key={a.key} className="text-center">
                                <div className="flex justify-center">
                                  <Switch
                                    checked={row ? row[a.key] : false}
                                    disabled={!row}
                                    onCheckedChange={(v) => row && toggle(row, a.key, v)}
                                  />
                                </div>
                              </TableCell>
                            ))}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          ))}

          <TabsContent value="admin">
            <Card>
              <CardContent className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Admins always have full access</span>
                to every module. This cannot be modified to protect workspace control.
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}