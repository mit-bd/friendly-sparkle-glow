import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  FilePlus2,
  Send,
  Pencil,
  Trash2,
  Undo2,
  MessageSquare,
  Paperclip,
  type LucideIcon,
} from "lucide-react";

import { ACTION_LABELS, type ExpenseAction, type ExpenseEvent } from "@/lib/approvals";
import { formatDateTime } from "@/lib/expenses";
import { cn } from "@/lib/utils";

const ACTION_ICON: Record<ExpenseAction, LucideIcon> = {
  created: FilePlus2,
  submitted: Send,
  approved: CheckCircle2,
  rejected: XCircle,
  revision_requested: RotateCcw,
  updated: Pencil,
  deleted: Trash2,
  restored: Undo2,
  attachment_added: Paperclip,
  attachment_removed: Paperclip,
  comment: MessageSquare,
};

const ACTION_TONE: Record<ExpenseAction, string> = {
  created: "bg-muted text-muted-foreground",
  submitted: "bg-chart-4/15 text-chart-4",
  approved: "bg-chart-2/15 text-chart-2",
  rejected: "bg-destructive/15 text-destructive",
  revision_requested: "bg-warning/15 text-warning",
  updated: "bg-chart-1/15 text-chart-1",
  deleted: "bg-muted text-muted-foreground",
  restored: "bg-chart-2/15 text-chart-2",
  attachment_added: "bg-chart-4/15 text-chart-4",
  attachment_removed: "bg-muted text-muted-foreground",
  comment: "bg-muted text-muted-foreground",
};

export function ExpenseTimeline({
  events,
  names,
}: {
  events: ExpenseEvent[];
  names: Record<string, string>;
}) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No approval history yet.</p>
    );
  }

  return (
    <ol className="relative space-y-6 pl-2">
      {events.map((ev, i) => {
        const Icon = ACTION_ICON[ev.action] ?? Pencil;
        const tone = ACTION_TONE[ev.action] ?? "bg-muted text-muted-foreground";
        const actor = ev.actor_id ? names[ev.actor_id] ?? "Someone" : "System";
        return (
          <li key={ev.id} className="relative flex gap-3">
            {i < events.length - 1 && (
              <span
                className="absolute left-[15px] top-9 h-[calc(100%+0.25rem)] w-px bg-border"
                aria-hidden
              />
            )}
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                tone,
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm font-medium text-foreground">
                {ACTION_LABELS[ev.action] ?? ev.action}
                <span className="font-normal text-muted-foreground"> · {actor}</span>
              </p>
              <p className="text-xs text-muted-foreground">{formatDateTime(ev.created_at)}</p>
              {ev.notes && (
                <p className="mt-1.5 whitespace-pre-wrap rounded-md bg-muted/60 px-3 py-2 text-sm text-foreground">
                  {ev.notes}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}