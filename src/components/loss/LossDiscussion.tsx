import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime } from "@/lib/expenses";
import { postLossComment, type LossEvent, type LossKind } from "@/lib/loss";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export function LossDiscussion({
  kind,
  recordId,
  comments,
  names,
  canComment,
  onPosted,
}: {
  kind: LossKind;
  recordId: string;
  comments: LossEvent[];
  names: Record<string, string>;
  canComment: boolean;
  onPosted: () => void;
}) {
  const { user } = useAuth();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!user || !body.trim()) return;
    setSending(true);
    try {
      await postLossComment(kind, recordId, user.id, body.trim());
      setBody("");
      onPosted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to post comment.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet. Start the discussion below.</p>
      ) : (
        <div className="space-y-4">
          {comments.map((c) => {
            const name = c.actor_id ? names[c.actor_id] ?? "User" : "User";
            const mine = c.actor_id === user?.id;
            return (
              <div key={c.id} className="flex gap-3">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-foreground">{mine ? "You" : name}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(c.created_at)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap rounded-md bg-muted/60 px-3 py-2 text-sm text-foreground">{c.notes}</p>
                </div>
              </div>
            );
          })}
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