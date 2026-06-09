import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { fetchCategories, fetchSubcategories, type ExpenseCategory, type ExpenseSubcategory } from "@/lib/expenses";
import { BUDGET_TARGETS, BUDGET_TYPES, createBudget, periodForType, updateBudget, type Budget, type BudgetInput, type BudgetTargetType, type BudgetType } from "@/lib/budgets";

interface Props { mode: "create" | "edit"; initial?: Budget; onSaved: (id: string) => void; onCancel?: () => void; }

export function BudgetForm({ mode, initial, onSaved, onCancel }: Props) {
  const { user } = useAuth();
  const [cats, setCats] = useState<ExpenseCategory[]>([]);
  const [subs, setSubs] = useState<ExpenseSubcategory[]>([]);
  const [busy, setBusy] = useState(false);

  const def = periodForType("monthly");
  const [name, setName] = useState(initial?.name ?? "");
  const [budgetType, setBudgetType] = useState<BudgetType>(initial?.budget_type ?? "monthly");
  const [periodStart, setPeriodStart] = useState(initial?.period_start ?? def.from);
  const [periodEnd, setPeriodEnd] = useState(initial?.period_end ?? def.to);
  const [targetType, setTargetType] = useState<BudgetTargetType>(initial?.target_type ?? "category");
  const [categoryId, setCategoryId] = useState<string | null>(initial?.category_id ?? null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(initial?.subcategory_id ?? null);
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [warning, setWarning] = useState(initial ? String(initial.warning_threshold) : "80");
  const [critical, setCritical] = useState(initial ? String(initial.critical_threshold) : "100");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);

  useEffect(() => {
    Promise.all([fetchCategories(), fetchSubcategories()])
      .then(([c, s]) => { setCats(c); setSubs(s); })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load categories."));
  }, []);

  const targetMeta = BUDGET_TARGETS.find((t) => t.value === targetType);
  const subOptions = useMemo(() => (categoryId ? subs.filter((s) => s.category_id === categoryId) : subs), [subs, categoryId]);

  function onBudgetType(v: BudgetType) {
    setBudgetType(v);
    if (v !== "custom") { const r = periodForType(v); setPeriodStart(r.from); setPeriodEnd(r.to); }
  }

  async function submit() {
    if (!user) return;
    if (!name.trim()) return toast.error("Budget name is required.");
    const amt = Number(amount);
    if (!(amt > 0)) return toast.error("Budget amount must be greater than zero.");
    if (periodEnd < periodStart) return toast.error("Period end must be on or after the start.");
    if (targetMeta?.requiresCategory && !categoryId) return toast.error("Select a category for this target.");

    const payload: BudgetInput = {
      name: name.trim(), budget_type: budgetType, period_start: periodStart, period_end: periodEnd,
      target_type: targetType, category_id: targetMeta?.requiresCategory ? categoryId : null,
      subcategory_id: targetMeta?.allowsSubcategory ? subcategoryId : null, amount: amt,
      warning_threshold: Number(warning) || 0, critical_threshold: Number(critical) || 0,
      notes: notes.trim() || null, is_active: isActive,
    };

    setBusy(true);
    try {
      if (mode === "create") { const b = await createBudget(payload, user.id); toast.success(`Budget ${b.budget_number} created.`); onSaved(b.id); }
      else if (initial) { await updateBudget(initial.id, payload); toast.success("Budget updated."); onSaved(initial.id); }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save budget.");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="b-name">Budget name</Label>
          <Input id="b-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Marketing Budget" maxLength={120} />
        </div>
        <div className="space-y-2">
          <Label>Budget type</Label>
          <Select value={budgetType} onValueChange={(v) => onBudgetType(v as BudgetType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{BUDGET_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Budget target</Label>
          <Select value={targetType} onValueChange={(v) => { setTargetType(v as BudgetTargetType); setCategoryId(null); setSubcategoryId(null); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{BUDGET_TARGETS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="b-start">Start date</Label>
          <Input id="b-start" type="date" value={periodStart} onChange={(e) => { setPeriodStart(e.target.value); setBudgetType("custom"); }} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="b-end">End date</Label>
          <Input id="b-end" type="date" value={periodEnd} onChange={(e) => { setPeriodEnd(e.target.value); setBudgetType("custom"); }} />
        </div>
        {targetMeta?.requiresCategory && (
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={categoryId ?? ""} onValueChange={(v) => { setCategoryId(v); setSubcategoryId(null); }}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        {targetMeta?.allowsSubcategory && (
          <div className="space-y-2">
            <Label>Subcategory (optional)</Label>
            <Select value={subcategoryId ?? "all"} onValueChange={(v) => setSubcategoryId(v === "all" ? null : v)}>
              <SelectTrigger><SelectValue placeholder="All subcategories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All subcategories</SelectItem>
                {subOptions.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="b-amount">Budget amount (BDT)</Label>
          <Input id="b-amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="200000" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="b-warn">Warning %</Label>
            <Input id="b-warn" type="number" min="0" max="100" value={warning} onChange={(e) => setWarning(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="b-crit">Critical %</Label>
            <Input id="b-crit" type="number" min="0" max="200" value={critical} onChange={(e) => setCritical(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="b-notes">Notes</Label>
          <Textarea id="b-notes" rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional context for this budget." />
        </div>
        <div className="flex items-center gap-3">
          <Switch id="b-active" checked={isActive} onCheckedChange={setIsActive} />
          <Label htmlFor="b-active">Active (monitored & alerted)</Label>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={submit} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{mode === "create" ? "Create budget" : "Save changes"}</Button>
        {onCancel && <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>}
      </div>
    </div>
  );
}
