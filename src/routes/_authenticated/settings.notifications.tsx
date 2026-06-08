import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, MessageSquare, Mail, Bell } from "lucide-react";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/settings/notifications")({
  head: () => ({ meta: [{ title: "Notification Settings — Expense Management System" }] }),
  component: NotificationSettingsPage,
});

interface ChannelRow {
  id: string;
  channel: string;
  enabled: boolean;
}

const CHANNEL_META: Record<string, { label: string; description: string; icon: LucideIcon }> = {
  in_app: {
    label: "In-App Notifications",
    description: "Show alerts inside the application notification center.",
    icon: Bell,
  },
  email: {
    label: "Email Notifications",
    description: "Send notifications to users' email addresses.",
    icon: Mail,
  },
  telegram: {
    label: "Telegram Notifications",
    description: "Deliver notifications through a Telegram bot.",
    icon: MessageSquare,
  },
};

const ORDER = ["in_app", "email", "telegram"];

function NotificationSettingsPage() {
  const { can } = useAuth();
  const [rows, setRows] = useState<ChannelRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("notification_settings")
      .select("id, channel, enabled")
      .then(({ data }) => {
        const list = (data as ChannelRow[]) ?? [];
        list.sort((a, b) => ORDER.indexOf(a.channel) - ORDER.indexOf(b.channel));
        setRows(list);
        setLoading(false);
      });
  }, []);

  if (!can("settings", "view")) {
    return (
      <div className="space-y-8">
        <PageHeader title="Notification Settings" />
        <NoAccess />
      </div>
    );
  }

  async function toggle(row: ChannelRow, enabled: boolean) {
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, enabled } : r)));
    const { error } = await supabase
      .from("notification_settings")
      .update({ enabled })
      .eq("id", row.id);
    if (error) {
      toast.error(error.message);
      setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, enabled: !enabled } : r)));
      return;
    }
    toast.success(`${CHANNEL_META[row.channel]?.label ?? row.channel} ${enabled ? "enabled" : "disabled"}.`);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Notification Settings"
        description="Enable or disable delivery channels. Channels power future expense notifications."
      />
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {rows.map((row) => {
              const meta = CHANNEL_META[row.channel];
              const Icon = meta?.icon ?? Bell;
              return (
                <div key={row.id} className="flex items-center gap-4 px-6 py-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="flex-1 space-y-0.5">
                    <Label htmlFor={`ch-${row.id}`} className="text-sm font-medium">
                      {meta?.label ?? row.channel}
                    </Label>
                    <p className="text-sm text-muted-foreground">{meta?.description}</p>
                  </div>
                  <Switch
                    id={`ch-${row.id}`}
                    checked={row.enabled}
                    onCheckedChange={(v) => toggle(row, v)}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}