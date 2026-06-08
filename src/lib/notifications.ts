import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/audit";

const db = supabase as unknown as {
  from: (table: string) => any;
};

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  expense_id: string | null;
  return_id: string | null;
  damage_id: string | null;
  read_at: string | null;
  created_at: string;
}

export async function fetchNotifications(limit = 100): Promise<AppNotification[]> {
  const { data, error } = await db
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AppNotification[];
}

export async function fetchUnreadCount(): Promise<number> {
  const { count, error } = await db
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await db
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  void logActivity({
    action: "update",
    entityType: "notification",
    entityId: id,
    entityLabel: "Notification read",
    metadata: { event: "notification_read" },
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await db
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) throw error;
  void logActivity({
    action: "update",
    entityType: "notification",
    entityLabel: "All notifications read",
    metadata: { event: "notification_read_all" },
  });
}

export async function deleteNotification(id: string): Promise<void> {
  const { error } = await db.from("notifications").delete().eq("id", id);
  if (error) throw error;
}