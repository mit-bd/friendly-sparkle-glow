import { createFileRoute } from "@/lib/router";
import { Monitor, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePreferences, type PageSize } from "@/lib/preferences";
import { playNotificationChime } from "@/lib/notification-sound";
import { RANGE_PRESETS, type RangePreset } from "@/lib/analytics";
import { useTheme } from "@/lib/theme-provider";

export const Route = createFileRoute("/_authenticated/settings/preferences")({
  head: () => ({ meta: [{ title: "User Preferences — Motion IT BD" }] }),
  component: PreferencesPage,
});

const PAGE_SIZES: PageSize[] = [10, 25, 50, 100];

function PreferencesPage() {
  const { prefs, update, reset } = usePreferences();
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Preferences"
        description="Personalise your experience. These settings are saved on this device."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              reset();
              toast.success("Preferences reset to defaults.");
            }}
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Display</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Label className="flex items-center gap-2">
                <Monitor className="h-4 w-4" /> Theme
              </Label>
              <p className="text-xs text-muted-foreground">Light or dark appearance.</p>
            </div>
            <Select value={theme} onValueChange={(v) => setTheme(v as "light" | "dark")}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Label>Preferred date range</Label>
              <p className="text-xs text-muted-foreground">Default range applied on the dashboard.</p>
            </div>
            <Select
              value={prefs.defaultRange}
              onValueChange={(v) => update({ defaultRange: v as RangePreset })}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGE_PRESETS.filter((p) => p.value !== "custom").map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Label>Table page size</Label>
              <p className="text-xs text-muted-foreground">Rows shown per page in tables.</p>
            </div>
            <Select
              value={String(prefs.pageSize)}
              onValueChange={(v) => update({ pageSize: Number(v) as PageSize })}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s} rows
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <Label>Live notification alerts</Label>
              <p className="text-xs text-muted-foreground">
                Pop up a toast when a new notification arrives (approvals, submissions…).
              </p>
            </div>
            <Switch
              checked={prefs.notifyInApp}
              onCheckedChange={(v) => update({ notifyInApp: v })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Notification sound</Label>
              <p className="text-xs text-muted-foreground">
                Play a subtle chime when a new notification arrives.
              </p>
            </div>
            <Switch
              checked={prefs.notifySound}
              onCheckedChange={(v) => {
                update({ notifySound: v });
                if (v) playNotificationChime();
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>In-app toasts</Label>
              <p className="text-xs text-muted-foreground">
                Show pop-up confirmations for actions in this browser.
              </p>
            </div>
            <Switch
              checked={prefs.notifyToasts}
              onCheckedChange={(v) => update({ notifyToasts: v })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
