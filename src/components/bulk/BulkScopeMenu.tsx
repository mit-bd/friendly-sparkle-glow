import { ChevronDown, FileDown, FileSpreadsheet, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BulkScope } from "@/lib/bulk-export";

export type BulkKind = "print" | "pdf" | "csv";

interface BulkScopeMenuProps {
  busy?: boolean;
  /** Scopes to offer (defaults to filtered + all). */
  scopes?: BulkScope[];
  onAction: (scope: BulkScope, kind: BulkKind) => void;
}

const SCOPE_TITLE: Record<BulkScope, string> = {
  selected: "Selected records",
  filtered: "Current filter result",
  all: "Entire result set",
};

/**
 * Header dropdown that exports a whole scope (current filter result or the
 * entire result set) without requiring a manual selection. Only rendered for
 * users with export rights.
 */
export function BulkScopeMenu({
  busy,
  scopes = ["filtered", "all"],
  onAction,
}: BulkScopeMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={busy}>
          <FileDown className="h-4 w-4" />
          Export
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {scopes.map((scope, i) => (
          <div key={scope}>
            {i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {SCOPE_TITLE[scope]}
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onAction(scope, "print")}>
              <Printer className="h-4 w-4" />
              Print
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction(scope, "pdf")}>
              <FileDown className="h-4 w-4" />
              PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction(scope, "csv")}>
              <FileSpreadsheet className="h-4 w-4" />
              CSV
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}