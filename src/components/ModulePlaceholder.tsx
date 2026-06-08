import type { LucideIcon } from "lucide-react";

import { PageHeader } from "./PageHeader";

interface ModulePlaceholderProps {
  title: string;
  description: string;
  icon: LucideIcon;
  note?: string;
}

export function ModulePlaceholder({
  title,
  description,
  icon: Icon,
  note,
}: ModulePlaceholderProps) {
  return (
    <div className="space-y-8">
      <PageHeader title={title} description={description} />
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 px-6 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-7 w-7" />
        </div>
        <h2 className="mt-5 text-lg font-medium text-foreground">Module ready for build-out</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {note ??
            "This module is scaffolded on top of the shared audit, permission, and branding architecture. Detailed workflows can be added without restructuring."}
        </p>
      </div>
    </div>
  );
}