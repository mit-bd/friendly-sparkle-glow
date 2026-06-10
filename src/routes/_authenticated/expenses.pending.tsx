import { createFileRoute } from '@tanstack/react-router'
import { createFileRoute, Link, useNavigate } from "@/lib/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Filter,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { StatusBadge } from "@/components/StatusBadge";
import { ApprovalPanel } from "@/components/expenses/ApprovalPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
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
  formatDateTime,
  type Expense,
  type ExpenseCategory,
  type ExpenseStatus,
  type ExpenseSubcategory,
} from "@/lib/expenses";

export const Route = createFileRoute("/_authenticated/expenses/pending")({
  head: () => ({ meta: [{ title: "Pending Approvals — Motion IT BD" }] }),
  component: PendingApprovalsPage,
});

const PAGE_SIZE = 10;
const ALL = "all";
const QUEUE_STATUSES: ExpenseStatus[] = ["submitted", "pending_approval", "revision_requested"];
type SortField = "expense_number" | "expense_date" | "amount" | "submitted_at";

function PendingApprovalsPage() {
  const { isAdmin, can } = useAuth();
  const navigate = useNavigate();
  const canApprove = isAdmin || can("expenses", "approve");

  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [subs, setSubs] = useState<ExpenseSubcategory[]>([]);
  const [rows, setRows] = useState<Expense[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL);
  const [page, setPage] = useState(0);
  const [sortField, setSortField] = useState<SortField>("submitted_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const subMap = useMemo(() => new Map(subs.map((s) => [s.id, s.name])), [subs]);

  useEffect(() => {
    Promise.all([fetchCategories(true), fetchSubcategories(true)])
      .then(([c, s]) => {
        setCategories(c);
        setSubs(s);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("expenses").select("*", { count: "exact" });

    if (statusFilter !== ALL) q = q.eq("status", statusFilter as ExpenseStatus);
    else q = q.in("status", QUEUE_STATUSES);
    if (categoryFilter !== ALL) q = q.eq("category_id", categoryFilter);

    const s = search.replace(/[(),]/g, " ").trim();
    if (s) {
      const like = `%${s}%`;
      const ors = [
        `expense_number.ilike.${like}`,
        `description.ilike.${like}`,
        `notes.ilike.${like}`,
      ];
      if (!Number.isNaN(Number(s))) ors.push(`amount.eq.${Number(s)}`);
      q = q.or(ors.join(","));
    }

    q = q.order(sortField, { ascending: sortAsc, nullsFirst: false });
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
    setNames(await fetchUserNames(list.map((r) => r.submitted_by ?? r.created_by ?? "")));
    setLoading(false);
  }, [statusFilter, categoryFilter, search, sortField, sortAsc, page]);

  useEffect(() => {
    if (canApprove) load();
  }, [load, canApprove]);

  if (!canApprove) {
    return (
      <div className="space-y-8">
        <PageHeader title="Pending Approvals" />
        <NoAccess />
      </div>
    );
  }

  function toggleSort(field: SortField) {
    if (sortField === field) setSortAsc((a) => !a);
    else {
      setSortField(field);
      setSortAsc(false);
    }
    setPage(0);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pending Approvals"
        description="Review, approve, reject, or request revisions on submitted expenses."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search number, description, notes, amount…"
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
        <Button variant="outline" onClick={() => setFiltersOpen((o) => !o)}>
          <Filter className="h-4 w-4" />
          Filters
        </Button>
      </div>

      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <CollapsibleContent>
          <Card>
            <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All pending</SelectItem>
                    {QUEUE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{EXPENSE_STATUS[s].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(0); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All categories</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  variant="ghost"
                  onClick={() => { setStatusFilter(ALL); setCategoryFilter(ALL); setPage(0); }}
                >
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
                  <TableHead>Submitted by</TableHead>
                  <SortHead label="Submitted" field="submitted_at" {...{ sortField, sortAsc, toggleSort }} />
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 9 }).map((__, j) => (
                        <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <span className="flex h-12 w-12 items-center justify-center rounded-md bg-brand-gradient-soft text-brand-to">
                          <Clock className="h-6 w-6" />
                        </span>
                        <p className="mt-4 font-medium text-foreground">Nothing awaiting approval</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {search || statusFilter !== ALL || categoryFilter !== ALL
                            ? "Try adjusting your search or filters."
                            : "Submitted expenses will appear here for review."}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => {
                    const who = r.submitted_by ?? r.created_by;
                    return (
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
                        <TableCell className="text-muted-foreground">{who ? names[who] ?? "—" : "—"}</TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">{formatDateTime(r.submitted_at ?? r.created_at)}</TableCell>
                        <TableCell><StatusBadge status={r.status} /></TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <ApprovalPanel expense={r} onDone={load} compact />
                            <Button variant="ghost" size="icon" aria-label="View expense" asChild>
                              <Link to="/expenses/$id" params={{ id: r.id }}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
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
        className={`inline-flex items-center gap-1 hover:text-foreground ${active ? "text-foreground" : ""}`}
      >
        {label}
        <ArrowUpDown className="h-3.5 w-3.5" />
      </button>
    </TableHead>
  );
}