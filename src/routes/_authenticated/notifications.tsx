import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Motion IT BD" }] }),
  component: NotificationsInbox,
});

function NotificationsInbox() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Notifications"
        description="Your in-app notification center."
      />
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 px-6 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Bell className="h-7 w-7" />
        </div>
        <h2 className="mt-5 text-lg font-medium text-foreground">You're all caught up</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Notification infrastructure is in place for In-App, Email, and Telegram channels.
          Configure channels in Settings → Notification Settings.
        </p>
      </div>
    </div>
  );
}