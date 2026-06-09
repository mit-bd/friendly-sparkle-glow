import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { RotateCcw, Trash2, Trash, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/expenses";
import { formatTk } from "@/lib/loss";
import {
  fetchDeletedCategories,
  fetchDeletedExpenses,
  fetchDeletedSubcategories,
  fetchDeletedReturns,
  fetchDeletedDamages,
  purgeCategory,
  purgeExpense,
  purgeSubcategory,
  purgeReturn,
  purgeDamage,
  restoreCategory,
  restoreExpense,
  restoreSubcategory,
  restoreReturn,
  restoreDamage,
  type DeletedExpense,
  type DeletedTaxonomy,
  type DeletedReturn,
  type DeletedDamage,
} from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/expenses/recycle-bin")({
  head: () => ({ meta: [{ title: "Recycle Bin — Motion IT BD" }] }),
  component: RecycleBinPage,
});

type Kind = "expenses" | "categories" | "subcategories" | "returns" | "damages";

interface PendingAction {
  mode: "restore" | "purge";
  kind: Kind;
  ids: string[];
  label: string;
}

function RecycleBinPage() {
  const { isAdmin } = useAuth();

  const [expenses, setExpenses] = useState<DeletedExpense[]>([]);
  const [categories, setCategories] = useState<DeletedTaxonomy[]>([]);
  const [subcategories, setSubcategories] = useState<DeletedTaxonomy[]>([]);
  const [returns, setReturns] = useState<DeletedReturn[]>([]);
  const [damages, setDamages] = useState<DeletedDamage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [selExp, setSelExp] = useState<Set<string>>(new Set());
  const [selCat, setSelCat] = useState<Set<string>>(new Set());
  const [selSub, setSelSub] = useState<Set<string>>(new Set());
  const [selRet, setSelRet] = useState<Set<string>>(new Set());
  const [selDmg, setSelDmg] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<PendingAction | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [e, c, s, ret, dmg] = await Promise.all([
        fetchDeletedExpenses(),
        fetchDeletedCategories(),
        fetchDeletedSubcategories(),
        fetchDeletedReturns(),
        fetchDeletedDamages(),
      ]);
      setExpenses(e);
      setCategories(c);
      setSubcategories(s);
      setReturns(ret);
      setDamages(dmg);
      setSelExp(new Set());
      setSelCat(new Set());
      setSelSub(new Set());
      setSelRet(new Set());
      setSelDmg(new Set());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load recycle bin.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [load, isAdmin]);

  if (!isAdmin) {
    return (
      <div className="space-y-8">
        <PageHeader title="Recycle Bin" />
        <NoAccess />
      </div>
    );
  }

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  function toggleAll(ids: string[], set: Set<string>, setter: (s: Set<string>) => void) {
    if (set.size === ids.length) setter(new Set());
    else setter(new Set(ids));
  }

  async function runAction(a: PendingAction) {
    setBusy(true);
    try {
      const ops: Promise<void>[] = a.ids.map((id) => {
        if (a.kind === "expenses") return a.mode === "restore" ? restoreExpense(id) : purgeExpense(id);
        if (a.kind === "categories") return a.mode === "restore" ? restoreCategory(id) : purgeCategory(id);
        if (a.kind === "subcategories") return a.mode === "restore" ? restoreSubcategory(id) : purgeSubcategory(id);
        if (a.kind === "returns") return a.mode === "restore" ? restoreReturn(id) : purgeReturn(id);
        return a.mode === "restore" ? restoreDamage(id) : purgeDamage(id);
      });
      await Promise.all(ops);
      toast.success(
        a.mode === "restore"
          ? `Restored ${a.ids.length} record(s).`
          : `Permanently deleted ${a.ids.length} record(s).`,
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  const tabs: { value: Kind; label: string; count: number }[] = [
    { value: "expenses", label: "Expenses", count: expenses.length },
    { value: "returns", label: "Returns", count: returns.length },
    { value: "damages", label: "Damages", count: damages.length },
    { value: "categories", label: "Categories", count: categories.length },
    { value: "subcategories", label: "Subcategories", count: subcategories.length },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recycle Bin"
        description="Restore deleted records to their original location or remove them permanently. Admin only."
      />

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      ) : (
        <Tabs defaultValue="expenses">
          <TabsList>
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
                <span className="ml-1.5 rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
                  {t.count}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* EXPENSES */}
          <TabsContent value="expenses" className="mt-4">
            <BulkBar
              count={selExp.size}
              kind="expenses"
              onRestore={() =>
                setPending({ mode: "restore", kind: "expenses", ids: [...selExp], label: `${selExp.size} expense(s)` })
              }
              onPurge={() =>
                setPending({ mode: "purge", kind: "expenses", ids: [...selExp], label: `${selExp.size} expense(s)` })
              }
            />
            {expenses.length === 0 ? (
              <EmptyState what="deleted expenses" />
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={selExp.size === expenses.length && expenses.length > 0}
                            onCheckedChange={() => toggleAll(expenses.map((x) => x.id), selExp, setSelExp)}
                            aria-label="Select all"
                          />
                        </TableHead>
                        <TableHead>Expense #</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Deleted</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenses.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell>
                            <Checkbox
                              checked={selExp.has(e.id)}
                              onCheckedChange={() => toggle(selExp, setSelExp, e.id)}
                              aria-label={`Select ${e.expense_number}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{e.expense_number}</TableCell>
                          <TableCell className="tabular-nums">{formatCurrency(e.amount)}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(e.expense_date)}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDateTime(e.deleted_at)}</TableCell>
                          <TableCell className="text-right">
                            <RowActions
                              onRestore={() =>
                                setPending({ mode: "restore", kind: "expenses", ids: [e.id], label: e.expense_number })
                              }
                              onPurge={() =>
                                setPending({ mode: "purge", kind: "expenses", ids: [e.id], label: e.expense_number })
                              }
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* CATEGORIES */}
          <TabsContent value="categories" className="mt-4">
            <BulkBar
              count={selCat.size}
              kind="categories"
              onRestore={() =>
                setPending({ mode: "restore", kind: "categories", ids: [...selCat], label: `${selCat.size} category(ies)` })
              }
              onPurge={() =>
                setPending({ mode: "purge", kind: "categories", ids: [...selCat], label: `${selCat.size} category(ies)` })
              }
            />
            {categories.length === 0 ? (
              <EmptyState what="deleted categories" />
            ) : (
              <TaxonomyTable
                rows={categories}
                sel={selCat}
                onToggle={(id) => toggle(selCat, setSelCat, id)}
                onToggleAll={() => toggleAll(categories.map((x) => x.id), selCat, setSelCat)}
                onRestore={(r) => setPending({ mode: "restore", kind: "categories", ids: [r.id], label: r.name })}
                onPurge={(r) => setPending({ mode: "purge", kind: "categories", ids: [r.id], label: r.name })}
              />
            )}
          </TabsContent>

          {/* SUBCATEGORIES */}
          <TabsContent value="subcategories" className="mt-4">
            <BulkBar
              count={selSub.size}
              kind="subcategories"
              onRestore={() =>
                setPending({ mode: "restore", kind: "subcategories", ids: [...selSub], label: `${selSub.size} subcategory(ies)` })
              }
              onPurge={() =>
                setPending({ mode: "purge", kind: "subcategories", ids: [...selSub], label: `${selSub.size} subcategory(ies)` })
              }
            />
            {subcategories.length === 0 ? (
              <EmptyState what="deleted subcategories" />
            ) : (
              <TaxonomyTable
                rows={subcategories}
                sel={selSub}
                onToggle={(id) => toggle(selSub, setSelSub, id)}
                onToggleAll={() => toggleAll(subcategories.map((x) => x.id), selSub, setSelSub)}
                onRestore={(r) => setPending({ mode: "restore", kind: "subcategories", ids: [r.id], label: r.name })}
                onPurge={(r) => setPending({ mode: "purge", kind: "subcategories", ids: [r.id], label: r.name })}
              />
            )}
          </TabsContent>
        </Tabs>
      )}

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {pending?.mode === "purge" && <AlertTriangle className="h-5 w-5 text-destructive" />}
              {pending?.mode === "restore" ? "Restore record(s)?" : "Permanently delete record(s)?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.mode === "restore" ? (
                <>
                  <span className="font-medium text-foreground">{pending?.label}</span> will be
                  returned to its original location with all history preserved.
                </>
              ) : (
                <>
                  <span className="font-medium text-foreground">{pending?.label}</span> will be
                  permanently removed. This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className={pending?.mode === "purge" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
              onClick={() => pending && runAction(pending)}
            >
              {pending?.mode === "restore" ? "Restore" : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BulkBar({
  count,
  kind,
  onRestore,
  onPurge,
}: {
  count: number;
  kind: Kind;
  onRestore: () => void;
  onPurge: () => void;
}) {
  if (count === 0) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
      <span className="text-sm font-medium text-foreground">{count} selected</span>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onRestore}>
          <RotateCcw className="h-4 w-4" />
          Restore
        </Button>
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onPurge}>
          <Trash className="h-4 w-4" />
          Delete permanently
        </Button>
      </div>
    </div>
  );
}

function RowActions({ onRestore, onPurge }: { onRestore: () => void; onPurge: () => void }) {
  return (
    <div className="flex justify-end gap-1">
      <Button size="sm" variant="ghost" onClick={onRestore}>
        <RotateCcw className="h-4 w-4" />
        Restore
      </Button>
      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onPurge}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function TaxonomyTable({
  rows,
  sel,
  onToggle,
  onToggleAll,
  onRestore,
  onPurge,
}: {
  rows: DeletedTaxonomy[];
  sel: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onRestore: (r: DeletedTaxonomy) => void;
  onPurge: (r: DeletedTaxonomy) => void;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={sel.size === rows.length && rows.length > 0}
                  onCheckedChange={onToggleAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Deleted</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Checkbox
                    checked={sel.has(r.id)}
                    onCheckedChange={() => onToggle(r.id)}
                    aria-label={`Select ${r.name}`}
                  />
                </TableCell>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-muted-foreground">{formatDateTime(r.deleted_at)}</TableCell>
                <TableCell className="text-right">
                  <RowActions onRestore={() => onRestore(r)} onPurge={() => onPurge(r)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function EmptyState({ what }: { what: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Trash2 className="h-6 w-6" />
      </span>
      <p className="mt-4 text-sm font-medium text-foreground">No {what}</p>
      <p className="mt-1 text-sm text-muted-foreground">Deleted records will appear here.</p>
    </div>
  );
}
