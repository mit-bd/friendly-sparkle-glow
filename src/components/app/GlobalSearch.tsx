import { useEffect, useMemo, useState } from "react";
import { useRouter } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import {
  Receipt,
  Megaphone,
  Undo2,
  PackageX,
  FolderTree,
  Tag,
  Users,
  FileBarChart,
  Search,
  Loader2,
  type LucideIcon,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  globalSearch,
  ENTITY_LABELS,
  type SearchEntity,
  type SearchResult,
} from "@/lib/search";
import { EXPENSE_STATUS, formatDate, type ExpenseStatus } from "@/lib/expenses";
import { cn } from "@/lib/utils";

const ENTITY_ICON: Record<SearchEntity, LucideIcon> = {
  expense: Receipt,
  marketing: Megaphone,
  return: Undo2,
  damage: PackageX,
  category: FolderTree,
  subcategory: Tag,
  user: Users,
  report: FileBarChart,
};

const ENTITY_ORDER: SearchEntity[] = [
  "expense",
  "marketing",
  "return",
  "damage",
  "report",
  "category",
  "subcategory",
  "user",
];

function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function ResultStatus({ result }: { result: SearchResult }) {
  if (!result.status) return null;
  if (result.entity === "user") {
    return (
      <Badge variant="outline" className="text-xs">
        {result.status === "active" ? "Active" : "Inactive"}
      </Badge>
    );
  }
  const meta = EXPENSE_STATUS[result.status as ExpenseStatus];
  if (!meta) return null;
  return (
    <Badge variant="outline" className={cn(meta.badge, "text-xs font-medium")}>
      {meta.label}
    </Badge>
  );
}

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const debounced = useDebounced(term);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) setTerm("");
  }, [open]);

  const { data, isFetching } = useQuery({
    queryKey: ["global-search", debounced],
    queryFn: () => globalSearch(debounced),
    enabled: open && debounced.trim().length >= 2,
    staleTime: 15_000,
  });

  const grouped = useMemo(() => {
    const map = new Map<SearchEntity, SearchResult[]>();
    for (const r of data ?? []) {
      const list = map.get(r.entity) ?? [];
      list.push(r);
      map.set(r.entity, list);
    }
    return ENTITY_ORDER.filter((e) => map.has(e)).map((e) => ({
      entity: e,
      items: map.get(e)!,
    }));
  }, [data]);

  function openResult(result: SearchResult) {
    setOpen(false);
    // Route paths are dynamic; cast keeps strict typing happy.
    router.navigate({ to: result.to, params: result.params } as never);
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="hidden gap-2 text-muted-foreground sm:flex"
      >
        <Search className="h-4 w-4" />
        <span>Search…</span>
        <kbd className="ml-2 hidden rounded border border-border bg-muted px-1.5 text-[10px] font-medium md:inline">
          ⌘K
        </kbd>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Search"
        onClick={() => setOpen(true)}
        className="sm:hidden"
      >
        <Search className="h-5 w-5" />
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          value={term}
          onValueChange={setTerm}
          placeholder="Search expenses, marketing, returns, damages, users…"
        />
        <CommandList>
          {debounced.trim().length < 2 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Type at least 2 characters to search across all modules.
            </div>
          ) : isFetching ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching…
            </div>
          ) : (
            <>
              <CommandEmpty>No matching records found.</CommandEmpty>
              {grouped.map(({ entity, items }) => {
                const Icon = ENTITY_ICON[entity];
                return (
                  <CommandGroup key={entity} heading={ENTITY_LABELS[entity]}>
                    {items.map((r) => (
                      <CommandItem
                        key={`${entity}-${r.id}`}
                        value={`${entity} ${r.number ?? ""} ${r.title}`}
                        onSelect={() => openResult(r)}
                        className="gap-3"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-gradient-soft text-brand">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {r.number && (
                              <span className="font-medium text-foreground">{r.number}</span>
                            )}
                            <span className="truncate text-sm text-muted-foreground">
                              {r.title}
                            </span>
                          </div>
                          {r.date && (
                            <span className="text-xs text-muted-foreground">
                              {formatDate(r.date)}
                            </span>
                          )}
                        </div>
                        <ResultStatus result={r} />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                );
              })}
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
