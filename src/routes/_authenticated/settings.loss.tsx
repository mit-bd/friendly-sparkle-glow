import { createFileRoute } from '@tanstack/react-router'
import { createFileRoute } from "@/lib/router";
import { useEffect, useState } from "react";
import { Plus, Undo2, PackageX, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import {
  fetchReturnReasons,
  fetchDamageTypes,
  type ReturnReason,
  type DamageType,
} from "@/lib/loss";

export const Route = createFileRoute("/_authenticated/settings/loss")({
  head: () => ({ meta: [{ title: "Loss Setup — Motion IT BD" }] }),
  component: LossSetup,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function LossSetup() {
  const { isAdmin, user } = useAuth();
  const [reasons, setReasons] = useState<ReturnReason[]>([]);
  const [types, setTypes] = useState<DamageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [reasonName, setReasonName] = useState("");
  const [typeName, setTypeName] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [r, t] = await Promise.all([fetchReturnReasons(true), fetchDamageTypes(true)]);
    setReasons(r);
    setTypes(t);
    setLoading(false);
  }

  useEffect(() => {
    load().catch((e) => {
      toast.error(e instanceof Error ? e.message : "Failed to load.");
      setLoading(false);
    });
  }, []);

  if (!isAdmin) {
    return (
      <div className="space-y-8">
        <PageHeader title="Loss Setup" />
        <NoAccess />
      </div>
    );
  }

  async function addReason(e: React.FormEvent) {
    e.preventDefault();
    const name = reasonName.trim();
    if (!name) return;
    setBusy(true);
    const { error } = await db.from("return_reasons").insert({
      name,
      sort_order: reasons.length,
      created_by: user?.id ?? null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setReasonName("");
    toast.success("Reason added.");
    load();
  }

  async function toggleReason(r: ReturnReason) {
    const { error } = await db.from("return_reasons").update({ is_active: !r.is_active }).eq("id", r.id);
    if (error) return toast.error(error.message);
    load();
  }

  async function addType(e: React.FormEvent) {
    e.preventDefault();
    const name = typeName.trim();
    if (!name) return;
    setBusy(true);
    const { error } = await db.from("damage_types").insert({
      name,
      sort_order: types.length,
      created_by: user?.id ?? null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setTypeName("");
    toast.success("Type added.");
    load();
  }

  async function toggleType(t: DamageType) {
    const { error } = await db.from("damage_types").update({ is_active: !t.is_active }).eq("id", t.id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Loss Setup"
        description="Manage return reasons and damage types used across the loss management modules."
      />

      {loading ? (
        <Skeleton className="h-96 w-full rounded-lg" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Undo2 className="h-4 w-4 text-brand" /> Return reasons
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={addReason} className="flex items-end gap-2">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="reason-name">New reason</Label>
                  <Input
                    id="reason-name"
                    value={reasonName}
                    maxLength={100}
                    onChange={(e) => setReasonName(e.target.value)}
                    placeholder="e.g. Size mismatch"
                  />
                </div>
                <Button type="submit" disabled={busy || !reasonName.trim()}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Add
                </Button>
              </form>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-16 text-right">Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reasons.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>
                        <Badge variant={r.is_active ? "secondary" : "outline"} className="text-[10px]">
                          {r.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Switch checked={r.is_active} onCheckedChange={() => toggleReason(r)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PackageX className="h-4 w-4 text-brand" /> Damage types
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={addType} className="flex items-end gap-2">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="type-name">New type</Label>
                  <Input
                    id="type-name"
                    value={typeName}
                    maxLength={100}
                    onChange={(e) => setTypeName(e.target.value)}
                    placeholder="e.g. Expired stock"
                  />
                </div>
                <Button type="submit" disabled={busy || !typeName.trim()}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Add
                </Button>
              </form>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-16 text-right">Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {types.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell>
                        <Badge variant={t.is_active ? "secondary" : "outline"} className="text-[10px]">
                          {t.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Switch checked={t.is_active} onCheckedChange={() => toggleType(t)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
