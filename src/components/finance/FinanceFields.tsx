import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatTk, type FinanceKind, PAYABLE_PARTY_TYPES, RECEIVABLE_PARTY_TYPES } from "@/lib/finance";

export interface FinanceFormValues {
  party_name: string;
  party_type: string;
  contact_person: string;
  mobile: string;
  email: string;
  reference_number: string;
  amount: string;
  settled: string; // collected (receivable) or paid (payable)
  due_date: string;
  notes: string;
}

export function emptyFinanceForm(kind: FinanceKind): FinanceFormValues {
  return {
    party_name: "",
    party_type: kind === "receivable" ? "customer" : "supplier",
    contact_person: "",
    mobile: "",
    email: "",
    reference_number: "",
    amount: "",
    settled: "",
    due_date: "",
    notes: "",
  };
}

export function FinanceFields({
  kind,
  value,
  onChange,
}: {
  kind: FinanceKind;
  value: FinanceFormValues;
  onChange: (patch: Partial<FinanceFormValues>) => void;
}) {
  const partyTypes = kind === "receivable" ? RECEIVABLE_PARTY_TYPES : PAYABLE_PARTY_TYPES;
  const amount = Number(value.amount) || 0;
  const settled = Number(value.settled) || 0;
  const remaining = amount - settled;
  const settledLabel = kind === "receivable" ? "Collected amount" : "Paid amount";

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="fin-party">Party name *</Label>
        <Input id="fin-party" value={value.party_name} maxLength={150} onChange={(e) => onChange({ party_name: e.target.value })} placeholder={kind === "receivable" ? "e.g. Steadfast Courier" : "e.g. ABC Packaging Ltd."} />
      </div>
      <div className="space-y-2">
        <Label>Party type</Label>
        <Select value={value.party_type} onValueChange={(v) => onChange({ party_type: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {partyTypes.map((p) => (<SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="fin-ref">Reference number</Label>
        <Input id="fin-ref" value={value.reference_number} maxLength={100} onChange={(e) => onChange({ reference_number: e.target.value })} placeholder="Invoice / memo no." />
      </div>
      <div className="space-y-2">
        <Label htmlFor="fin-contact">Contact person</Label>
        <Input id="fin-contact" value={value.contact_person} maxLength={120} onChange={(e) => onChange({ contact_person: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="fin-mobile">Mobile number</Label>
        <Input id="fin-mobile" value={value.mobile} maxLength={40} onChange={(e) => onChange({ mobile: e.target.value })} placeholder="01XXXXXXXXX" />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="fin-email">Email</Label>
        <Input id="fin-email" type="email" value={value.email} maxLength={150} onChange={(e) => onChange({ email: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="fin-amount">Total amount (BDT) *</Label>
        <Input id="fin-amount" type="number" min="0" step="0.01" value={value.amount} onChange={(e) => onChange({ amount: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="fin-settled">{settledLabel} (opening)</Label>
        <Input id="fin-settled" type="number" min="0" step="0.01" value={value.settled} onChange={(e) => onChange({ settled: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="fin-due">Due date</Label>
        <Input id="fin-due" type="date" value={value.due_date} onChange={(e) => onChange({ due_date: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Remaining balance</Label>
        <div className="flex h-10 items-center rounded-md border border-border bg-muted/40 px-3 text-sm font-medium tabular-nums text-brand-gradient">
          {formatTk(remaining)}
        </div>
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="fin-notes">Notes</Label>
        <Textarea id="fin-notes" rows={3} maxLength={2000} value={value.notes} onChange={(e) => onChange({ notes: e.target.value })} />
      </div>
    </div>
  );
}