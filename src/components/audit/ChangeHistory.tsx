import { ArrowRight, History } from "lucide-react";

import { formatDateTime } from "@/lib/expenses";
import type { FieldChange } from "@/lib/audit";

export function ChangeHistory({
  changes,
  names,
}: {
  changes: FieldChange[];
  names: Record<string, string>;
}) {
  if (changes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <History className="h-5 w-5" />
        </span>
        <p className="mt-3 text-sm text-muted-foreground">No field changes recorded yet.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {changes.map((c) => {
        const who = c.changed_by ? names[c.changed_by] ?? "Someone" : "System";
        return (
          <li key={c.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground">{c.field}</span>
              <span className="text-xs text-muted-foreground">{formatDateTime(c.changed_at)}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded bg-destructive/10 px-2 py-0.5 text-destructive line-through">
                {c.old_value || "—"}
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="rounded bg-chart-2/15 px-2 py-0.5 text-chart-2">
                {c.new_value || "—"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Changed by {who}</p>
          </li>
        );
      })}
    </ul>
  );
}
