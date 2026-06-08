import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EXPENSE_STATUS, SUBMITTABLE_STATUSES, type ExpenseStatus } from "@/lib/expenses";
import { type DamageType } from "@/lib/loss";

export interface DamageFormValues {
  damage_date: string; type_id: string; product_name: string; quantity: string; damage_value: string; notes: string; status: ExpenseStatus;
}
interface Props { value: DamageFormValues; onChange: (patch: Partial<DamageFormValues>) => void; types: DamageType[]; extraStatuses?: ExpenseStatus[]; disabled?: boolean; }
export function DamageFields({ value, onChange, types, extraStatuses = [], disabled }: Props) {
  const statusOptions = [...new Set([...SUBMITTABLE_STATUSES, ...extraStatuses])];
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="dmg-date">Damage date</Label>
          <Input id="dmg-date" type="date" required disabled={disabled} value={value.damage_date} onChange={(e) => onChange({ damage_date: e.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor="dmg-product">Product name</Label>
          <Input id="dmg-product" required maxLength={200} disabled={disabled} value={value.product_name} onChange={(e) => onChange({ product_name: e.target.value })} placeholder="What was damaged?" /></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2"><Label htmlFor="dmg-type">Damage type</Label>
          <Select value={value.type_id || undefined} disabled={disabled} onValueChange={(v) => onChange({ type_id: v })}>
            <SelectTrigger id="dmg-type"><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>{types.map((t) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}</SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="dmg-qty">Quantity</Label>
          <Input id="dmg-qty" type="number" inputMode="decimal" step="0.01" min="0" disabled={disabled} value={value.quantity} onChange={(e) => onChange({ quantity: e.target.value })} placeholder="1" /></div>
        <div className="space-y-2"><Label htmlFor="dmg-value">Damage value (BDT)</Label>
          <Input id="dmg-value" type="number" inputMode="decimal" step="0.01" min="0" required disabled={disabled} value={value.damage_value} onChange={(e) => onChange({ damage_value: e.target.value })} placeholder="0.00" /></div>
      </div>
      <div className="space-y-2"><Label htmlFor="dmg-status">Status</Label>
        <Select value={value.status} disabled={disabled} onValueChange={(v) => onChange({ status: v as ExpenseStatus })}>
          <SelectTrigger id="dmg-status" className="sm:w-[260px]"><SelectValue /></SelectTrigger>
          <SelectContent>{statusOptions.map((s) => (<SelectItem key={s} value={s}>{EXPENSE_STATUS[s].label}</SelectItem>))}</SelectContent></Select>
        <p className="text-xs text-muted-foreground">Damages count toward loss totals only after an approver marks them Approved.</p></div>
      <div className="space-y-2"><Label htmlFor="dmg-notes">Notes</Label>
        <Textarea id="dmg-notes" rows={3} maxLength={1000} disabled={disabled} value={value.notes} onChange={(e) => onChange({ notes: e.target.value })} placeholder="Describe the damage (optional)" /></div>
    </div>
  );
}
