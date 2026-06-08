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
import { Textarea } from "@/components/ui/textarea";
import { ImageUploader } from "@/components/ImageUploader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useBranding } from "@/lib/branding-context";

export const Route = createFileRoute("/_authenticated/settings/company")({
  head: () => ({ meta: [{ title: "Company Profile — Motion IT BD" }] }),
  component: CompanyProfilePage,
});

type Form = {
  name: string;
  logo_url: string | null;
  address: string;
  mobile: string;
  email: string;
  website: string;
  facebook: string;
  whatsapp: string;
  trade_license: string;
  bin_number: string;
  tin_number: string;
  description: string;
};

const EMPTY: Form = {
  name: "",
  logo_url: null,
  address: "",
  mobile: "",
  email: "",
  website: "",
  facebook: "",
  whatsapp: "",
  trade_license: "",
  bin_number: "",
  tin_number: "",
  description: "",
};

const TEXT_FIELDS: { key: keyof Form; label: string; type?: string }[] = [
  { key: "name", label: "Company Name" },
  { key: "email", label: "Email Address", type: "email" },
  { key: "mobile", label: "Mobile Number" },
  { key: "whatsapp", label: "WhatsApp Number" },
  { key: "website", label: "Website" },
  { key: "facebook", label: "Facebook Page" },
  { key: "trade_license", label: "Trade License Number" },
  { key: "bin_number", label: "BIN Number" },
  { key: "tin_number", label: "TIN Number" },
];

function CompanyProfilePage() {
  const { can } = useAuth();
  const { company, refresh } = useBranding();
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (company) {
      setForm({
        name: company.name ?? "",
        logo_url: company.logo_url,
        address: company.address ?? "",
        mobile: company.mobile ?? "",
        email: company.email ?? "",
        website: company.website ?? "",
        facebook: company.facebook ?? "",
        whatsapp: company.whatsapp ?? "",
        trade_license: company.trade_license ?? "",
        bin_number: company.bin_number ?? "",
        tin_number: company.tin_number ?? "",
        description: company.description ?? "",
      });
    }
  }, [company]);

  if (!can("settings", "view")) {
    return (
      <div className="space-y-8">
        <PageHeader title="Company Profile" />
        <NoAccess />
      </div>
    );
  }

  const set = (key: keyof Form, value: string | null) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!company) return;
    setSaving(true);
    const { error } = await supabase.from("company_profile").update(form).eq("id", company.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Company profile saved. Branding updated across the app.");
    await refresh();
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Company Profile"
        description="This information powers branding across login, sidebar, reports, and exports."
      />
      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Branding</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Company Logo</Label>
              <ImageUploader
                bucket="logos"
                value={form.logo_url}
                onChange={(p) => set("logo_url", p)}
                transparent
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Company details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {TEXT_FIELDS.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={field.key}>{field.label}</Label>
                  <Input
                    id={field.key}
                    type={field.type ?? "text"}
                    value={(form[field.key] as string) ?? ""}
                    onChange={(e) => set(field.key, e.target.value)}
                  />
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Company Address</Label>
              <Textarea
                id="address"
                rows={2}
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Company Description</Label>
              <Textarea
                id="description"
                rows={3}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save company profile
          </Button>
        </div>
      </form>
    </div>
  );
}