import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
  Trash2,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime } from "@/lib/expenses";
import {
  deleteNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/notifications";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Motion IT BD" }] }),
  component: NotificationCenter,
});

const TYPE_META: Record<string, { icon: LucideIcon; tone: string }> = {
  expense_submitted: { icon: Clock, tone: "bg-chart-4/15 text-chart-4" },
  expense_pending: { icon: Clock, tone: "bg-chart-1/15 text-chart-1" },
  expense_approved: { icon: CheckCircle2, tone: "bg-chart-2/15 text-chart-2" },
  expense_rejected: { icon: XCircle, tone: "bg-destructive/15 text-destructive" },
  expense_revision: { icon: RotateCcw, tone: "bg-warning/15 text-warning" },
  expense_updated: { icon: Bell, tone: "bg-muted text-muted-foreground" },
  return_submitted: { icon: Clock, tone: "bg-chart-4/15 text-chart-4" },
  return_pending: { icon: Clock, tone: "bg-chart-1/15 text-chart-1" },
  return_approved: { icon: CheckCircle2, tone: "bg-chart-2/15 text-chart-2" },
  return_rejected: { icon: XCircle, tone: "bg-destructive/15 text-destructive" },
  return_revision: { icon: RotateCcw, tone: "bg-warning/15 text-warning" },
  return_updated: { icon: Bell, tone: "bg-muted text-muted-foreground" },
  damage_submitted: { icon: Clock, tone: "bg-chart-4/15 text-chart-4" },
  damage_pending: { icon: Clock, tone: "bg-chart-1/15 text-chart-1" },
  damage_approved: { icon: CheckCircle2, tone: "bg-chart-2/15 text-chart-2" },
  damage_rejected: { icon: XCircle, tone: "bg-destructive/15 text-destructive" },
  damage_revision: { icon: RotateCcw, tone: "bg-warning/15 text-warning" },
  damage_updated: { icon: Bell, tone: "bg-muted text-muted-foreground" },
};

function NotificationCenter() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"unread" | "all">("unread");
  const [marking, setMarking] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await fetchNotifications());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    load();
    const channel = supabase
      .channel(`notif-center-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, load]);

  const unread = items.filter((n) => !n.read_at);
  const visible = tab === "unread" ? unread : items;

  async function openItem(n: AppNotification) {
    if (!n.read_at) {
      try {
        await markNotificationRead(n.id);
        setItems((cur) => cur.map((i) => (i.id === n.id ? { ...i, read_at: new Date().toISOString() } : i)));
      } catch {
        /* ignore */
      }
    }
    if (n.expense_id) navigate({ to: "/expenses/$id", params: { id: n.expense_id } });
    else if (n.return_id) navigate({ to: "/returns/$id", params: { id: n.return_id } });
    else if (n.damage_id) navigate({ to: "/damages/$id", params: { id: n.damage_id } });
  }

  async function markAll() {
    setMarking(true);
    try {
      await markAllNotificationsRead();
      await load();
      toast.success("All notifications marked as read.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update notifications.");
    } finally {
      setMarking(false);
    }
  }

  async function remove(id: string) {
    setItems((cur) => cur.filter((i) => i.id !== id));
    try {
      await deleteNotification(id);
    } catch {
      load();
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Stay on top of expense submissions, approvals, and revisions."
        actions={
          unread.length > 0 && (
            <Button variant="outline" onClick={markAll} disabled={marking}>
              {marking ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
              Mark all as read
            </Button>
          )
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as "unread" | "all")}>
        <TabsList>
          <TabsTrigger value="unread">
            Unread{unread.length > 0 ? ` (${unread.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 px-6 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-md bg-brand-gradient-soft text-brand-to">
            <Bell className="h-7 w-7" />
          </div>
          <h2 className="mt-5 text-lg font-medium text-foreground">You're all caught up</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {tab === "unread"
              ? "No unread notifications right now."
              : "Notifications about expense activity will show up here."}
          </p>
        </div>
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {visible.map((n) => {
              const meta = TYPE_META[n.type] ?? { icon: Bell, tone: "bg-muted text-muted-foreground" };
              const Icon = meta.icon;
              return (
                <div
                  key={n.id}
                  className={cn(
                    "flex items-start gap-4 px-5 py-4 transition-colors",
                    (n.expense_id || n.return_id || n.damage_id) && "cursor-pointer hover:bg-accent/50",
                    !n.read_at && "bg-brand-gradient-soft/40",
                  )}
                  onClick={() => openItem(n)}
                >
                  <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full", meta.tone)}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {!n.read_at && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-gradient" aria-hidden />}
                      <p className="text-sm font-medium text-foreground">{n.title}</p>
                    </div>
                    {n.body && <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(n.created_at)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete notification"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(n.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}