import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { readPreferences } from "@/lib/preferences";
import { playNotificationChime } from "@/lib/notification-sound";
import type { AppNotification } from "@/lib/notifications";

/**
 * Global, app-wide listener for the signed-in user's notifications.
 *
 * Subscribes once to realtime INSERT events on the user's notification rows.
 * Because it only reacts to live INSERTs (never to a fetch/list render), the
 * chime + toast fire ONLY for genuinely new notifications and never replay
 * when the user opens the notification panel. The unread badge and panel keep
 * their own subscriptions, so the whole system updates with no refresh.
 */
export function NotificationListener() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const mountedAt = useRef<number>(Date.now());

  useEffect(() => {
    if (!user) return;
    mountedAt.current = Date.now();

    const channel = supabase
      .channel(`notif-live-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as AppNotification;
          // Guard against any historical row replays.
          if (n.created_at && Date.now() - new Date(n.created_at).getTime() > 60_000) {
            return;
          }
          const prefs = readPreferences();
          if (prefs.notifySound) playNotificationChime();
          if (prefs.notifyInApp) {
            toast(n.title, {
              description: n.body ?? undefined,
              action: n.expense_id || n.return_id || n.damage_id
                ? {
                    label: "View",
                    onClick: () => {
                      if (n.expense_id) navigate({ to: "/expenses/$id", params: { id: n.expense_id } });
                      else if (n.return_id) navigate({ to: "/returns/$id", params: { id: n.return_id } });
                      else if (n.damage_id) navigate({ to: "/damages/$id", params: { id: n.damage_id } });
                    },
                  }
                : undefined,
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, navigate]);

  return null;
}