import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUploader } from "@/components/ImageUploader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/settings/signatories")({
  head: () => ({ meta: [{ title: "Signatories — Expense Management System" }] }),
  component: SignatoriesPage,
});

type SignatoryType = "accountant" | "manager" | "ceo";
interface Signatory {
  id: string;
  type: SignatoryType;
  full_name: string;
  designation: string;
  signature_url: string | null;
}

const TYPE_LABELS: Record<SignatoryType, string> = {
  accountant: "Accountant",
  manager: "Manager",
  ceo: "CEO / Managing Director",
};

const ORDER: SignatoryType[] = ["accountant", "manager", "ceo"];

function SignatoriesPage() {
  const { can } = useAuth();
  const [rows, setRows] = useState<Signatory[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("signatories")
      .select("*")
      .then(({ data }) => {
        const list = (data as Signatory[]) ?? [];
        list.sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));
        setRows(list);
        setLoading(false);
      });
  }, []);

  if (!can("settings", "view")) {
    return (
      <div className="space-y-8">
        <PageHeader title="Authorized Signatories" />
        <NoAccess />
      </div>
    );
  }

  const update = (id: string, patch: Partial<Signatory>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  async function save(row: Signatory) {
    setSaving(row.id);
    const { error } = await supabase
      .from("signatories")
      .update({
        full_name: row.full_name,
        designation: row.designation,
        signature_url: row.signature_url,
      })
      .eq("id", row.id);
    setSaving(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${TYPE_LABELS[row.type]} signatory saved.`);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Authorized Signatories"
        description="Signatures are stored securely and made available to reports and print templates."
      />
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-6">
          {rows.map((row) => (
            <Card key={row.id}>
              <CardHeader>
                <CardTitle className="text-base">{TYPE_LABELS[row.type]}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`name-${row.id}`}>Full Name</Label>
                    <Input
                      id={`name-${row.id}`}
                      value={row.full_name}
                      onChange={(e) => update(row.id, { full_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`desig-${row.id}`}>Designation</Label>
                    <Input
                      id={`desig-${row.id}`}
                      value={row.designation}
                      onChange={(e) => update(row.id, { designation: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Signature (transparent PNG recommended)</Label>
                  <ImageUploader
                    bucket="signatures"
                    value={row.signature_url}
                    onChange={(p) => update(row.id, { signature_url: p })}
                    transparent
                    label="Upload signature"
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="button" onClick={() => save(row)} disabled={saving === row.id}>
                    {saving === row.id && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}