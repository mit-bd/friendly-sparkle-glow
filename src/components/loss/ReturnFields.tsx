import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EXPENSE_STATUS, SUBMITTABLE_STATUSES, type ExpenseCategory, type ExpenseStatus } from "@/lib/expenses";
import { formatTk, type ReturnReason } from "@/lib/loss";

export interface ReturnFormValues {
  return_date: string; category_id: string; reason_id: string; product_name: string; quantity: string;
  customer_notes: string; loss_amount: string; recoverable_amount: string; notes: string; status: ExpenseStatus;
}
interface Props {
  value: ReturnFormValues; onChange: (patch: Partial<ReturnFormValues>) => void;
  reasons: ReturnReason[]; categories: ExpenseCategory[]; extraStatuses?: ExpenseStatus[]; disabled?: boolean;
}
export function ReturnFields({ value, onChange, reasons, categories, extraStatuses = [], disabled }: Props) {
  const statusOptions = [...new Set([...SUBMITTABLE_STATUSES, ...extraStatuses])];
  const netLoss = (Number(value.loss_amount) || 0) - (Number(value.recoverable_amount) || 0);
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="ret-date">Return date</Label>
          <Input id="ret-date" type="date" required disabled={disabled} value={value.return_date} onChange={(e) => onChange({ return_date: e.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor="ret-product">Product name</Label>
          <Input id="ret-product" required maxLength={200} disabled={disabled} value={value.product_name} onChange={(e) => onChange({ product_name: e.target.value })} placeholder="What was returned?" /></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="ret-reason">Return reason</Label>
          <Select value={value.reason_id || undefined} disabled={disabled} onValueChange={(v) => onChange({ reason_id: v })}>
            <SelectTrigger id="ret-reason"><SelectValue placeholder="Select reason" /></SelectTrigger>
            <SelectContent>{reasons.map((r) => (<SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>))}</SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="ret-category">Category</Label>
          <Select value={value.category_id || undefined} disabled={disabled} onValueChange={(v) => onChange({ category_id: v })}>
            <SelectTrigger id="ret-category"><SelectValue placeholder="Select category (optional)" /></SelectTrigger>
            <SelectContent>{categories.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent></Select></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2"><Label htmlFor="ret-qty">Quantity</Label>
          <Input id="ret-qty" type="number" inputMode="decimal" step="0.01" min="0" disabled={disabled} value={value.quantity} onChange={(e) => onChange({ quantity: e.target.value })} placeholder="1" /></div>
        <div className="space-y-2"><Label htmlFor="ret-loss">Loss amount (BDT)</Label>
          <Input id="ret-loss" type="number" inputMode="decimal" step="0.01" min="0" required disabled={disabled} value={value.loss_amount} onChange={(e) => onChange({ loss_amount: e.target.value })} placeholder="0.00" /></div>
        <div className="space-y-2"><Label htmlFor="ret-rec">Recoverable amount (BDT)</Label>
          <Input id="ret-rec" type="number" inputMode="decimal" step="0.01" min="0" disabled={disabled} value={value.recoverable_amount} onChange={(e) => onChange({ recoverable_amount: e.target.value })} placeholder="0.00" /></div>
      </div>
      <div className="flex items-center justify-between rounded-md bg-brand-gradient-soft px-4 py-3">
        <span className="text-sm font-medium text-foreground">Net return loss</span>
        <span className="text-lg font-semibold tabular-nums text-brand-gradient">{formatTk(netLoss)}</span>
      </div>
      <div className="space-y-2"><Label htmlFor="ret-status">Status</Label>
        <Select value={value.status} disabled={disabled} onValueChange={(v) => onChange({ status: v as ExpenseStatus })}>
          <SelectTrigger id="ret-status" className="sm:w-[260px]"><SelectValue /></SelectTrigger>
          <SelectContent>{statusOptions.map((s) => (<SelectItem key={s} value={s}>{EXPENSE_STATUS[s].label}</SelectItem>))}</SelectContent></Select>
        <p className="text-xs text-muted-foreground">Returns count toward loss totals only after an approver marks them Approved.</p></div>
      <div className="space-y-2"><Label htmlFor="ret-cust-notes">Customer notes</Label>
        <Textarea id="ret-cust-notes" rows={2} maxLength={1000} disabled={disabled} value={value.customer_notes} onChange={(e) => onChange({ customer_notes: e.target.value })} placeholder="Customer comments / complaint details" /></div>
      <div className="space-y-2"><Label htmlFor="ret-notes">Internal notes</Label>
        <Textarea id="ret-notes" rows={2} maxLength={1000} disabled={disabled} value={value.notes} onChange={(e) => onChange({ notes: e.target.value })} placeholder="Internal notes (optional)" /></div>
    </div>
  );
}
