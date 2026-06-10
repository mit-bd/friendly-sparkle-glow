import { createFileRoute } from '@tanstack/react-router'
import { createFileRoute } from "@/lib/router";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Plus,
  Repeat,
  Loader2,
  Pencil,
  Trash2,
  PlayCircle,
  CalendarClock,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { NoAccess } from "@/components/NoAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import {
  fetchCategories,
  fetchSubcategories,
  formatCurrency,
  formatDate,
  type ExpenseCategory,
  type ExpenseSubcategory,
} from "@/lib/expenses";
import {
  fetchTemplates,
  createTemplate,
  updateTemplate,
  setTemplateActive,
  softDeleteTemplate,
  generateForMonth,
  type FixedCostTemplate,
  type TemplateInput,
} from "@/lib/fixed-costs";

export const Route = createFileRoute("/_authenticated/settings/fixed-costs")({
  head: () => ({ meta: [{ title: "Fixed Cost Management — Motion IT BD" }] }),
  component: FixedCostManagement,
});

const NONE = "__none__";

interface FormState {
  name: string;
  category_id: string;
  subcategory_id: string;
  monthly_amount: string;
  description: string;
  notes: string;
  is_active: boolean;
  auto_generate: boolean;
  effective_from: string;
}

const emptyForm = (): FormState => ({
  name: "",
  category_id: NONE,
  subcategory_id: NONE,
  monthly_amount: "",
  description: "",
  notes: "",
  is_active: true,
  auto_generate: true,
  effective_from: format(new Date(), "yyyy-MM-dd"),
});

function FixedCostManagement() {
  const { isAdmin, user } = useAuth();

  const [templates, setTemplates] = useState<FixedCostTemplate[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [subs, setSubs] = useState<ExpenseSubcategory[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FixedCostTemplate | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  const [toDelete, setToDelete] = useState<FixedCostTemplate | null>(null);

  const [genMonth, setGenMonth] = useState(format(new Date(), "yyyy-MM"));
  const [generating, setGenerating] = useState(false);

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const formSubs = subs.filter(
    (s) => form.category_id === NONE || s.category_id === form.category_id,
  );

  async function load() {
    const [t, c, s] = await Promise.all([
      fetchTemplates(),
      fetchCategories(true),
      fetchSubcategories(true),
    ]);
    setTemplates(t);
    setCategories(c);
    setSubs(s);
    setLoading(false);
  }

  useEffect(() => {
    if (isAdmin)
      load().catch((e) => {
        toast.error(e instanceof Error ? e.message : "Failed to load.");
        setLoading(false);
      });
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="space-y-8">
        <PageHeader title="Fixed Cost Management" />
        <NoAccess />
      </div>
    );
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  }

  function openEdit(t: FixedCostTemplate) {
    setEditing(t);
    setForm({
      name: t.name,
      category_id: t.category_id ?? NONE,
      subcategory_id: t.subcategory_id ?? NONE,
      monthly_amount: String(t.monthly_amount ?? ""),
      description: t.description ?? "",
      notes: t.notes ?? "",
      is_active: t.is_active,
      auto_generate: t.auto_generate,
      effective_from: t.effective_from,
    });
    setDialogOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    const amount = Number(form.monthly_amount);
    if (!name) return toast.error("Name is required.");
    if (!Number.isFinite(amount) || amount < 0) return toast.error("Enter a valid monthly amount.");

    const payload: TemplateInput = {
      name,
      category_id: form.category_id === NONE ? null : form.category_id,
      subcategory_id: form.subcategory_id === NONE ? null : form.subcategory_id,
      monthly_amount: amount,
      description: form.description.trim() || null,
      notes: form.notes.trim() || null,
      is_active: form.is_active,
      auto_generate: form.auto_generate,
      effective_from: form.effective_from,
    };

    setSaving(true);
    try {
      if (editing) {
        await updateTemplate(editing.id, payload);
        toast.success("Template updated.");
      } else {
        await createTemplate(payload);
        toast.success("Template created.");
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save template.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(t: FixedCostTemplate) {
    try {
      await setTemplateActive(t.id, !t.is_active);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update.");
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await softDeleteTemplate(toDelete.id, user?.id ?? null);
      toast.success("Template moved to recycle bin.");
      setToDelete(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete.");
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const count = await generateForMonth(`${genMonth}-01`);
      toast.success(
        count === 0
          ? "Nothing to generate — records already exist for this month."
          : `Generated ${count} pending fixed-cost record${count === 1 ? "" : "s"}.`,
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  const activeCount = templates.filter((t) => t.is_active).length;
  const monthlyTotal = templates
    .filter((t) => t.is_active && t.auto_generate)
    .reduce((acc, t) => acc + Number(t.monthly_amount || 0), 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Fixed Cost Management"
        description="Define recurring monthly costs once. The system generates pending-approval expenses each month."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New template
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-4 w-4 text-brand" /> Monthly generation
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="gen-month">Generate for month</Label>
            <Input
              id="gen-month"
              type="month"
              value={genMonth}
              onChange={(e) => setGenMonth(e.target.value)}
              className="w-48"
            />
          </div>
          <Button onClick={handleGenerate} disabled={generating} className="bg-brand-gradient text-primary-foreground">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            Generate now
          </Button>
          <p className="text-xs text-muted-foreground sm:ml-auto sm:max-w-xs">
            {activeCount} active template{activeCount === 1 ? "" : "s"} · {formatCurrency(monthlyTotal)} BDT auto-generated / month.
            Generated records enter the normal approval workflow — never auto-approved.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Repeat className="h-4 w-4 text-brand" /> Fixed cost templates
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : templates.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No templates yet. Create your first recurring cost (e.g. Employee Salary, Office Rent).
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Monthly Amount</TableHead>
                    <TableHead>Effective From</TableHead>
                    <TableHead>Auto</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-28 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {t.category_id ? catMap.get(t.category_id) ?? "—" : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(t.monthly_amount)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(t.effective_from)}</TableCell>
                      <TableCell>
                        <Badge variant={t.auto_generate ? "secondary" : "outline"} className="text-[10px]">
                          {t.auto_generate ? "On" : "Off"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch checked={t.is_active} onCheckedChange={() => toggleActive(t)} />
                          <span className="text-xs text-muted-foreground">
                            {t.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(t)} aria-label="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setToDelete(t)}
                            aria-label="Delete"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit template" : "New fixed cost template"}</DialogTitle>
            <DialogDescription>
              Recurring monthly cost. Salary is a single total amount — no employee-wise payroll.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fc-name">Fixed cost name</Label>
              <Input
                id="fc-name"
                value={form.name}
                maxLength={120}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Employee Salary"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={form.category_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, category_id: v, subcategory_id: NONE }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subcategory</Label>
                <Select
                  value={form.subcategory_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, subcategory_id: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {formSubs.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fc-amount">Monthly amount (BDT)</Label>
                <Input
                  id="fc-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.monthly_amount}
                  onChange={(e) => setForm((f) => ({ ...f, monthly_amount: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fc-eff">Effective from</Label>
                <Input
                  id="fc-eff"
                  type="date"
                  value={form.effective_from}
                  onChange={(e) => setForm((f) => ({ ...f, effective_from: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fc-desc">Description</Label>
              <Input
                id="fc-desc"
                value={form.description}
                maxLength={255}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Shown on each generated expense"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fc-notes">Notes</Label>
              <Textarea
                id="fc-notes"
                value={form.notes}
                maxLength={1000}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.auto_generate}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, auto_generate: v }))}
                />
                Auto generate monthly
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? "Save changes" : "Create template"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this template?</AlertDialogTitle>
            <AlertDialogDescription>
              "{toDelete?.name}" will be moved to the recycle bin and stop auto-generating.
              Already generated records are not affected. You can restore it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
