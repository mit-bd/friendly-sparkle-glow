import { createFileRoute } from "@/lib/router";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Pencil, Tags, FolderTree, Trash2, AlertTriangle, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { softDeleteCategory, softDeleteSubcategory } from "@/lib/audit";
import {
  fetchCategories,
  fetchSubcategories,
  type ExpenseCategory,
  type ExpenseSubcategory,
} from "@/lib/expenses";

export const Route = createFileRoute("/_authenticated/expenses/categories")({
  head: () => ({ meta: [{ title: "Expense Categories — Motion IT BD" }] }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const { isAdmin, user } = useAuth();
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [subs, setSubs] = useState<ExpenseSubcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [delTarget, setDelTarget] = useState<
    { kind: "category" | "subcategory"; id: string; name: string } | null
  >(null);
  const [deleting, setDeleting] = useState(false);

  const [catDialog, setCatDialog] = useState<{ open: boolean; edit: ExpenseCategory | null }>({
    open: false,
    edit: null,
  });
  const [subDialog, setSubDialog] = useState<{
    open: boolean;
    categoryId: string;
    edit: ExpenseSubcategory | null;
  }>({ open: false, categoryId: "", edit: null });

  const load = useCallback(async () => {
    try {
      const [cats, subcats] = await Promise.all([
        fetchCategories(true),
        fetchSubcategories(true),
      ]);
      setCategories(cats);
      setSubs(subcats);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load categories.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!isAdmin) {
    return (
      <div className="space-y-8">
        <PageHeader title="Expense Categories" />
        <NoAccess />
      </div>
    );
  }

  async function toggleCategory(cat: ExpenseCategory, active: boolean) {
    setCategories((cs) => cs.map((c) => (c.id === cat.id ? { ...c, is_active: active } : c)));
    const { error } = await supabase
      .from("expense_categories")
      .update({ is_active: active })
      .eq("id", cat.id);
    if (error) {
      toast.error(error.message);
      load();
    }
  }

  async function toggleSub(sub: ExpenseSubcategory, active: boolean) {
    setSubs((ss) => ss.map((s) => (s.id === sub.id ? { ...s, is_active: active } : s)));
    const { error } = await supabase
      .from("expense_subcategories")
      .update({ is_active: active })
      .eq("id", sub.id);
    if (error) {
      toast.error(error.message);
      load();
    }
  }

  async function confirmDelete() {
    if (!delTarget || !user) return;
    setDeleting(true);
    try {
      if (delTarget.kind === "category") await softDeleteCategory(delTarget.id, user.id);
      else await softDeleteSubcategory(delTarget.id, user.id);
      toast.success(`${delTarget.name} moved to the recycle bin.`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete.");
    } finally {
      setDeleting(false);
      setDelTarget(null);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Expense Categories"
        description="Define the category structure that powers expense submission and reporting."
        actions={
          <Button onClick={() => setCatDialog({ open: true, edit: null })}>
            <Plus className="h-4 w-4" />
            Add category
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <EmptyState onAdd={() => setCatDialog({ open: true, edit: null })} />
      ) : (
        <Accordion type="multiple" className="space-y-3">
          {categories.map((cat) => {
            const catSubs = subs.filter((s) => s.category_id === cat.id);
            return (
              <AccordionItem
                key={cat.id}
                value={cat.id}
                className="rounded-lg border border-border bg-card"
              >
                <Card className="border-0 bg-transparent shadow-none">
                  <CardHeader className="flex-row items-center gap-3 space-y-0 py-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-gradient-soft text-brand-to">
                      <Tags className="h-4 w-4" />
                    </span>
                    <AccordionTrigger className="flex-1 py-0 hover:no-underline">
                      <span className="flex items-center gap-2 text-left">
                        <span className="font-medium text-foreground">{cat.name}</span>
                        <Badge variant="outline" className="font-normal text-muted-foreground">
                          {catSubs.length} sub
                        </Badge>
                        {!cat.is_active && (
                          <Badge variant="outline" className="border-transparent bg-muted text-muted-foreground">
                            Inactive
                          </Badge>
                        )}
                      </span>
                    </AccordionTrigger>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={cat.is_active}
                        onCheckedChange={(v) => toggleCategory(cat, v)}
                        aria-label="Toggle category active"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Edit category"
                        onClick={() => setCatDialog({ open: true, edit: cat })}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete category"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDelTarget({ kind: "category", id: cat.id, name: cat.name })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <AccordionContent>
                    <CardContent className="space-y-2 pt-0">
                      {catSubs.length === 0 ? (
                        <p className="py-2 text-sm text-muted-foreground">
                          No subcategories yet.
                        </p>
                      ) : (
                        catSubs.map((sub) => (
                          <div
                            key={sub.id}
                            className="flex items-center justify-between rounded-md border border-border/60 bg-background px-3 py-2"
                          >
                            <span className="flex items-center gap-2 text-sm">
                              <span className={sub.is_active ? "text-foreground" : "text-muted-foreground line-through"}>
                                {sub.name}
                              </span>
                              {sub.is_ai_generated && (
                                <Badge
                                  variant="outline"
                                  className="border-transparent bg-chart-1/15 font-normal text-chart-1"
                                >
                                  <Sparkles className="mr-1 h-3 w-3" />
                                  AI Generated
                                </Badge>
                              )}
                            </span>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={sub.is_active}
                                onCheckedChange={(v) => toggleSub(sub, v)}
                                aria-label="Toggle subcategory active"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Edit subcategory"
                                onClick={() =>
                                  setSubDialog({ open: true, categoryId: cat.id, edit: sub })
                                }
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Delete subcategory"
                                className="text-destructive hover:text-destructive"
                                onClick={() =>
                                  setDelTarget({ kind: "subcategory", id: sub.id, name: sub.name })
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => setSubDialog({ open: true, categoryId: cat.id, edit: null })}
                      >
                        <Plus className="h-4 w-4" />
                        Add subcategory
                      </Button>
                    </CardContent>
                  </AccordionContent>
                </Card>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      <CategoryDialog
        state={catDialog}
        onClose={() => setCatDialog({ open: false, edit: null })}
        onSaved={load}
        nextOrder={categories.length + 1}
      />
      <SubcategoryDialog
        state={subDialog}
        onClose={() => setSubDialog({ open: false, categoryId: "", edit: null })}
        onSaved={load}
        nextOrder={subs.filter((s) => s.category_id === subDialog.categoryId).length + 1}
      />

      <AlertDialog open={!!delTarget} onOpenChange={(o) => !o && setDelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Move to recycle bin?
            </AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{delTarget?.name}</span>{" "}
              ({delTarget?.kind === "category" ? "Category" : "Subcategory"}) will be moved to the
              recycle bin. It will be hidden from expense forms but can be restored later by an admin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              Move to recycle bin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 px-6 py-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-md bg-brand-gradient-soft text-brand-to">
        <FolderTree className="h-7 w-7" />
      </span>
      <h2 className="mt-5 text-lg font-medium text-foreground">No categories yet</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Create your first expense category to start organizing submissions.
      </p>
      <Button className="mt-5" onClick={onAdd}>
        <Plus className="h-4 w-4" />
        Add category
      </Button>
    </div>
  );
}

function CategoryDialog({
  state,
  onClose,
  onSaved,
  nextOrder,
}: {
  state: { open: boolean; edit: ExpenseCategory | null };
  onClose: () => void;
  onSaved: () => void;
  nextOrder: number;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (state.open) setName(state.edit?.name ?? "");
  }, [state]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    const { error } = state.edit
      ? await supabase.from("expense_categories").update({ name: trimmed }).eq("id", state.edit.id)
      : await supabase
          .from("expense_categories")
          .insert({ name: trimmed, sort_order: nextOrder });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(state.edit ? "Category updated." : "Category created.");
    onClose();
    onSaved();
  }

  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{state.edit ? "Edit category" : "Add category"}</DialogTitle>
          <DialogDescription>
            Categories group related expenses for reporting and approval.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cat-name">Category name</Label>
            <Input
              id="cat-name"
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Fixed Cost"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {state.edit ? "Save changes" : "Create category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SubcategoryDialog({
  state,
  onClose,
  onSaved,
  nextOrder,
}: {
  state: { open: boolean; categoryId: string; edit: ExpenseSubcategory | null };
  onClose: () => void;
  onSaved: () => void;
  nextOrder: number;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (state.open) setName(state.edit?.name ?? "");
  }, [state]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    const { error } = state.edit
      ? await supabase
          .from("expense_subcategories")
          .update({ name: trimmed })
          .eq("id", state.edit.id)
      : await supabase.from("expense_subcategories").insert({
          category_id: state.categoryId,
          name: trimmed,
          sort_order: nextOrder,
        });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(state.edit ? "Subcategory updated." : "Subcategory created.");
    onClose();
    onSaved();
  }

  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{state.edit ? "Edit subcategory" : "Add subcategory"}</DialogTitle>
          <DialogDescription>Add a specific expense type under this category.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sub-name">Subcategory name</Label>
            <Input
              id="sub-name"
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Office Rent"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {state.edit ? "Save changes" : "Create subcategory"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}