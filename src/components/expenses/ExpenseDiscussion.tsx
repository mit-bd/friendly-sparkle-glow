import { useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  addExpenseComment,
  fetchExpenseComments,
  type ExpenseComment,
} from "@/lib/approvals";
import { formatDateTime } from "@/lib/expenses";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ExpenseDiscussion({
  expenseId,
  names,
  canComment,
}: {
  expenseId: string;
  names: Record<string, string>;
  canComment: boolean;
}) {
  const { user } = useAuth();
  const [comments, setComments] = useState<ExpenseComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      setComments(await fetchExpenseComments(expenseId));
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`expense-comments-${expenseId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "expense_comments", filter: `expense_id=eq.${expenseId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenseId]);

  async function handleSend() {
    if (!user || !body.trim()) return;
    setSending(true);
    try {
      await addExpenseComment({ expenseId, authorId: user.id, body: body.trim() });
      setBody("");
      await load();
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to post comment.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No comments yet. Start the discussion below.
        </p>
      ) : (
        <div className="space-y-4">
          {comments.map((c) => {
            const name = names[c.author_id] ?? "User";
            const mine = c.author_id === user?.id;
            return (
              <div key={c.id} className="flex gap-3">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {mine ? "You" : name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(c.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap rounded-md bg-muted/60 px-3 py-2 text-sm text-foreground">
                    {c.body}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
      )}

      {canComment && (
        <div className="space-y-2 border-t border-border pt-4">
          <Textarea
            rows={2}
            maxLength={2000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a comment…"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSend();
            }}
          />
          <div className="flex justify-end">
            <Button size="sm" disabled={sending || !body.trim()} onClick={handleSend}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Post comment
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}