import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { fetchUnreadCount } from "@/lib/notifications";

/**
 * Live unread-notification counter. Subscribes to realtime inserts/updates on
 * the current user's notifications and refreshes the badge count.
 */
export function useUnreadNotifications() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      setCount(await fetchUnreadCount());
    } catch {
      /* ignore transient errors */
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }
    refresh();
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  return { count, refresh };
}