import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight } from "lucide-react";
import {
  convertToBDT,
  formatBDT,
  type Currency,
  type MarketingPlatform,
} from "@/lib/marketing";
import {
  EXPENSE_STATUS,
  SUBMITTABLE_STATUSES,
  type ExpenseStatus,
} from "@/lib/expenses";

export interface MarketingFormValues {
  expense_date: string;
  platform_id: string;
  campaign_name: string;
  description: string;
  currency: string;
  original_amount: string;
  exchange_rate: string;
  notes: string;
  status: ExpenseStatus;
}

interface Props {
  value: MarketingFormValues;
  onChange: (patch: Partial<MarketingFormValues>) => void;
  platforms: MarketingPlatform[];
  currencies: Currency[];
  extraStatuses?: ExpenseStatus[];
  disabled?: boolean;
}

export function MarketingFields({
  value,
  onChange,
  platforms,
  currencies,
  extraStatuses = [],
  disabled,
}: Props) {
  const statusOptions = [...new Set([...SUBMITTABLE_STATUSES, ...extraStatuses])];
  const isBase = value.currency === "BDT";
  const orig = Number(value.original_amount);
  const rate = isBase ? 1 : Number(value.exchange_rate);
  const converted = convertToBDT(orig || 0, rate || 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="mk-date">Expense date</Label>
          <Input
            id="mk-date"
            type="date"
            required
            disabled={disabled}
            value={value.expense_date}
            onChange={(e) => onChange({ expense_date: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mk-platform">Platform</Label>
          <Select
            value={value.platform_id || undefined}
            disabled={disabled}
            onValueChange={(v) => onChange({ platform_id: v })}
          >
            <SelectTrigger id="mk-platform">
              <SelectValue placeholder="Select platform" />
            </SelectTrigger>
            <SelectContent>
              {platforms.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="mk-campaign">Campaign name</Label>
        <Input
          id="mk-campaign"
          maxLength={200}
          disabled={disabled}
          value={value.campaign_name}
          onChange={(e) => onChange({ campaign_name: e.target.value })}
          placeholder="e.g. Eid Sale 2026"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="mk-description">Expense description</Label>
        <Textarea
          id="mk-description"
          rows={2}
          maxLength={1000}
          disabled={disabled}
          value={value.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="What was this marketing spend for?"
        />
      </div>

      {/* Currency + conversion */}
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="mk-currency">Currency</Label>
            <Select
              value={value.currency || undefined}
              disabled={disabled}
              onValueChange={(v) =>
                onChange({ currency: v, exchange_rate: v === "BDT" ? "1" : value.exchange_rate })
              }
            >
              <SelectTrigger id="mk-currency">
                <SelectValue placeholder="Currency" />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((c) => (
                  <SelectItem key={c.id} value={c.code}>
                    {c.code} — {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mk-amount">Original amount</Label>
            <Input
              id="mk-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              required
              disabled={disabled}
              value={value.original_amount}
              onChange={(e) => onChange({ original_amount: e.target.value })}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mk-rate">Exchange rate → BDT</Label>
            <Input
              id="mk-rate"
              type="number"
              inputMode="decimal"
              step="0.000001"
              min="0"
              required
              disabled={disabled || isBase}
              value={isBase ? "1" : value.exchange_rate}
              onChange={(e) => onChange({ exchange_rate: e.target.value })}
              placeholder="e.g. 130"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md bg-brand-gradient-soft p-3 text-sm">
          <span className="text-muted-foreground">
            {value.original_amount || "0"} {value.currency || "BDT"}
          </span>
          {!isBase && (
            <>
              <span className="text-muted-foreground">× {value.exchange_rate || "0"}</span>
              <ArrowRight className="h-4 w-4 text-brand-to" />
            </>
          )}
          <span className="font-semibold tabular-nums text-brand-gradient">
            {formatBDT(converted)}
          </span>
          <span className="ml-auto text-xs text-muted-foreground">
            Converted BDT amount used in all company totals
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="mk-status">Status</Label>
          <Select
            value={value.status}
            disabled={disabled}
            onValueChange={(v) => onChange({ status: v as ExpenseStatus })}
          >
            <SelectTrigger id="mk-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {EXPENSE_STATUS[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="mk-notes">Notes</Label>
        <Textarea
          id="mk-notes"
          rows={2}
          maxLength={1000}
          disabled={disabled}
          value={value.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Internal notes (optional)"
        />
      </div>
    </div>
  );
}
