import { ShieldX } from "lucide-react";

export function NoAccess() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 px-6 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-md bg-destructive/10 text-destructive">
        <ShieldX className="h-7 w-7" />
      </div>
      <h2 className="mt-5 text-lg font-medium text-foreground">Access restricted</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        You don't have permission to view this section. Contact an administrator if you
        believe this is a mistake.
      </p>
    </div>
  );
}