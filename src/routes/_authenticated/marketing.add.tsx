import { createFileRoute } from '@tanstack/react-router'
import { createFileRoute, useNavigate, Link } from "@/lib/router";
import { useEffect, useState } from "react";
import { Loader2, Megaphone, ArrowLeft, Hash } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AttachmentUploader, type AttachmentValue } from "@/components/AttachmentUploader";
import { MarketingFields, type MarketingFormValues } from "@/components/marketing/MarketingFields";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { logExpenseEvent } from "@/lib/approvals";
import {
  fetchPlatforms,
  fetchCurrencies,
  fetchMarketingCategoryId,
  convertToBDT,
  type MarketingPlatform,
  type Currency,
} from "@/lib/marketing";

export const Route = createFileRoute("/_authenticated/marketing/add")({
  head: () => ({ meta: [{ title: "Add Marketing Cost — Motion IT BD" }] }),
  component: AddMarketingPage,
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function AddMarketingPage() {
  const { can, isAdmin, user, profile } = useAuth();
  const navigate = useNavigate();
  // Marketing costs are expenses — creating one requires expense edit rights.
  const canCreate = isAdmin || can("expenses", "edit");

  const [platforms, setPlatforms] = useState<MarketingPlatform[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [marketingCategoryId, setMarketingCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attachment, setAttachment] = useState<AttachmentValue | null>(null);

  const [form, setForm] = useState<MarketingFormValues>({
    expense_date: todayISO(),
    platform_id: "",
    campaign_name: "",
    description: "",
    currency: "BDT",
    original_amount: "",
    exchange_rate: "1",
    notes: "",
    status: "submitted",
  });

  useEffect(() => {
    Promise.all([fetchPlatforms(), fetchCurrencies(), fetchMarketingCategoryId()])
      .then(([p, c, catId]) => {
        setPlatforms(p);
        setCurrencies(c);
        setMarketingCategoryId(catId);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load form data."))
      .finally(() => setLoading(false));
  }, []);

  if (!canCreate) {
    return (
      <div className="space-y-8">
        <PageHeader title="Add Marketing Cost" />
        <NoAccess />
      </div>
    );
  }

  function patch(p: Partial<MarketingFormValues>) {
    setForm((f) => ({ ...f, ...p }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!form.platform_id) {
      toast.error("Please select a platform.");
      return;
    }
    const original = Number(form.original_amount);
    if (!Number.isFinite(original) || original <= 0) {
      toast.error("Please enter a valid original amount.");
      return;
    }
    const isBase = form.currency === "BDT";
    const rate = isBase ? 1 : Number(form.exchange_rate);
    if (!isBase && (!Number.isFinite(rate) || rate <= 0)) {
      toast.error("Please enter a valid exchange rate.");
      return;
    }
    const converted = convertToBDT(original, rate);

    setSaving(true);
    const finalStatus = form.status === "submitted" ? "pending_approval" : form.status;
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        expense_number: "",
        expense_date: form.expense_date,
        category_id: marketingCategoryId,
        amount: converted,
        is_marketing: true,
        platform_id: form.platform_id,
        campaign_name: form.campaign_name.trim() || null,
        currency: form.currency,
        original_amount: original,
        exchange_rate: rate,
        description: form.description.trim() || null,
        notes: form.notes.trim() || null,
        status: finalStatus,
        created_by: user.id,
      } as never)
      .select("id, expense_number")
      .single();

    if (error || !data) {
      setSaving(false);
      toast.error(error?.message ?? "Failed to create marketing cost.");
      return;
    }

    try {
      await logExpenseEvent({
        expenseId: data.id,
        actorId: user.id,
        action: "created",
        toStatus: finalStatus,
      });
      if (finalStatus !== "draft") {
        await logExpenseEvent({
          expenseId: data.id,
          actorId: user.id,
          action: "submitted",
          fromStatus: "draft",
          toStatus: finalStatus,
        });
      }
    } catch {
      /* best-effort history */
    }

    if (attachment) {
      const { error: attErr } = await supabase.from("expense_attachments").insert({
        expense_id: data.id,
        file_path: attachment.path,
        file_name: attachment.name,
        mime_type: attachment.mime,
        size_bytes: attachment.size,
        created_by: user.id,
      });
      if (attErr) toast.error(`Saved, but attachment failed: ${attErr.message}`);
    }

    setSaving(false);
    toast.success(`Marketing cost ${data.expense_number} submitted.`);
    navigate({ to: "/expenses/$id", params: { id: data.id } });
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Add Marketing Cost"
        description="Foreign currency is converted to BDT automatically. It must be approved before counting in reports."
        actions={
          <Button variant="outline" asChild>
            <Link to="/marketing">
              <ArrowLeft className="h-4 w-4" />
              Marketing
            </Link>
          </Button>
        }
      />

      {loading ? (
        <Skeleton className="h-[620px] w-full rounded-lg" />
      ) : (
        <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Marketing cost details</CardTitle>
              </CardHeader>
              <CardContent>
                <MarketingFields
                  value={form}
                  onChange={patch}
                  platforms={platforms}
                  currencies={currencies}
                />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Reference</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex items-start gap-3 rounded-md bg-brand-gradient-soft p-3">
                  <Hash className="mt-0.5 h-4 w-4 text-brand-to" />
                  <div>
                    <p className="font-medium text-foreground">Expense number</p>
                    <p className="text-muted-foreground">
                      Auto-generated on save (EXP-{new Date().getFullYear()}-000001)
                    </p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Created by</p>
                  <p className="font-medium text-foreground">
                    {profile?.full_name?.trim() || user?.email}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Attachment</CardTitle>
              </CardHeader>
              <CardContent>
                <AttachmentUploader
                  value={attachment}
                  onChange={setAttachment}
                  prefix={`${user?.id ?? "u"}/`}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Invoices, screenshots, receipts or PDF files.
                </p>
              </CardContent>
            </Card>

            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
              Submit marketing cost
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
