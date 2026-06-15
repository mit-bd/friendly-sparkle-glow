import { useCallback, useEffect, useRef, useState } from "react";

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
  // Unique per hook instance so multiple consumers (topbar + bottom nav) don't
  // collide on the same realtime channel name (which throws after subscribe()).
  const channelIdRef = useRef(Math.random().toString(36).slice(2));

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
      .channel(`notifications-${user.id}-${channelIdRef.current}`)
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