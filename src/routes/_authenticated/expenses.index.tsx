import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  Plus,
  Receipt,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkActionBar } from "@/components/bulk/BulkActionBar";
import { BulkScopeMenu, type BulkKind } from "@/components/bulk/BulkScopeMenu";
import { useBulkExport } from "@/hooks/use-bulk-export";
import type { BulkExportConfig, BulkScope } from "@/lib/bulk-export";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  EXPENSE_STATUS,
  fetchCategories,
  fetchSubcategories,
  fetchUserNames,
  formatCurrency,
  formatDate,
  type Expense,
  type ExpenseCategory,
  type ExpenseStatus,
  type ExpenseSubcategory,
} from "@/lib/expenses";

export const Route = createFileRoute("/_authenticated/expenses/")({
  head: () => ({ meta: [{ title: "All Expenses — Motion IT BD" }] }),
  component: ExpensesListPage,
});

const PAGE_SIZE = 10;
const ALL = "all";
type SortField = "expense_number" | "expense_date" | "amount" | "status";

interface Filters {
  category: string;
  subcategory: string;
  status: string;
  createdBy: string;
  dateFrom: string;
  dateTo: string;
  amountMin: string;
  amountMax: string;
}

const EMPTY_FILTERS: Filters = {
  category: ALL,
  subcategory: ALL,
  status: ALL,
  createdBy: ALL,
  dateFrom: "",
  dateTo: "",
  amountMin: "",
  amountMax: "",
};

function sanitize(term: string) {
  return term.replace(/[(),]/g, " ").trim();
}

function ExpensesListPage() {
  const { canAccessModule, can, isAdmin, profile } = useAuth();
  const navigate = useNavigate();

  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [subs, setSubs] = useState<ExpenseSubcategory[]>([]);
  const [creators, setCreators] = useState<{ id: string; name: string }[]>([]);

  const [rows, setRows] = useState<Expense[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  const [sortField, setSortField] = useState<SortField>("expense_date");
  const [sortAsc, setSortAsc] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const canView = canAccessModule("expenses");
  const canCreate = isAdmin || can("expenses", "edit");
  const canExport = isAdmin || can("expenses", "export");

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const subMap = useMemo(() => new Map(subs.map((s) => [s.id, s.name])), [subs]);

  // Names cache for created_by — kept current so bulk exports of rows from
  // other pages still resolve the author's name.
  const namesRef = useRef<Record<string, string>>({});
  useEffect(() => {
    namesRef.current = { ...namesRef.current, ...names };
  }, [names]);

  // Reference data (categories, subcategories, creators)
  useEffect(() => {
    Promise.all([fetchCategories(true), fetchSubcategories(true)])
      .then(([c, s]) => {
        setCategories(c);
        setSubs(s);
      })
      .catch(() => undefined);
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .order("full_name")
      .then(({ data }) =>
        setCreators(
          (data ?? []).map((p) => ({ id: p.id, name: p.full_name?.trim() || p.email || "—" })),
        ),
      );
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Shared filter+search builder so the on-screen list and bulk exports stay
  // perfectly in sync with the active filters.
  const applyFilters = useCallback(
    (q: ReturnType<typeof supabase.from>) => {
      if (filters.category !== ALL) q = q.eq("category_id", filters.category);
      if (filters.subcategory !== ALL) q = q.eq("subcategory_id", filters.subcategory);
      if (filters.createdBy !== ALL) q = q.eq("created_by", filters.createdBy);
      if (filters.dateFrom) q = q.gte("expense_date", filters.dateFrom);
      if (filters.dateTo) q = q.lte("expense_date", filters.dateTo);
      if (filters.amountMin) q = q.gte("amount", Number(filters.amountMin));
      if (filters.amountMax) q = q.lte("amount", Number(filters.amountMax));

      if (filters.status !== ALL) {
        q = q.eq("status", filters.status as ExpenseStatus);
      } else {
        q = q.neq("status", "deleted");
      }

      const s = sanitize(search);
      if (s) {
        const like = `%${s}%`;
        const ors = [
          `expense_number.ilike.${like}`,
          `description.ilike.${like}`,
          `notes.ilike.${like}`,
        ];
        const lc = s.toLowerCase();
        const catIds = categories.filter((c) => c.name.toLowerCase().includes(lc)).map((c) => c.id);
        const subIds = subs.filter((x) => x.name.toLowerCase().includes(lc)).map((x) => x.id);
        if (catIds.length) ors.push(`category_id.in.(${catIds.join(",")})`);
        if (subIds.length) ors.push(`subcategory_id.in.(${subIds.join(",")})`);
        if (!Number.isNaN(Number(s))) ors.push(`amount.eq.${Number(s)}`);
        q = q.or(ors.join(","));
      }
      return q;
    },
    [filters, search, categories, subs],
  );

  const load = useCallback(async () => {
    setLoading(true);
    let q = applyFilters(supabase.from("expenses").select("*", { count: "exact" }));
    q = q.order(sortField, { ascending: sortAsc });
    q = q.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    const { data, count, error } = await q;
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const list = (data ?? []) as Expense[];
    setRows(list);
    setTotal(count ?? 0);
    setNames(await fetchUserNames(list.map((r) => r.created_by ?? "")));
    setLoading(false);
  }, [applyFilters, sortField, sortAsc, page]);

  useEffect(() => {
    if (canView) load();
  }, [load, canView]);

  if (!canView) {
    return (
      <div className="space-y-8">
        <PageHeader title="All Expenses" />
        <NoAccess />
      </div>
    );
  }

  function setFilter(patch: Partial<Filters>) {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(0);
  }

  function toggleSort(field: SortField) {
    if (sortField === field) setSortAsc((a) => !a);
    else {
      setSortField(field);
      setSortAsc(false);
    }
    setPage(0);
  }

  const activeFilterCount = Object.entries(filters).filter(
    ([, v]) => v && v !== ALL,
  ).length;
  const filterSubs = subs.filter(
    (s) => filters.category === ALL || s.category_id === filters.category,
  );
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <PageHeader
        title="All Expenses"
        description="Browse, filter, and manage every recorded expense."
        actions={
          canCreate && (
            <Button asChild>
              <Link to="/expenses/add">
                <Plus className="h-4 w-4" />
                Add expense
              </Link>
            </Button>
          )
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search number, category, description, notes, amount…"
            className="pl-9"
          />
          {searchInput && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearchInput("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button
          variant="outline"
          onClick={() => setFiltersOpen((o) => !o)}
          className={activeFilterCount ? "border-brand-to/40" : undefined}
        >
          <Filter className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-gradient px-1.5 text-xs font-medium text-brand-foreground">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <CollapsibleContent>
          <Card>
            <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={filters.category}
                  onValueChange={(v) => setFilter({ category: v, subcategory: ALL })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All categories</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Subcategory</Label>
                <Select
                  value={filters.subcategory}
                  onValueChange={(v) => setFilter({ subcategory: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All subcategories</SelectItem>
                    {filterSubs.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={filters.status} onValueChange={(v) => setFilter({ status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All statuses</SelectItem>
                    {(Object.keys(EXPENSE_STATUS) as ExpenseStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>{EXPENSE_STATUS[s].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Created by</Label>
                <Select value={filters.createdBy} onValueChange={(v) => setFilter({ createdBy: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Anyone</SelectItem>
                    {creators.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Date from</Label>
                <Input type="date" value={filters.dateFrom} onChange={(e) => setFilter({ dateFrom: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Date to</Label>
                <Input type="date" value={filters.dateTo} onChange={(e) => setFilter({ dateTo: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Amount min</Label>
                <Input type="number" min="0" step="0.01" value={filters.amountMin} onChange={(e) => setFilter({ amountMin: e.target.value })} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label>Amount max</Label>
                <Input type="number" min="0" step="0.01" value={filters.amountMax} onChange={(e) => setFilter({ amountMax: e.target.value })} placeholder="0.00" />
              </div>
              <div className="flex items-end">
                <Button variant="ghost" onClick={() => { setFilters(EMPTY_FILTERS); setPage(0); }}>
                  <X className="h-4 w-4" />
                  Clear filters
                </Button>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHead label="Expense No." field="expense_number" {...{ sortField, sortAsc, toggleSort }} />
                  <SortHead label="Date" field="expense_date" {...{ sortField, sortAsc, toggleSort }} />
                  <TableHead>Category</TableHead>
                  <TableHead>Subcategory</TableHead>
                  <SortHead label="Amount" field="amount" className="text-right" {...{ sortField, sortAsc, toggleSort }} />
                  <SortHead label="Status" field="status" {...{ sortField, sortAsc, toggleSort }} />
                  <TableHead>Created by</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 8 }).map((__, j) => (
                        <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <span className="flex h-12 w-12 items-center justify-center rounded-md bg-brand-gradient-soft text-brand-to">
                          <Receipt className="h-6 w-6" />
                        </span>
                        <p className="mt-4 font-medium text-foreground">No expenses found</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {search || activeFilterCount ? "Try adjusting your search or filters." : "Submit your first expense to get started."}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer"
                      onClick={() => navigate({ to: "/expenses/$id", params: { id: r.id } })}
                    >
                      <TableCell className="font-medium">{r.expense_number}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(r.expense_date)}</TableCell>
                      <TableCell>{r.category_id ? catMap.get(r.category_id) ?? "—" : "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{r.subcategory_id ? subMap.get(r.subcategory_id) ?? "—" : "—"}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatCurrency(r.amount)}</TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                      <TableCell className="text-muted-foreground">{r.created_by ? names[r.created_by] ?? "—" : "—"}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" aria-label="View expense" asChild>
                          <Link to="/expenses/$id" params={{ id: r.id }}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-sm text-muted-foreground">
          {total === 0 ? "No results" : `Showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} of ${total}`}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function SortHead({
  label,
  field,
  sortField,
  sortAsc,
  toggleSort,
  className,
}: {
  label: string;
  field: SortField;
  sortField: SortField;
  sortAsc: boolean;
  toggleSort: (f: SortField) => void;
  className?: string;
}) {
  const active = sortField === field;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => toggleSort(field)}
        className={`inline-flex items-center gap-1 hover:text-foreground ${active ? "text-foreground" : ""} ${className?.includes("text-right") ? "flex-row-reverse" : ""}`}
      >
        {label}
        <ArrowUpDown className={`h-3.5 w-3.5 ${active ? "text-brand-to" : "text-muted-foreground"}`} />
      </button>
    </TableHead>
  );
}